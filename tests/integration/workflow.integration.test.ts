/**
 * T006: 完整工作流程集成测试
 *
 * 测试quickstart.md中描述的完整PRD工作流程：
 * 配置初始化 → 创建PRD → 编辑内容 → 添加图表 → 提交审查
 *
 * 这个测试在TDD的Red阶段会失败，因为相应的功能尚未实现
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync, mkdirSync, existsSync } from 'fs'

describe('PRD完整工作流程集成测试', () => {
  let testDir: string
  let configPath: string

  beforeEach(() => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `prd-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    configPath = join(testDir, 'prd-config.yaml')

    // 设置测试环境变量
    process.env.CODEX_FATHER_HOME = testDir
    process.env.PRD_CONFIG_PATH = configPath
  })

  afterEach(() => {
    // 清理测试目录
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  test('完整工作流程：配置→创建→编辑→审查', async () => {
    // 1. 初始化配置 (2分钟场景)
    const initOutput = execSync('prd config init', {
      cwd: testDir,
      encoding: 'utf8',
      env: { ...process.env }
    })

    expect(initOutput).toContain('Configuration initialized successfully')
    expect(existsSync(configPath)).toBe(true)

    // 设置用户信息
    execSync('prd config set user.name "张三"', { cwd: testDir, env: process.env })
    execSync('prd config set user.email "zhangsan@example.com"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })

    // 验证配置
    const configOutput = execSync('prd config show', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(configOutput).toContain('张三 (architect)')
    expect(configOutput).toContain('zhangsan@example.com')

    // 2. 创建PRD草稿 (3分钟场景)
    // 查看可用模板
    const templatesOutput = execSync('prd template list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(templatesOutput).toContain('technical')
    expect(templatesOutput).toContain('business')
    expect(templatesOutput).toContain('feature')

    // 创建新PRD
    const createOutput = execSync(
      'prd create --title "用户认证系统重构" --template technical --description "重构现有用户认证，支持多因素认证"',
      {
        cwd: testDir,
        encoding: 'utf8',
        env: process.env
      }
    )

    expect(createOutput).toContain('PRD draft \'用户认证系统重构\' created successfully')
    expect(createOutput).toMatch(/ID: auth-\w+/)

    // 提取创建的PRD ID
    const prdIdMatch = createOutput.match(/ID: (auth-\w+)/)
    const prdId = prdIdMatch![1]

    // 查看PRD列表
    const listOutput = execSync('prd list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(listOutput).toContain('用户认证系统重构')
    expect(listOutput).toContain('draft')
    expect(listOutput).toContain('张三')

    // 3. 编辑PRD内容 (5分钟场景)
    // 查看草稿结构
    const showOutput = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(showOutput).toContain('用户认证系统重构')
    expect(showOutput).toContain('概述')
    expect(showOutput).toContain('技术架构')

    // 编辑概述部分
    const editOutput = execSync(
      `prd edit ${prdId} --section overview --message "添加认证系统概述"`,
      {
        cwd: testDir,
        encoding: 'utf8',
        env: process.env
      }
    )

    expect(editOutput).toContain('Section updated successfully')

    // 4. 添加技术决策和图表 (3分钟场景)
    // 添加架构图
    const architectureEditOutput = execSync(
      `prd edit ${prdId} --section architecture`,
      {
        cwd: testDir,
        encoding: 'utf8',
        env: process.env
      }
    )

    expect(architectureEditOutput).toContain('Section updated successfully')

    // 验证编辑后的内容包含Mermaid图表
    const markdownOutput = execSync(`prd show ${prdId} --format markdown`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(markdownOutput).toContain('mermaid')
    expect(markdownOutput).toContain('OAuth 2.0')
    expect(markdownOutput).toContain('系统架构')

    // 5. 提交审查 (2分钟场景)
    const reviewOutput = execSync(
      `prd review submit ${prdId} --reviewers "lisi,wangwu" --due-date "2025-10-05" --priority high --message "请重点关注安全性和技术可行性"`,
      {
        cwd: testDir,
        encoding: 'utf8',
        env: process.env
      }
    )

    expect(reviewOutput).toContain('Review submitted successfully')
    expect(reviewOutput).toMatch(/Review ID: review-\w+/)
    expect(reviewOutput).toContain('lisi, wangwu')
    expect(reviewOutput).toContain('2025-10-05')
    expect(reviewOutput).toContain('high')

    // 查看审查状态
    const statusOutput = execSync(`prd review status ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(statusOutput).toContain('in_review')
    expect(statusOutput).toContain('2 reviewers')
    expect(statusOutput).toContain('2 responses')
  })

  test('错误场景：权限不足时的处理', async () => {
    // 设置无权限的用户角色
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "viewer"', { cwd: testDir, env: process.env })

    // 尝试创建PRD应该失败
    expect(() => {
      execSync('prd create --title "测试PRD" --template technical', {
        cwd: testDir,
        env: process.env
      })
    }).toThrow()
  })

  test('性能基准：操作响应时间验证', async () => {
    // 初始化配置
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })

    // 测试PRD创建响应时间 (< 2秒)
    const startTime = Date.now()
    const createOutput = execSync(
      'prd create --title "性能测试PRD" --template technical',
      {
        cwd: testDir,
        encoding: 'utf8',
        env: process.env
      }
    )
    const createTime = Date.now() - startTime

    expect(createTime).toBeLessThan(2000) // < 2秒
    expect(createOutput).toContain('created successfully')

    // 提取PRD ID进行后续测试
    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    // 测试列表查询响应时间 (< 500ms)
    const listStartTime = Date.now()
    execSync('prd list', { cwd: testDir, env: process.env })
    const listTime = Date.now() - listStartTime

    expect(listTime).toBeLessThan(500) // < 500ms

    // 测试内容编辑响应时间 (< 1秒)
    const editStartTime = Date.now()
    execSync(`prd edit ${prdId} --section overview --message "性能测试编辑"`, {
      cwd: testDir,
      env: process.env
    })
    const editTime = Date.now() - editStartTime

    expect(editTime).toBeLessThan(1000) // < 1秒
  })
})