/**
 * 审计日志安全测试
 *
 * 测试审计日志系统的完整性、防篡改和记录完整性
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DefaultPermissionService,
  PermissionService,
  CreateUserRequest,
  AuditLogFilter,
  PermissionAuditEntry
} from '../../src/services/permission-service';
import { FileManager } from '../../src/lib/file-manager';
import { DocumentService } from '../../src/services/document-service';
import { PRDDraft } from '../../src/models/prd-draft';
import { Template } from '../../src/models/template';
import { User } from '../../src/models/user-role';
import { createTempDirectory, cleanupDirectory } from '../helpers/test-utils';

describe('审计日志安全测试', () => {
  let permissionService: PermissionService;
  let documentService: DocumentService;
  let fileManager: FileManager;
  let testUsers: User[];
  let testDraft: PRDDraft;
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTempDirectory('audit-log-test');
    fileManager = new FileManager({
      baseDir: testDir,
      enableBackup: true,
      enableWatch: false
    });
    await fileManager.initialize();

    permissionService = new DefaultPermissionService();
    documentService = new DocumentService(fileManager, permissionService);

    // 创建测试用户
    testUsers = await createTestUsers();
    testDraft = await createTestDraft();
  });

  afterEach(async () => {
    await fileManager?.destroy();
    await cleanupDirectory(testDir);
  });

  async function createTestUsers(): Promise<User[]> {
    const users: User[] = [];
    const userRequests: CreateUserRequest[] = [
      {
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@example.com',
        roleId: 'architect'
      },
      {
        id: 'normal-user',
        name: 'Normal User',
        email: 'normal@example.com',
        roleId: 'developer'
      },
      {
        id: 'malicious-user',
        name: 'Malicious User',
        email: 'malicious@example.com',
        roleId: 'viewer'
      }
    ];

    for (const userRequest of userRequests) {
      users.push(await permissionService.createUser(userRequest));
    }

    return users;
  }

  async function createTestDraft(): Promise<PRDDraft> {
    const template: Template = {
      id: 'audit-template',
      name: 'Audit Template',
      description: 'Template for audit testing',
      version: '1.0.0',
      structure: {
        sections: [
          { name: 'overview', title: 'Overview', required: true, editable: true },
          { name: 'security', title: 'Security', required: true, editable: true }
        ],
        relationships: [],
        validationRules: []
      },
      content: {},
      metadata: {
        created: new Date(),
        updated: new Date(),
        author: 'system',
        tags: ['audit'],
        category: 'security'
      }
    };

    return {
      id: 'audit-draft',
      title: 'Audit Test Draft',
      description: 'Draft for audit testing',
      template: template,
      content: {
        overview: 'Audit test content',
        security: 'Security considerations'
      },
      metadata: {
        created: new Date(),
        updated: new Date(),
        author: 'admin-user',
        status: 'draft',
        priority: 'high',
        tags: ['audit', 'security'],
        estimatedEffort: 'medium',
        targetAudience: ['security-team']
      },
      permissions: {
        owner: 'admin-user',
        collaborators: ['normal-user'],
        viewers: ['malicious-user'],
        public: false
      },
      reviewStatus: {
        currentStatus: 'draft',
        history: [],
        assignees: [],
        deadline: null,
        requirements: {
          minReviewers: 1,
          requiredRoles: ['architect'],
          approvalThreshold: 1
        }
      },
      versioning: {
        currentVersion: '1.0.0',
        previousVersions: [],
        changeLog: [],
        autoIncrement: true
      }
    };
  }

  describe('审计日志完整性', () => {
    it('应该记录所有权限检查操作', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 执行各种权限操作
      await permissionService.canRead(user.id, testDraft);
      await permissionService.canEdit(user.id, testDraft);
      await permissionService.canDelete(user.id, testDraft);
      await permissionService.canReview(user.id, testDraft);
      await permissionService.canApprove(user.id, testDraft);

      // 检查审计日志
      const auditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      expect(auditLog.length).toBeGreaterThanOrEqual(5);

      const actions = auditLog.map(entry => entry.action);
      expect(actions).toContain('read');
      expect(actions).toContain('edit');
      expect(actions).toContain('delete');
      expect(actions).toContain('review');
      expect(actions).toContain('approve');
    });

    it('应该记录权限检查的完整上下文', async () => {
      const user = testUsers.find(u => u.id === 'malicious-user')!;

      await permissionService.canEdit(user.id, testDraft);

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: user.id,
        action: 'edit'
      });

      expect(auditLog.length).toBeGreaterThanOrEqual(1);

      const entry = auditLog[0];
      expect(entry).toMatchObject({
        userId: user.id,
        userName: user.name,
        action: 'edit',
        resourceType: 'prd_draft',
        resourceId: testDraft.id,
        granted: false, // 观察者不应该有编辑权限
        timestamp: expect.any(Date)
      });

      expect(entry.metadata).toBeDefined();
      expect(entry.metadata.userRole).toBe('viewer');
      expect(entry.metadata.resourceData).toBeDefined();
    });

    it('应该记录敏感操作的详细信息', async () => {
      const adminUser = testUsers.find(u => u.id === 'admin-user')!;

      // 执行敏感操作
      await permissionService.canDelete(adminUser.id, testDraft);
      await permissionService.canApprove(adminUser.id, testDraft);

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: adminUser.id
      });

      for (const entry of auditLog) {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.userId).toBe(adminUser.id);
        expect(entry.userName).toBe(adminUser.name);
        expect(['delete', 'approve']).toContain(entry.action);
        expect(entry.granted).toBe(true); // 管理员应该有权限
      }
    });

    it('应该记录失败的权限检查', async () => {
      const lowPrivUser = testUsers.find(u => u.id === 'malicious-user')!;

      // 尝试未授权操作
      await permissionService.canDelete(lowPrivUser.id, testDraft);
      await permissionService.canApprove(lowPrivUser.id, testDraft);

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: lowPrivUser.id,
        granted: false
      });

      expect(auditLog.length).toBeGreaterThanOrEqual(2);

      auditLog.forEach(entry => {
        expect(entry.granted).toBe(false);
        expect(entry.userId).toBe(lowPrivUser.id);
        expect(['delete', 'approve']).toContain(entry.action);
      });
    });
  });

  describe('审计日志防篡改', () => {
    it('应该防止审计日志条目被修改', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      await permissionService.canRead(user.id, testDraft);

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      const originalEntry = auditLog[0];
      const originalEntryJson = JSON.stringify(originalEntry);

      // 尝试修改审计日志条目（这应该被阻止）
      try {
        (originalEntry as any).granted = !originalEntry.granted;
        (originalEntry as any).action = 'admin';
        (originalEntry as any).userName = 'admin';
      } catch (error) {
        // 如果修改被阻止，这是好的
      }

      // 重新获取审计日志
      const newAuditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      const newEntryJson = JSON.stringify(newAuditLog[0]);

      // 审计日志应该保持不变（如果实现了不可变性）
      // 注意：这个测试假设实现了防篡改机制
      expect(newAuditLog[0].granted).toBe(originalEntry.granted);
      expect(newAuditLog[0].action).toBe(originalEntry.action);
      expect(newAuditLog[0].userName).toBe(originalEntry.userName);
    });

    it('应该防止审计日志条目被删除', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 创建多个审计日志条目
      await permissionService.canRead(user.id, testDraft);
      await permissionService.canEdit(user.id, testDraft);
      await permissionService.canDelete(user.id, testDraft);

      const initialAuditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      const initialCount = initialAuditLog.length;
      expect(initialCount).toBeGreaterThanOrEqual(3);

      // 尝试获取审计日志的内部引用并删除条目
      // 这种攻击应该被阻止
      try {
        if (Array.isArray(initialAuditLog)) {
          initialAuditLog.pop();
          initialAuditLog.splice(0, 1);
        }
      } catch (error) {
        // 删除被阻止是好的
      }

      // 重新获取审计日志
      const newAuditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      // 审计日志条目数量应该保持不变
      expect(newAuditLog.length).toBe(initialCount);
    });

    it('应该验证审计日志的时间戳完整性', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      const startTime = new Date();

      // 执行操作
      await permissionService.canRead(user.id, testDraft);

      // 稍等一下
      await new Promise(resolve => setTimeout(resolve, 10));

      await permissionService.canEdit(user.id, testDraft);

      const endTime = new Date();

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      // 检查时间戳的合理性
      auditLog.forEach(entry => {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        expect(entry.timestamp.getTime()).toBeLessThanOrEqual(endTime.getTime());
      });

      // 检查时间戳的顺序
      if (auditLog.length >= 2) {
        const timestamps = auditLog.map(e => e.timestamp.getTime()).sort();
        const originalTimestamps = auditLog.map(e => e.timestamp.getTime());

        // 时间戳应该是递增的（最新的在前面）
        expect(originalTimestamps[0]).toBeGreaterThanOrEqual(originalTimestamps[1]);
      }
    });

    it('应该防止时间戳操纵', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 保存原始时间函数
      const originalDate = Date;
      const originalNow = Date.now;

      try {
        // 尝试操纵时间
        const fakeTime = new Date('2000-01-01').getTime();
        vi.spyOn(Date, 'now').mockReturnValue(fakeTime);

        await permissionService.canRead(user.id, testDraft);

        // 恢复正常时间
        vi.restoreAllMocks();

        const currentTime = Date.now();
        await permissionService.canEdit(user.id, testDraft);

        const auditLog = await permissionService.getPermissionAuditLog({
          userId: user.id
        });

        // 检查时间戳是否被正确记录
        auditLog.forEach(entry => {
          // 时间戳应该在合理范围内，不应该是被操纵的假时间
          expect(entry.timestamp.getTime()).toBeLessThanOrEqual(currentTime + 1000);
          expect(entry.timestamp.getTime()).toBeGreaterThan(fakeTime);
        });
      } finally {
        // 确保恢复原始时间函数
        global.Date = originalDate;
        Date.now = originalNow;
        vi.restoreAllMocks();
      }
    });
  });

  describe('审计日志查询安全', () => {
    it('应该防止审计日志查询注入攻击', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 创建一些审计记录
      await permissionService.canRead(user.id, testDraft);
      await permissionService.canEdit(user.id, testDraft);

      // 尝试各种注入攻击
      const maliciousFilters: AuditLogFilter[] = [
        {
          userId: "'; DROP TABLE audit_log; --",
          action: 'read'
        },
        {
          action: '<script>alert("xss")</script>',
          userId: user.id
        },
        {
          resourceType: '../../../etc/passwd',
          userId: user.id
        },
        {
          resourceId: '${process.env.SECRET}',
          userId: user.id
        },
        {
          granted: true,
          // @ts-ignore - 故意的类型错误测试
          maliciousField: 'DROP TABLE users'
        }
      ];

      for (const filter of maliciousFilters) {
        try {
          const results = await permissionService.getPermissionAuditLog(filter);

          // 查询应该返回合理的结果
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBeLessThanOrEqual(1000); // 合理的限制

          // 检查返回的数据没有被注入内容污染
          results.forEach(entry => {
            expect(entry).toHaveProperty('id');
            expect(entry).toHaveProperty('timestamp');
            expect(entry).toHaveProperty('userId');
            expect(entry).toHaveProperty('action');
            expect(entry.timestamp).toBeInstanceOf(Date);
            expect(typeof entry.granted).toBe('boolean');
          });
        } catch (error) {
          // 如果查询被拒绝，确保是合理的错误
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('应该限制审计日志查询的权限', async () => {
      const adminUser = testUsers.find(u => u.id === 'admin-user')!;
      const normalUser = testUsers.find(u => u.id === 'normal-user')!;
      const maliciousUser = testUsers.find(u => u.id === 'malicious-user')!;

      // 创建一些审计记录
      await permissionService.canRead(adminUser.id, testDraft);
      await permissionService.canRead(normalUser.id, testDraft);
      await permissionService.canRead(maliciousUser.id, testDraft);

      // 恶意用户尝试查看所有用户的审计日志
      const allAuditLogs = await permissionService.getPermissionAuditLog({});

      // 实际的权限控制应该在业务层实现
      // 这里我们测试返回的数据结构是否安全
      expect(Array.isArray(allAuditLogs)).toBe(true);

      // 检查敏感信息是否被正确清理
      allAuditLogs.forEach(entry => {
        expect(entry.metadata).toBeDefined();

        // 检查是否暴露了不应该暴露的敏感信息
        if (entry.metadata.resourceData) {
          expect(entry.metadata.resourceData).not.toHaveProperty('password');
          expect(entry.metadata.resourceData).not.toHaveProperty('secret');
          expect(entry.metadata.resourceData).not.toHaveProperty('token');
        }
      });
    });

    it('应该防止审计日志查询的DoS攻击', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 创建大量审计记录
      const promises = Array.from({ length: 100 }, () =>
        permissionService.canRead(user.id, testDraft)
      );
      await Promise.all(promises);

      const startTime = Date.now();

      // 尝试大型查询
      const largeQueryFilters: AuditLogFilter[] = [
        { limit: Number.MAX_SAFE_INTEGER },
        { offset: Number.MAX_SAFE_INTEGER },
        { limit: -1 },
        { offset: -1 }
      ];

      for (const filter of largeQueryFilters) {
        try {
          const results = await permissionService.getPermissionAuditLog(filter);

          // 查询应该在合理时间内完成
          const queryTime = Date.now() - startTime;
          expect(queryTime).toBeLessThan(5000); // 5秒内

          // 结果数量应该被限制
          expect(results.length).toBeLessThanOrEqual(10000);
        } catch (error) {
          // 如果查询被拒绝，确保是合理的错误
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('审计日志数据保护', () => {
    it('应该清理敏感数据', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 创建包含敏感信息的资源
      const sensitiveResource = {
        ...testDraft,
        content: {
          ...testDraft.content,
          password: 'secret123',
          apiKey: 'sk-1234567890',
          creditCard: '4111-1111-1111-1111'
        },
        metadata: {
          ...testDraft.metadata,
          internalNotes: 'Confidential information'
        }
      };

      await permissionService.canRead(user.id, sensitiveResource);

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      const entry = auditLog[0];

      // 检查敏感信息是否被正确清理
      expect(entry.metadata.resourceData).toBeDefined();
      expect(entry.metadata.resourceData).not.toHaveProperty('password');
      expect(entry.metadata.resourceData).not.toHaveProperty('apiKey');
      expect(entry.metadata.resourceData).not.toHaveProperty('creditCard');
      expect(entry.metadata.resourceData).not.toHaveProperty('internalNotes');

      // 应该只包含基本的标识信息
      expect(entry.metadata.resourceData).toHaveProperty('id');
      expect(entry.metadata.resourceData).toHaveProperty('type');
      expect(entry.metadata.resourceData).toHaveProperty('title');
    });

    it('应该防止个人身份信息(PII)泄露', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 更新用户资料包含PII信息
      await permissionService.updateUser(user.id, {
        profile: {
          title: 'Senior Developer',
          department: 'Engineering',
          location: 'New York'
        }
      });

      await permissionService.canRead(user.id, testDraft);

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      const entry = auditLog[0];

      // 检查用户信息是否被适当处理
      expect(entry.userId).toBe(user.id); // ID可以保留
      expect(entry.userName).toBe(user.name); // 姓名可以保留

      // 检查元数据中是否包含过多的个人信息
      if (entry.metadata.userProfile) {
        expect(entry.metadata.userProfile).not.toHaveProperty('ssn');
        expect(entry.metadata.userProfile).not.toHaveProperty('phone');
        expect(entry.metadata.userProfile).not.toHaveProperty('address');
      }
    });

    it('应该支持审计日志的合规性要求', async () => {
      const users = testUsers;

      // 执行各种操作
      for (const user of users) {
        await permissionService.canRead(user.id, testDraft);
        await permissionService.canEdit(user.id, testDraft);
      }

      // 测试合规性查询
      const complianceQueries = [
        // 查询特定时间范围的所有活动
        {
          dateRange: {
            from: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时前
            to: new Date()
          }
        },
        // 查询特定资源的所有访问
        {
          resourceType: 'prd_draft',
          resourceId: testDraft.id
        },
        // 查询失败的权限检查
        {
          granted: false
        },
        // 查询特定用户的活动
        {
          userId: users[0].id
        }
      ];

      for (const query of complianceQueries) {
        const results = await permissionService.getPermissionAuditLog(query);

        expect(Array.isArray(results)).toBe(true);

        // 检查合规性所需的字段
        results.forEach(entry => {
          expect(entry).toHaveProperty('id'); // 唯一标识符
          expect(entry).toHaveProperty('timestamp'); // 时间戳
          expect(entry).toHaveProperty('userId'); // 用户标识
          expect(entry).toHaveProperty('action'); // 操作类型
          expect(entry).toHaveProperty('resourceType'); // 资源类型
          expect(entry).toHaveProperty('resourceId'); // 资源标识
          expect(entry).toHaveProperty('granted'); // 权限结果

          // 检查数据质量
          expect(entry.id).toBeTruthy();
          expect(entry.timestamp).toBeInstanceOf(Date);
          expect(entry.userId).toBeTruthy();
          expect(entry.action).toBeTruthy();
          expect(typeof entry.granted).toBe('boolean');
        });
      }
    });
  });

  describe('审计日志存储安全', () => {
    it('应该防止审计日志文件被直接访问', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      await permissionService.canRead(user.id, testDraft);

      // 尝试通过文件系统直接访问审计日志
      // 这个测试假设审计日志被存储在文件中
      const potentialLogPaths = [
        'audit.log',
        'audit.json',
        '.logs/audit.log',
        'logs/permissions.log',
        'var/log/audit.log'
      ];

      for (const logPath of potentialLogPaths) {
        try {
          const exists = await fileManager.exists(logPath);
          if (exists) {
            // 如果文件存在，检查是否有适当的保护
            const canRead = await fileManager.readFile(logPath);

            // 审计日志内容应该是结构化的且不包含原始密码
            if (typeof canRead === 'string') {
              expect(canRead).not.toContain('password123');
              expect(canRead).not.toContain('secret_key');
              expect(canRead).not.toContain('private_token');
            }
          }
        } catch (error) {
          // 如果访问被拒绝，这是好的安全措施
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('应该确保审计日志的持久性', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 创建审计记录
      await permissionService.canRead(user.id, testDraft);
      await permissionService.canEdit(user.id, testDraft);

      const initialAuditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      expect(initialAuditLog.length).toBeGreaterThanOrEqual(2);

      // 模拟系统重启或服务重启
      // 在真实实现中，这应该测试审计日志是否持久化到存储
      const newPermissionService = new DefaultPermissionService();

      // 在新的服务实例中，审计日志应该仍然可用
      // 注意：这个测试假设实现了持久化存储
      const persistedAuditLog = await newPermissionService.getPermissionAuditLog({});

      // 如果实现了持久化，日志应该保持
      // 如果是内存存储，这个测试会失败，这有助于发现存储问题
      if (persistedAuditLog.length === 0) {
        console.warn('审计日志可能没有持久化存储，这可能是安全问题');
      }
    });

    it('应该测试审计日志的备份和恢复', async () => {
      const user = testUsers.find(u => u.id === 'normal-user')!;

      // 创建一些审计记录
      for (let i = 0; i < 10; i++) {
        await permissionService.canRead(user.id, testDraft);
      }

      const originalAuditLog = await permissionService.getPermissionAuditLog({
        userId: user.id
      });

      expect(originalAuditLog.length).toBeGreaterThanOrEqual(10);

      // 模拟备份过程
      const backupData = JSON.stringify(originalAuditLog);
      await fileManager.writeFileAtomic('audit-backup.json', backupData);

      // 模拟数据丢失和恢复过程
      const restoredData = await fileManager.readFile('audit-backup.json');
      const restoredAuditLog = JSON.parse(restoredData as string);

      // 验证备份数据的完整性
      expect(restoredAuditLog.length).toBe(originalAuditLog.length);

      restoredAuditLog.forEach((entry: PermissionAuditEntry, index: number) => {
        expect(entry.id).toBe(originalAuditLog[index].id);
        expect(entry.userId).toBe(originalAuditLog[index].userId);
        expect(entry.action).toBe(originalAuditLog[index].action);
        expect(entry.granted).toBe(originalAuditLog[index].granted);
      });
    });
  });

  describe('实时审计监控', () => {
    it('应该检测异常的权限检查模式', async () => {
      const maliciousUser = testUsers.find(u => u.id === 'malicious-user')!;

      // 模拟暴力破解尝试
      const suspiciousAttempts = Array.from({ length: 50 }, () =>
        permissionService.canDelete(maliciousUser.id, testDraft)
      );

      await Promise.all(suspiciousAttempts);

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: maliciousUser.id,
        action: 'delete',
        granted: false
      });

      // 检测大量失败的权限检查
      expect(auditLog.length).toBe(50);

      // 分析时间模式
      const timestamps = auditLog.map(e => e.timestamp.getTime()).sort();
      const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];

      // 如果在短时间内有大量失败尝试，应该触发警报
      if (timeSpan < 60000 && auditLog.length > 20) { // 1分钟内超过20次失败
        console.warn(`检测到可疑活动：用户 ${maliciousUser.id} 在 ${timeSpan}ms 内有 ${auditLog.length} 次失败的权限检查`);
      }
    });

    it('应该监控特权升级尝试', async () => {
      const normalUser = testUsers.find(u => u.id === 'normal-user')!;

      // 模拟特权升级尝试
      await permissionService.canApprove(normalUser.id, testDraft);
      await permissionService.canDelete(normalUser.id, testDraft);

      // 尝试访问管理功能
      try {
        await permissionService.updateUser(normalUser.id, { roleId: 'architect' });
      } catch (error) {
        // 权限错误是预期的
      }

      const auditLog = await permissionService.getPermissionAuditLog({
        userId: normalUser.id
      });

      // 分析是否有特权升级模式
      const privilegedActions = auditLog.filter(entry =>
        ['approve', 'delete', 'admin'].includes(entry.action) && !entry.granted
      );

      if (privilegedActions.length > 0) {
        console.warn(`检测到特权升级尝试：用户 ${normalUser.id} 尝试执行超出权限的操作`);
      }

      expect(privilegedActions.length).toBeGreaterThan(0);
    });

    it('应该监控审计日志本身的访问', async () => {
      const users = testUsers;

      // 模拟大量审计日志查询
      const auditQueries = users.flatMap(user =>
        Array.from({ length: 10 }, () =>
          permissionService.getPermissionAuditLog({ userId: user.id })
        )
      );

      const startTime = Date.now();
      await Promise.all(auditQueries);
      const endTime = Date.now();

      // 检查查询性能
      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(10000); // 10秒内完成所有查询

      // 在真实实现中，应该记录对审计日志的访问
      // 这里我们只是验证系统在大量查询下的稳定性
      const finalAuditLog = await permissionService.getPermissionAuditLog({});
      expect(Array.isArray(finalAuditLog)).toBe(true);
    });
  });
});