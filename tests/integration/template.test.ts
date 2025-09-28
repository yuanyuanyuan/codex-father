/**
 * T009: 模板系统集成测试
 *
 * 测试不同模板的创建、使用和自定义功能
 * 对应quickstart.md中的模板使用场景和验证清单中的模板系统验证
 *
 * 这个测试在TDD的Red阶段会失败，因为模板系统尚未实现
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

describe('PRD模板系统集成测试', () => {
  let testDir: string;
  let configPath: string;
  let templatesDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `prd-template-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    configPath = join(testDir, 'prd-config.yaml');
    templatesDir = join(testDir, 'templates');

    process.env.CODEX_FATHER_HOME = testDir;
    process.env.PRD_CONFIG_PATH = configPath;
    process.env.PRD_TEMPLATES_DIR = templatesDir;

    // 初始化基本配置
    execSync('prd config init', { cwd: testDir, env: process.env });
    execSync('prd config set user.name "模板测试员"', { cwd: testDir, env: process.env });
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('内置模板列表和结构验证', async () => {
    // 查看可用模板列表
    const templateList = execSync('prd template list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    // 验证包含所有内置模板
    expect(templateList).toContain('technical');
    expect(templateList).toContain('business');
    expect(templateList).toContain('feature');
    expect(templateList).toContain('Technical Architecture PRD');
    expect(templateList).toContain('Business Requirements PRD');
    expect(templateList).toContain('Feature Specification PRD');

    // 获取模板详细信息
    const technicalTemplate = execSync('prd template show technical', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(technicalTemplate).toContain('Technical Architecture PRD');
    expect(technicalTemplate).toContain('Sections:');
    expect(technicalTemplate).toContain('overview');
    expect(technicalTemplate).toContain('architecture');
    expect(technicalTemplate).toContain('implementation');
    expect(technicalTemplate).toContain('security');
    expect(technicalTemplate).toContain('performance');
    expect(technicalTemplate).toContain('testing');

    const businessTemplate = execSync('prd template show business', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(businessTemplate).toContain('Business Requirements PRD');
    expect(businessTemplate).toContain('market');
    expect(businessTemplate).toContain('requirements');
    expect(businessTemplate).toContain('stakeholders');
    expect(businessTemplate).toContain('success_metrics');
    expect(businessTemplate).toContain('timeline');

    const featureTemplate = execSync('prd template show feature', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(featureTemplate).toContain('Feature Specification PRD');
    expect(featureTemplate).toContain('feature');
    expect(featureTemplate).toContain('user_stories');
    expect(featureTemplate).toContain('acceptance');
    expect(featureTemplate).toContain('dependencies');
    expect(featureTemplate).toContain('risks');
  });

  test('technical模板PRD创建和结构验证', async () => {
    // 使用technical模板创建PRD
    const createOutput = execSync(
      'prd create --title "微服务架构设计" --template technical --description "设计高可用微服务架构"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/);
    const prdId = prdIdMatch![1];

    // 查看创建的PRD结构
    const prdContent = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    // 验证technical模板的所有章节都已创建
    expect(prdContent).toContain('微服务架构设计');
    expect(prdContent).toContain('1. 概述 (Overview)');
    expect(prdContent).toContain('2. 技术架构 (Architecture)');
    expect(prdContent).toContain('3. 实施方案 (Implementation)');
    expect(prdContent).toContain('4. 安全考虑 (Security)');
    expect(prdContent).toContain('5. 性能指标 (Performance)');
    expect(prdContent).toContain('6. 测试策略 (Testing)');

    // 验证模板提供的默认内容
    expect(prdContent).toContain('### 背景');
    expect(prdContent).toContain('### 目标');
    expect(prdContent).toContain('### 系统架构');
    expect(prdContent).toContain('### 技术选型');
    expect(prdContent).toContain('### 部署策略');
    expect(prdContent).toContain('### 安全策略');
    expect(prdContent).toContain('### 性能要求');
    expect(prdContent).toContain('### 测试计划');

    // 验证Markdown格式输出
    const markdownContent = execSync(`prd show ${prdId} --format markdown`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(markdownContent).toContain('# 微服务架构设计 PRD');
    expect(markdownContent).toContain('```mermaid');
    expect(markdownContent).toContain('| 指标 | 目标值 |');
    expect(markdownContent).toContain('| ---- | ------ |');
  });

  test('business模板PRD创建和业务内容验证', async () => {
    // 切换到产品经理角色
    execSync('prd config set user.role "product_manager"', { cwd: testDir, env: process.env });

    // 使用business模板创建PRD
    const createOutput = execSync(
      'prd create --title "移动支付功能" --template business --description "为APP添加移动支付能力"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1];

    // 查看business模板生成的结构
    const prdContent = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    // 验证business模板的章节结构
    expect(prdContent).toContain('移动支付功能');
    expect(prdContent).toContain('1. 市场分析 (Market)');
    expect(prdContent).toContain('2. 业务需求 (Requirements)');
    expect(prdContent).toContain('3. 利益相关者 (Stakeholders)');
    expect(prdContent).toContain('4. 成功指标 (Success Metrics)');
    expect(prdContent).toContain('5. 时间规划 (Timeline)');

    // 验证business模板特有的内容结构
    expect(prdContent).toContain('### 市场机会');
    expect(prdContent).toContain('### 竞品分析');
    expect(prdContent).toContain('### 功能需求');
    expect(prdContent).toContain('### 非功能需求');
    expect(prdContent).toContain('### 内部团队');
    expect(prdContent).toContain('### 外部伙伴');
    expect(prdContent).toContain('### KPI指标');
    expect(prdContent).toContain('### 里程碑');

    // 验证业务相关的表格和结构
    const markdownContent = execSync(`prd show ${prdId} --format markdown`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(markdownContent).toContain('| 竞品 | 优势 | 劣势 |');
    expect(markdownContent).toContain('| KPI | 目标值 | 时间点 |');
    expect(markdownContent).toContain('| 阶段 | 交付物 | 时间 |');
  });

  test('feature模板PRD创建和功能规格验证', async () => {
    // 使用feature模板创建PRD
    const createOutput = execSync(
      'prd create --title "智能推荐系统" --template feature --description "基于AI的个性化内容推荐"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1];

    const prdContent = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    // 验证feature模板的章节结构
    expect(prdContent).toContain('智能推荐系统');
    expect(prdContent).toContain('1. 功能描述 (Feature)');
    expect(prdContent).toContain('2. 用户故事 (User Stories)');
    expect(prdContent).toContain('3. 验收标准 (Acceptance)');
    expect(prdContent).toContain('4. 依赖关系 (Dependencies)');
    expect(prdContent).toContain('5. 风险评估 (Risks)');

    // 验证feature模板特有的内容结构
    expect(prdContent).toContain('### 核心功能');
    expect(prdContent).toContain('### 使用场景');
    expect(prdContent).toContain('### 用户角色');
    expect(prdContent).toContain('### 功能流程');
    expect(prdContent).toContain('### 验收条件');
    expect(prdContent).toContain('### 技术依赖');
    expect(prdContent).toContain('### 业务依赖');
    expect(prdContent).toContain('### 技术风险');
    expect(prdContent).toContain('### 业务风险');

    // 验证用户故事格式
    const markdownContent = execSync(`prd show ${prdId} --format markdown`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(markdownContent).toContain('作为 [用户角色]');
    expect(markdownContent).toContain('我希望 [功能描述]');
    expect(markdownContent).toContain('以便 [价值说明]');
    expect(markdownContent).toContain('| 依赖项 | 类型 | 状态 |');
    expect(markdownContent).toContain('| 风险 | 概率 | 影响 | 缓解措施 |');
  });

  test('自定义模板创建和使用', async () => {
    // 创建自定义模板
    const customTemplateOutput = execSync(
      'prd template create --name "security-audit" --title "安全审计报告" --description "安全评估和审计专用模板"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    expect(customTemplateOutput).toContain('Template created successfully');
    expect(customTemplateOutput).toContain('security-audit');

    // 为自定义模板添加章节
    execSync(
      'prd template section add security-audit --name "scope" --title "审计范围" --order 1',
      { cwd: testDir, env: process.env }
    );

    execSync(
      'prd template section add security-audit --name "vulnerabilities" --title "漏洞发现" --order 2',
      { cwd: testDir, env: process.env }
    );

    execSync(
      'prd template section add security-audit --name "recommendations" --title "改进建议" --order 3',
      { cwd: testDir, env: process.env }
    );

    execSync(
      'prd template section add security-audit --name "timeline" --title "修复时间线" --order 4',
      { cwd: testDir, env: process.env }
    );

    // 验证自定义模板在列表中
    const updatedTemplateList = execSync('prd template list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(updatedTemplateList).toContain('security-audit');
    expect(updatedTemplateList).toContain('安全审计报告');

    // 查看自定义模板详情
    const customTemplateDetail = execSync('prd template show security-audit', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(customTemplateDetail).toContain('安全审计报告');
    expect(customTemplateDetail).toContain('scope');
    expect(customTemplateDetail).toContain('vulnerabilities');
    expect(customTemplateDetail).toContain('recommendations');
    expect(customTemplateDetail).toContain('timeline');

    // 使用自定义模板创建PRD
    const createCustomPrdOutput = execSync(
      'prd create --title "API安全审计" --template security-audit --description "对REST API进行全面安全评估"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    const customPrdId = createCustomPrdOutput.match(/ID: (\w+-\w+)/)![1];

    // 验证自定义模板生成的PRD结构
    const customPrdContent = execSync(`prd show ${customPrdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(customPrdContent).toContain('API安全审计');
    expect(customPrdContent).toContain('1. 审计范围 (Scope)');
    expect(customPrdContent).toContain('2. 漏洞发现 (Vulnerabilities)');
    expect(customPrdContent).toContain('3. 改进建议 (Recommendations)');
    expect(customPrdContent).toContain('4. 修复时间线 (Timeline)');
  });

  test('模板字段自定义和验证', async () => {
    // 创建带有自定义字段的模板
    const customFieldsOutput = execSync(
      'prd template create --name "api-design" --title "API设计规范" --description "API设计和文档模板"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    expect(customFieldsOutput).toContain('Template created successfully');

    // 添加带有自定义字段的章节
    execSync(
      'prd template section add api-design --name "endpoints" --title "接口定义" --fields "method,path,parameters,response"',
      { cwd: testDir, env: process.env }
    );

    execSync(
      'prd template section add api-design --name "authentication" --title "认证方式" --fields "type,token_format,scope"',
      { cwd: testDir, env: process.env }
    );

    execSync(
      'prd template section add api-design --name "rate_limiting" --title "限流策略" --fields "limit,window,burst"',
      { cwd: testDir, env: process.env }
    );

    // 使用自定义字段模板创建PRD
    const createApiPrdOutput = execSync('prd create --title "用户管理API" --template api-design', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    const apiPrdId = createApiPrdOutput.match(/ID: (\w+-\w+)/)![1];

    // 验证自定义字段在PRD中的结构
    const apiPrdContent = execSync(`prd show ${apiPrdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(apiPrdContent).toContain('用户管理API');
    expect(apiPrdContent).toContain('接口定义');
    expect(apiPrdContent).toContain('Method:');
    expect(apiPrdContent).toContain('Path:');
    expect(apiPrdContent).toContain('Parameters:');
    expect(apiPrdContent).toContain('Response:');
    expect(apiPrdContent).toContain('认证方式');
    expect(apiPrdContent).toContain('Type:');
    expect(apiPrdContent).toContain('Token Format:');
    expect(apiPrdContent).toContain('Scope:');
    expect(apiPrdContent).toContain('限流策略');
    expect(apiPrdContent).toContain('Limit:');
    expect(apiPrdContent).toContain('Window:');
    expect(apiPrdContent).toContain('Burst:');

    // 编辑自定义字段
    const editFieldsOutput = execSync(
      `prd edit ${apiPrdId} --section endpoints --field method --value "POST,GET,PUT,DELETE"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    expect(editFieldsOutput).toContain('Field updated successfully');

    // 验证字段编辑结果
    const updatedContent = execSync(`prd show ${apiPrdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(updatedContent).toContain('Method: POST,GET,PUT,DELETE');
  });

  test('模板导入导出功能', async () => {
    // 导出内置模板
    const exportTechnicalOutput = execSync(
      `prd template export technical --output ${testDir}/technical-template.yaml`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    expect(exportTechnicalOutput).toContain('Template exported successfully');

    const exportedFile = join(testDir, 'technical-template.yaml');
    expect(existsSync(exportedFile)).toBe(true);

    // 验证导出的模板文件内容
    const exportedContent = readFileSync(exportedFile, 'utf8');
    expect(exportedContent).toContain('name: technical');
    expect(exportedContent).toContain('title: Technical Architecture PRD');
    expect(exportedContent).toContain('sections:');
    expect(exportedContent).toContain('overview');
    expect(exportedContent).toContain('architecture');

    // 修改导出的模板文件（创建变体）
    const modifiedTemplate = exportedContent
      .replace('name: technical', 'name: technical-extended')
      .replace('Technical Architecture PRD', 'Extended Technical Architecture PRD');

    const modifiedFile = join(testDir, 'technical-extended.yaml');
    writeFileSync(modifiedFile, modifiedTemplate);

    // 导入修改后的模板
    const importOutput = execSync(`prd template import --file ${modifiedFile}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(importOutput).toContain('Template imported successfully');
    expect(importOutput).toContain('technical-extended');

    // 验证导入的模板在列表中
    const templateList = execSync('prd template list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(templateList).toContain('technical-extended');
    expect(templateList).toContain('Extended Technical Architecture PRD');

    // 使用导入的模板创建PRD
    const createExtendedPrdOutput = execSync(
      'prd create --title "扩展架构设计" --template technical-extended',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    expect(createExtendedPrdOutput).toContain('created successfully');
  });

  test('模板权限和可见性控制', async () => {
    // architect角色创建私有模板
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env });
    const privateTemplateOutput = execSync(
      'prd template create --name "architect-only" --title "架构师专用模板" --visibility private',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    expect(privateTemplateOutput).toContain('Template created successfully');

    // 切换到product_manager角色
    execSync('prd config set user.role "product_manager"', { cwd: testDir, env: process.env });

    // product_manager不应该看到私有模板
    const pmTemplateList = execSync('prd template list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(pmTemplateList).not.toContain('architect-only');
    expect(pmTemplateList).toContain('business'); // 但应该看到适合的模板
    expect(pmTemplateList).toContain('feature');

    // product_manager不能使用私有模板
    expect(() => {
      execSync('prd create --title "测试" --template architect-only', {
        cwd: testDir,
        env: process.env,
      });
    }).toThrow(/Template not found or access denied/);

    // 切换回architect角色
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env });

    // architect应该能看到和使用私有模板
    const architectTemplateList = execSync('prd template list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });

    expect(architectTemplateList).toContain('architect-only');

    const usePrivateTemplateOutput = execSync(
      'prd create --title "私有模板测试" --template architect-only',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    );

    expect(usePrivateTemplateOutput).toContain('created successfully');
  });

  test('模板性能和缓存验证', async () => {
    // 测试模板列表查询性能 (< 200ms)
    const listStartTime = Date.now();
    execSync('prd template list', { cwd: testDir, env: process.env });
    const listTime = Date.now() - listStartTime;
    expect(listTime).toBeLessThan(200);

    // 测试模板详情查询性能 (< 100ms)
    const detailStartTime = Date.now();
    execSync('prd template show technical', { cwd: testDir, env: process.env });
    const detailTime = Date.now() - detailStartTime;
    expect(detailTime).toBeLessThan(100);

    // 测试使用模板创建PRD的性能 (< 1秒)
    const createStartTime = Date.now();
    execSync('prd create --title "性能测试PRD" --template business', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env,
    });
    const createTime = Date.now() - createStartTime;
    expect(createTime).toBeLessThan(1000);

    // 测试模板缓存：重复查询应该更快
    const cachedListStartTime = Date.now();
    execSync('prd template list', { cwd: testDir, env: process.env });
    const cachedListTime = Date.now() - cachedListStartTime;
    expect(cachedListTime).toBeLessThan(listTime); // 应该比第一次更快
  });

  test('模板错误处理和验证', async () => {
    // 测试使用不存在的模板
    expect(() => {
      execSync('prd create --title "错误测试" --template nonexistent', {
        cwd: testDir,
        env: process.env,
      });
    }).toThrow(/Template 'nonexistent' not found/);

    // 测试查看不存在的模板
    expect(() => {
      execSync('prd template show nonexistent', {
        cwd: testDir,
        env: process.env,
      });
    }).toThrow(/Template 'nonexistent' not found/);

    // 测试创建重复名称的模板
    execSync('prd template create --name "duplicate-test" --title "重复测试"', {
      cwd: testDir,
      env: process.env,
    });

    expect(() => {
      execSync('prd template create --name "duplicate-test" --title "另一个重复测试"', {
        cwd: testDir,
        env: process.env,
      });
    }).toThrow(/Template 'duplicate-test' already exists/);

    // 测试导入无效的模板文件
    const invalidTemplateFile = join(testDir, 'invalid-template.yaml');
    writeFileSync(invalidTemplateFile, 'invalid: yaml: content::');

    expect(() => {
      execSync(`prd template import --file ${invalidTemplateFile}`, {
        cwd: testDir,
        env: process.env,
      });
    }).toThrow(/Invalid template format/);

    // 测试导入不存在的文件
    expect(() => {
      execSync('prd template import --file /nonexistent/file.yaml', {
        cwd: testDir,
        env: process.env,
      });
    }).toThrow(/Template file not found/);
  });
});
