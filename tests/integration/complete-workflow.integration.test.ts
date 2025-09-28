/**
 * T038: Complete Workflow Integration Test
 *
 * Tests the complete PRD workflow integration connecting all services:
 * creation → editing → review → approval → version management.
 * Validates end-to-end scenarios and performance requirements.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { FileManager } from '../../src/lib/file-manager';
import { DocumentService } from '../../src/services/document-service';
import { TemplateService } from '../../src/services/template-service';
import { VersionService } from '../../src/services/version-service';
import { PermissionService } from '../../src/services/permission-service';
import { DiagramService } from '../../src/services/diagram-service';
import { MarkdownParser } from '../../src/lib/markdown-parser';
import { PRDDraft } from '../../src/models/prd-draft';
import { Template } from '../../src/models/template';
import { UserRole } from '../../src/models/user-role';
import { ReviewStatus } from '../../src/models/review-status';

describe('T038: Complete Workflow Integration', () => {
  let testDir: string;
  let fileManager: FileManager;
  let documentService: DocumentService;
  let templateService: TemplateService;
  let versionService: VersionService;
  let permissionService: PermissionService;
  let diagramService: DiagramService;
  let markdownParser: MarkdownParser;

  // Workflow participants
  const workflowUsers = {
    productManager: {
      id: 'pm-001',
      name: '张产品',
      role: 'product_manager' as const,
      email: 'pm@company.com'
    },
    architect: {
      id: 'arch-001',
      name: '李架构',
      role: 'architect' as const,
      email: 'arch@company.com'
    },
    developer: {
      id: 'dev-001',
      name: '王开发',
      role: 'developer' as const,
      email: 'dev@company.com'
    },
    tester: {
      id: 'test-001',
      name: '赵测试',
      role: 'tester' as const,
      email: 'test@company.com'
    },
    reviewer: {
      id: 'review-001',
      name: '刘评审',
      role: 'architect' as const,
      email: 'reviewer@company.com'
    }
  };

  beforeAll(async () => {
    testDir = path.join(__dirname, '..', 'temp', 'complete-workflow-integration');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    fileManager = new FileManager(testDir);
    markdownParser = new MarkdownParser();

    documentService = new DocumentService(fileManager, markdownParser);
    templateService = new TemplateService(fileManager);
    versionService = new VersionService(fileManager);
    permissionService = new PermissionService(fileManager);
    diagramService = new DiagramService(fileManager, markdownParser);

    await fileManager.initialize();

    // Initialize users and permissions
    for (const user of Object.values(workflowUsers)) {
      await permissionService.initializeUserPermissions(user.id, user.role);
    }

    // Create comprehensive PRD template
    await createComprehensivePRDTemplate();
  });

  afterEach(async () => {
    const files = await fs.readdir(testDir);
    for (const file of files) {
      await fs.rm(path.join(testDir, file), { recursive: true, force: true });
    }
  });

  async function createComprehensivePRDTemplate(): Promise<void> {
    const comprehensiveTemplate: Template = {
      id: 'comprehensive-prd-template',
      name: '完整 PRD 模板',
      description: '包含所有必要章节的完整 PRD 模板',
      category: 'comprehensive',
      sections: [
        {
          id: 'overview',
          title: '产品概述',
          type: 'text',
          required: true,
          content: '## 产品概述\n\n描述产品的整体概况和目标。',
          permissions: {
            read: ['product_manager', 'architect', 'developer', 'tester'],
            write: ['product_manager']
          }
        },
        {
          id: 'requirements',
          title: '需求分析',
          type: 'text',
          required: true,
          content: '## 需求分析\n\n详细的功能和非功能需求。',
          permissions: {
            read: ['product_manager', 'architect', 'developer', 'tester'],
            write: ['product_manager', 'architect']
          }
        },
        {
          id: 'architecture',
          title: '系统架构',
          type: 'diagram',
          required: true,
          content: `
## 系统架构

\`\`\`mermaid
graph TD
    A[前端应用] --> B[API网关]
    B --> C[业务服务]
    C --> D[数据层]
    C --> E[缓存层]
\`\`\`
          `,
          permissions: {
            read: ['architect', 'developer', 'tester'],
            write: ['architect']
          },
          metadata: {
            diagramType: 'mermaid'
          }
        },
        {
          id: 'implementation',
          title: '实现方案',
          type: 'text',
          required: true,
          content: '## 实现方案\n\n技术实现的详细方案。',
          permissions: {
            read: ['architect', 'developer'],
            write: ['developer']
          }
        },
        {
          id: 'testing',
          title: '测试策略',
          type: 'text',
          required: true,
          content: '## 测试策略\n\n测试计划和质量保证策略。',
          permissions: {
            read: ['developer', 'tester'],
            write: ['tester']
          }
        }
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        tags: ['comprehensive', 'workflow-test'],
        reviewRequired: true,
        approvalRequired: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await templateService.createTemplate(comprehensiveTemplate);
  }

  describe('End-to-End PRD Workflow', () => {
    it('应该支持完整的 PRD 创建到发布工作流', async () => {
      const workflowSteps: Array<{
        step: string;
        actor: typeof workflowUsers[keyof typeof workflowUsers];
        action: () => Promise<any>;
        validation: (result: any) => void;
      }> = [];

      let draftId: string;
      let currentVersion = '1.0.0';

      // Step 1: Product Manager creates initial PRD draft
      workflowSteps.push({
        step: '创建初始 PRD 草稿',
        actor: workflowUsers.productManager,
        action: async () => {
          const initialDraft: PRDDraft = {
            id: 'workflow-test-prd',
            title: '新产品功能 PRD',
            description: '工作流测试用的完整 PRD 文档',
            content: {
              overview: '这是一个创新的产品功能，旨在提升用户体验。',
              requirements: '主要功能需求包括：\n1. 用户注册登录\n2. 数据管理\n3. 报表分析',
              architecture: `
## 系统架构

\`\`\`mermaid
graph TD
    A[用户界面] --> B[业务逻辑]
    B --> C[数据存储]
\`\`\`
              `,
              implementation: '待开发人员补充',
              testing: '待测试人员补充'
            },
            templateId: 'comprehensive-prd-template',
            author: workflowUsers.productManager.id,
            status: 'draft',
            version: currentVersion,
            tags: ['新功能', '优先级高'],
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const result = await documentService.createDraft(initialDraft);
          draftId = initialDraft.id;
          return result;
        },
        validation: (result) => {
          expect(result.success).toBe(true);
          expect(result.data.id).toBe('workflow-test-prd');
        }
      });

      // Step 2: Architect reviews and updates architecture
      workflowSteps.push({
        step: '架构师完善系统架构',
        actor: workflowUsers.architect,
        action: async () => {
          const architectureUpdate = `
## 系统架构

\`\`\`mermaid
graph TD
    A[前端应用] --> B[API网关]
    B --> C[用户服务]
    B --> D[业务服务]
    B --> E[数据服务]
    C --> F[用户数据库]
    D --> G[业务数据库]
    E --> H[数据仓库]

    subgraph "微服务架构"
      C
      D
      E
    end
\`\`\`

### 技术选型
- 前端：React + TypeScript
- 后端：Node.js + Express
- 数据库：PostgreSQL + Redis
- 部署：Docker + Kubernetes
          `;

          return await documentService.updateDraftSection(
            draftId,
            'architecture',
            architectureUpdate,
            workflowUsers.architect.id
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 3: Developer updates implementation plan
      workflowSteps.push({
        step: '开发人员补充实现方案',
        actor: workflowUsers.developer,
        action: async () => {
          const implementationPlan = `
## 实现方案

### 开发阶段
1. **第一阶段**：用户管理模块
   - 用户注册、登录、权限管理
   - 预计时间：2周

2. **第二阶段**：核心业务功能
   - 数据录入和管理界面
   - 业务逻辑实现
   - 预计时间：4周

3. **第三阶段**：报表和分析
   - 数据可视化
   - 报表生成
   - 预计时间：3周

### 技术风险
- 数据迁移复杂度较高
- 第三方 API 集成需要测试
- 性能优化需要专门时间

### 依赖项
- UI/UX 设计完成
- 数据库架构确认
- 第三方服务接口确认
          `;

          return await documentService.updateDraftSection(
            draftId,
            'implementation',
            implementationPlan,
            workflowUsers.developer.id
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 4: Tester adds testing strategy
      workflowSteps.push({
        step: '测试人员添加测试策略',
        actor: workflowUsers.tester,
        action: async () => {
          const testingStrategy = `
## 测试策略

### 测试类型
1. **单元测试**
   - 覆盖率目标：85%
   - 工具：Jest + React Testing Library

2. **集成测试**
   - API 接口测试
   - 数据库集成测试
   - 工具：Supertest + Vitest

3. **端到端测试**
   - 关键用户流程测试
   - 工具：Playwright

4. **性能测试**
   - 负载测试
   - 压力测试
   - 工具：K6

### 测试环境
- 开发环境：日常开发测试
- 测试环境：集成测试和 UAT
- 预发布环境：性能测试和最终验证

### 质量标准
- 功能测试通过率：100%
- 性能要求：响应时间 < 2s
- 安全扫描：无高危漏洞
          `;

          return await documentService.updateDraftSection(
            draftId,
            'testing',
            testingStrategy,
            workflowUsers.tester.id
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 5: Create version snapshot before review
      workflowSteps.push({
        step: '创建评审前版本快照',
        actor: workflowUsers.productManager,
        action: async () => {
          return await versionService.createVersion({
            draftId,
            version: '1.0.0-review',
            message: '提交评审版本，所有章节已完成',
            changes: [
              { type: 'create', section: 'all', description: '创建完整 PRD 文档' }
            ],
            author: workflowUsers.productManager.id
          });
        },
        validation: (result) => {
          expect(result.success).toBe(true);
          expect(result.data.version).toBe('1.0.0-review');
        }
      });

      // Step 6: Submit for review
      workflowSteps.push({
        step: '提交评审',
        actor: workflowUsers.productManager,
        action: async () => {
          return await documentService.submitForReview(
            draftId,
            {
              reviewers: [workflowUsers.reviewer.id, workflowUsers.architect.id],
              message: 'PRD 文档已完成，请审核',
              priority: 'high',
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            },
            workflowUsers.productManager.id
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
          expect(result.data.status).toBe('in_review');
        }
      });

      // Step 7: First reviewer requests changes
      workflowSteps.push({
        step: '评审者要求修改',
        actor: workflowUsers.reviewer,
        action: async () => {
          return await documentService.submitReviewDecision(
            draftId,
            {
              decision: 'request_changes',
              comments: '架构部分需要添加安全考虑，测试策略需要补充自动化测试时间安排',
              sections: {
                architecture: '需要添加安全架构设计',
                testing: '需要明确自动化测试的时间安排'
              },
              reviewer: workflowUsers.reviewer.id
            }
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 8: Address review comments
      workflowSteps.push({
        step: '处理评审意见',
        actor: workflowUsers.architect,
        action: async () => {
          const securityAddition = `

### 安全架构设计

\`\`\`mermaid
graph TD
    A[用户请求] --> B[防火墙]
    B --> C[负载均衡器]
    C --> D[API网关 + JWT验证]
    D --> E[业务服务]
    E --> F[数据加密层]
    F --> G[数据库]

    subgraph "安全层"
      D
      F
    end
\`\`\`

#### 安全措施
- JWT Token 认证
- HTTPS 加密传输
- 数据库字段加密
- SQL 注入防护
- XSS 攻击防护
- 权限控制和审计日志
          `;

          const currentArchitecture = await documentService.getDraftSection(draftId, 'architecture');
          const updatedArchitecture = currentArchitecture + securityAddition;

          return await documentService.updateDraftSection(
            draftId,
            'architecture',
            updatedArchitecture,
            workflowUsers.architect.id
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 9: Update testing timeline
      workflowSteps.push({
        step: '更新测试时间安排',
        actor: workflowUsers.tester,
        action: async () => {
          const timelineAddition = `

### 自动化测试时间安排

#### 第一阶段自动化（第1-2周）
- 单元测试框架搭建
- 核心业务逻辑单元测试
- CI/CD 集成

#### 第二阶段自动化（第3-5周）
- API 集成测试开发
- 数据库测试自动化
- 测试环境自动部署

#### 第三阶段自动化（第6-8周）
- 端到端测试场景开发
- 性能测试自动化
- 回归测试套件完善

#### 持续改进（第9周+）
- 测试覆盖率优化
- 测试执行时间优化
- 测试报告自动化
          `;

          const currentTesting = await documentService.getDraftSection(draftId, 'testing');
          const updatedTesting = currentTesting + timelineAddition;

          return await documentService.updateDraftSection(
            draftId,
            'testing',
            updatedTesting,
            workflowUsers.tester.id
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 10: Create revision version
      workflowSteps.push({
        step: '创建修订版本',
        actor: workflowUsers.productManager,
        action: async () => {
          currentVersion = '1.1.0';
          return await versionService.createVersion({
            draftId,
            version: currentVersion,
            message: '根据评审意见更新，添加安全设计和测试时间安排',
            changes: [
              { type: 'update', section: 'architecture', description: '添加安全架构设计' },
              { type: 'update', section: 'testing', description: '补充自动化测试时间安排' }
            ],
            author: workflowUsers.productManager.id
          });
        },
        validation: (result) => {
          expect(result.success).toBe(true);
          expect(result.data.version).toBe('1.1.0');
        }
      });

      // Step 11: Second review approval
      workflowSteps.push({
        step: '第二轮评审通过',
        actor: workflowUsers.reviewer,
        action: async () => {
          return await documentService.submitReviewDecision(
            draftId,
            {
              decision: 'approve',
              comments: '所有评审意见已处理，文档质量良好，同意通过',
              reviewer: workflowUsers.reviewer.id
            }
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 12: Architect approval
      workflowSteps.push({
        step: '架构师审批',
        actor: workflowUsers.architect,
        action: async () => {
          return await documentService.submitReviewDecision(
            draftId,
            {
              decision: 'approve',
              comments: '技术架构合理，安全考虑充分，同意实施',
              reviewer: workflowUsers.architect.id
            }
          );
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Step 13: Final approval and publish
      workflowSteps.push({
        step: '最终批准并发布',
        actor: workflowUsers.productManager,
        action: async () => {
          // Update status to approved
          const currentDraft = await documentService.getDraft(draftId);
          const approvedDraft = {
            ...currentDraft!,
            status: 'approved' as const,
            approvedAt: new Date(),
            approvedBy: workflowUsers.productManager.id
          };

          return await documentService.updateDraft(draftId, approvedDraft);
        },
        validation: (result) => {
          expect(result.success).toBe(true);
        }
      });

      // Execute all workflow steps
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];

        console.log(`执行步骤 ${i + 1}: ${step.step} (执行者: ${step.actor.name})`);

        const result = await step.action();
        step.validation(result);

        // Log audit event
        await permissionService.logAuditEvent(
          step.actor.id,
          step.step,
          draftId,
          { success: true, timestamp: new Date(), step: i + 1 }
        );
      }

      // Final validation: Verify complete workflow
      const finalDraft = await documentService.getDraft(draftId);
      const versionHistory = await versionService.getVersionHistory(draftId);
      const auditLog = await permissionService.getAuditLog({ resource: draftId });

      expect(finalDraft!.status).toBe('approved');
      expect(versionHistory).toHaveLength(2); // 1.0.0-review and 1.1.0
      expect(auditLog.length).toBeGreaterThan(10); // Multiple audit events

      // Test document rendering with all components
      const finalRendering = await documentService.renderDocument(draftId, {
        includeDiagrams: true,
        includeVersionInfo: true,
        includeAuditTrail: true
      });

      expect(finalRendering.success).toBe(true);
      expect(finalRendering.html).toContain('mermaid');
      expect(finalRendering.html).toContain('安全架构');
      expect(finalRendering.html).toContain('自动化测试');
    });

    it('应该支持并行协作和冲突解决', async () => {
      // Create draft
      const collaborativeDraft: PRDDraft = {
        id: 'collaborative-draft',
        title: '协作测试文档',
        description: '测试多用户并行编辑',
        content: {
          overview: '初始概述',
          requirements: '初始需求',
          architecture: '初始架构',
          implementation: '初始实现',
          testing: '初始测试'
        },
        templateId: 'comprehensive-prd-template',
        author: workflowUsers.productManager.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['协作测试'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(collaborativeDraft);

      // Simulate concurrent edits
      const concurrentEdits = [
        {
          user: workflowUsers.productManager,
          section: 'overview',
          content: '产品经理更新的概述内容'
        },
        {
          user: workflowUsers.architect,
          section: 'architecture',
          content: '架构师设计的系统架构'
        },
        {
          user: workflowUsers.developer,
          section: 'implementation',
          content: '开发者制定的实现方案'
        },
        {
          user: workflowUsers.tester,
          section: 'testing',
          content: '测试人员设计的测试策略'
        }
      ];

      // Execute concurrent edits
      const editPromises = concurrentEdits.map(edit =>
        documentService.updateDraftSection(
          'collaborative-draft',
          edit.section,
          edit.content,
          edit.user.id
        )
      );

      const editResults = await Promise.allSettled(editPromises);

      // All edits should succeed (no conflicts in different sections)
      for (const result of editResults) {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      }

      // Verify all changes were applied
      const updatedDraft = await documentService.getDraft('collaborative-draft');
      expect(updatedDraft!.content.overview).toBe('产品经理更新的概述内容');
      expect(updatedDraft!.content.architecture).toBe('架构师设计的系统架构');
      expect(updatedDraft!.content.implementation).toBe('开发者制定的实现方案');
      expect(updatedDraft!.content.testing).toBe('测试人员设计的测试策略');
    });

    it('应该处理复杂的权限和评审流程', async () => {
      // Create draft with complex permissions
      const complexDraft: PRDDraft = {
        id: 'complex-permissions-draft',
        title: '复杂权限测试',
        description: '测试复杂权限和评审流程',
        content: {
          overview: '需要产品经理权限',
          architecture: '需要架构师权限',
          implementation: '需要开发者权限',
          testing: '需要测试人员权限'
        },
        templateId: 'comprehensive-prd-template',
        author: workflowUsers.productManager.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['复杂权限'],
        permissions: {
          read: ['product_manager', 'architect', 'developer', 'tester'],
          write: ['product_manager'],
          review: ['architect'],
          approve: ['product_manager']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(complexDraft);

      // Test section-level permission enforcement
      const permissionTests = [
        {
          user: workflowUsers.developer,
          section: 'overview',
          shouldFail: true,
          description: '开发者不能编辑概述'
        },
        {
          user: workflowUsers.architect,
          section: 'architecture',
          shouldFail: false,
          description: '架构师可以编辑架构'
        },
        {
          user: workflowUsers.tester,
          section: 'implementation',
          shouldFail: true,
          description: '测试人员不能编辑实现方案'
        }
      ];

      for (const test of permissionTests) {
        try {
          const result = await documentService.updateDraftSection(
            'complex-permissions-draft',
            test.section,
            `${test.user.name}的更新`,
            test.user.id
          );

          if (test.shouldFail) {
            expect.fail(`${test.description}应该失败，但成功了`);
          } else {
            expect(result.success).toBe(true);
          }
        } catch (error) {
          if (!test.shouldFail) {
            expect.fail(`${test.description}应该成功，但失败了: ${error}`);
          }
          // Expected failure
          expect(error).toBeDefined();
        }
      }

      // Test multi-stage review process
      await documentService.submitForReview(
        'complex-permissions-draft',
        {
          reviewers: [workflowUsers.architect.id],
          message: '复杂权限文档评审',
          priority: 'normal'
        },
        workflowUsers.productManager.id
      );

      // Architect review
      await documentService.submitReviewDecision(
        'complex-permissions-draft',
        {
          decision: 'approve',
          comments: '架构部分通过评审',
          reviewer: workflowUsers.architect.id
        }
      );

      // Final approval by product manager
      const finalDraft = await documentService.getDraft('complex-permissions-draft');
      const approvedDraft = {
        ...finalDraft!,
        status: 'approved' as const,
        approvedAt: new Date(),
        approvedBy: workflowUsers.productManager.id
      };

      const approvalResult = await documentService.updateDraft('complex-permissions-draft', approvedDraft);
      expect(approvalResult.success).toBe(true);
    });
  });

  describe('Performance Requirements Validation', () => {
    it('应该满足大型文档的性能要求', async () => {
      // Create large document
      const largeContent = {
        overview: 'A'.repeat(10000), // 10KB content
        requirements: 'B'.repeat(20000), // 20KB content
        architecture: `
## 大型系统架构

\`\`\`mermaid
graph TD
${Array.from({ length: 50 }, (_, i) => `
  A${i}[服务${i}] --> B${i}[数据库${i}]
  B${i} --> C${i}[缓存${i}]
`).join('\n')}
\`\`\`
        `,
        implementation: 'C'.repeat(30000), // 30KB content
        testing: 'D'.repeat(15000) // 15KB content
      };

      const largeDraft: PRDDraft = {
        id: 'large-performance-test',
        title: '大型文档性能测试',
        description: '测试大型文档的处理性能',
        content: largeContent,
        templateId: 'comprehensive-prd-template',
        author: workflowUsers.productManager.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['性能测试'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Test creation performance
      const createStart = Date.now();
      const createResult = await documentService.createDraft(largeDraft);
      const createTime = Date.now() - createStart;

      expect(createResult.success).toBe(true);
      expect(createTime).toBeLessThan(2000); // Should create within 2 seconds

      // Test read performance
      const readStart = Date.now();
      const readResult = await documentService.getDraft('large-performance-test');
      const readTime = Date.now() - readStart;

      expect(readResult).toBeDefined();
      expect(readTime).toBeLessThan(1000); // Should read within 1 second

      // Test rendering performance
      const renderStart = Date.now();
      const renderResult = await documentService.renderDocument('large-performance-test', {
        includeDiagrams: true
      });
      const renderTime = Date.now() - renderStart;

      expect(renderResult.success).toBe(true);
      expect(renderTime).toBeLessThan(5000); // Should render within 5 seconds

      // Test update performance
      const updateStart = Date.now();
      const updateResult = await documentService.updateDraftSection(
        'large-performance-test',
        'overview',
        'Updated large overview content',
        workflowUsers.productManager.id
      );
      const updateTime = Date.now() - updateStart;

      expect(updateResult.success).toBe(true);
      expect(updateTime).toBeLessThan(1500); // Should update within 1.5 seconds
    });

    it('应该支持批量操作的性能优化', async () => {
      const batchSize = 20;
      const drafts: PRDDraft[] = [];

      // Create batch of drafts
      for (let i = 0; i < batchSize; i++) {
        drafts.push({
          id: `batch-test-${i}`,
          title: `批量测试文档 ${i}`,
          description: `第 ${i} 个批量测试文档`,
          content: {
            overview: `文档 ${i} 的概述内容`,
            requirements: `文档 ${i} 的需求分析`
          },
          templateId: 'comprehensive-prd-template',
          author: workflowUsers.productManager.id,
          status: 'draft',
          version: '1.0.0',
          tags: [`batch-${i}`],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Test batch creation
      const batchCreateStart = Date.now();
      const batchCreatePromises = drafts.map(draft =>
        documentService.createDraft(draft)
      );
      const batchCreateResults = await Promise.all(batchCreatePromises);
      const batchCreateTime = Date.now() - batchCreateStart;

      // All should succeed
      for (const result of batchCreateResults) {
        expect(result.success).toBe(true);
      }

      // Performance requirement: batch operations should be efficient
      const avgTimePerDraft = batchCreateTime / batchSize;
      expect(avgTimePerDraft).toBeLessThan(200); // Average 200ms per draft

      // Test batch reading
      const batchReadStart = Date.now();
      const batchReadPromises = drafts.map(draft =>
        documentService.getDraft(draft.id)
      );
      const batchReadResults = await Promise.all(batchReadPromises);
      const batchReadTime = Date.now() - batchReadStart;

      // All should be found
      for (const result of batchReadResults) {
        expect(result).toBeDefined();
      }

      const avgReadTimePerDraft = batchReadTime / batchSize;
      expect(avgReadTimePerDraft).toBeLessThan(100); // Average 100ms per read
    });

    it('应该在高并发场景下保持性能', async () => {
      const concurrencyLevel = 10;
      const operationsPerLevel = 5;

      // Create base draft for concurrent operations
      const baseDraft: PRDDraft = {
        id: 'concurrency-test',
        title: '并发测试文档',
        description: '高并发场景性能测试',
        content: {
          overview: '并发测试概述',
          requirements: '并发测试需求'
        },
        templateId: 'comprehensive-prd-template',
        author: workflowUsers.productManager.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['并发测试'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(baseDraft);

      // Simulate high concurrency
      const concurrentOperations: Promise<any>[] = [];

      for (let level = 0; level < concurrencyLevel; level++) {
        for (let op = 0; op < operationsPerLevel; op++) {
          const operationType = op % 3;

          switch (operationType) {
            case 0: // Read operation
              concurrentOperations.push(
                documentService.getDraft('concurrency-test')
              );
              break;

            case 1: // Version check
              concurrentOperations.push(
                versionService.getVersionHistory('concurrency-test')
              );
              break;

            case 2: // Permission check
              concurrentOperations.push(
                permissionService.checkPermission(
                  workflowUsers.productManager.id,
                  'read',
                  'document',
                  'concurrency-test'
                )
              );
              break;
          }
        }
      }

      // Execute all concurrent operations
      const concurrentStart = Date.now();
      const concurrentResults = await Promise.allSettled(concurrentOperations);
      const concurrentTime = Date.now() - concurrentStart;

      // Most operations should succeed
      const successCount = concurrentResults.filter(
        result => result.status === 'fulfilled'
      ).length;

      const successRate = successCount / concurrentResults.length;
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate

      // Performance under load
      const avgTimePerOperation = concurrentTime / concurrentOperations.length;
      expect(avgTimePerOperation).toBeLessThan(300); // Average 300ms per operation under load

      console.log(`并发测试结果：
        - 总操作数：${concurrentOperations.length}
        - 成功率：${(successRate * 100).toFixed(1)}%
        - 总时间：${concurrentTime}ms
        - 平均每操作：${avgTimePerOperation.toFixed(1)}ms`);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('应该从系统故障中优雅恢复', async () => {
      // Create draft
      const resilientDraft: PRDDraft = {
        id: 'resilience-test',
        title: '系统恢复测试',
        description: '测试系统故障恢复能力',
        content: {
          overview: '恢复测试概述'
        },
        templateId: 'comprehensive-prd-template',
        author: workflowUsers.productManager.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['恢复测试'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(resilientDraft);

      // Simulate file corruption
      const draftPath = path.join(testDir, 'drafts', 'resilience-test.jsonl');
      await fs.writeFile(draftPath, 'corrupted data', 'utf-8');

      // System should detect corruption and attempt recovery
      try {
        const corruptedRead = await documentService.getDraft('resilience-test');
        expect.fail('Should have detected corruption');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Recreate document (recovery simulation)
      const recoveryResult = await documentService.createDraft(resilientDraft);
      expect(recoveryResult.success).toBe(true);

      // Verify recovery
      const recoveredDraft = await documentService.getDraft('resilience-test');
      expect(recoveredDraft).toBeDefined();
      expect(recoveredDraft!.title).toBe(resilientDraft.title);
    });

    it('应该提供数据一致性保证', async () => {
      const consistencyDraft: PRDDraft = {
        id: 'consistency-test',
        title: '数据一致性测试',
        description: '测试数据一致性保证',
        content: {
          overview: '一致性测试概述'
        },
        templateId: 'comprehensive-prd-template',
        author: workflowUsers.productManager.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['一致性测试'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(consistencyDraft);

      // Create version
      await versionService.createVersion({
        draftId: 'consistency-test',
        version: '1.1.0',
        message: '一致性测试版本',
        changes: [],
        author: workflowUsers.productManager.id
      });

      // Verify data consistency across services
      const draft = await documentService.getDraft('consistency-test');
      const versions = await versionService.getVersionHistory('consistency-test');
      const permissions = await permissionService.checkPermission(
        workflowUsers.productManager.id,
        'read',
        'document',
        'consistency-test'
      );

      expect(draft).toBeDefined();
      expect(versions).toHaveLength(1);
      expect(permissions).toBe(true);

      // All data should be consistent
      expect(draft!.id).toBe('consistency-test');
      expect(versions[0].draftId).toBe('consistency-test');
    });
  });
});