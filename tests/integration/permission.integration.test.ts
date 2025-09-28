/**
 * T007: 权限管理集成测试
 *
 * 测试不同角色用户的权限验证，确保安全控制正确实施
 * 测试场景包括：architect, product_manager, developer, tester, viewer角色
 *
 * 这个测试在TDD的Red阶段会失败，因为权限系统尚未实现
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync, mkdirSync, existsSync } from 'fs'

describe('PRD权限管理集成测试', () => {
  let testDir: string
  let configPath: string

  beforeEach(() => {
    testDir = join(tmpdir(), `prd-permission-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    configPath = join(testDir, 'prd-config.yaml')

    process.env.CODEX_FATHER_HOME = testDir
    process.env.PRD_CONFIG_PATH = configPath
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  test('architect角色：完整权限验证', async () => {
    // 设置architect用户
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.name "张架构师"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })

    // architect应该能够：
    // 1. 创建所有类型的PRD
    const technicalPrd = execSync(
      'prd create --title "技术架构PRD" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(technicalPrd).toContain('created successfully')

    const businessPrd = execSync(
      'prd create --title "业务需求PRD" --template business',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(businessPrd).toContain('created successfully')

    // 提取PRD ID
    const prdIdMatch = technicalPrd.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    // 2. 编辑所有章节
    const editOverview = execSync(
      `prd edit ${prdId} --section overview --message "架构师编辑概述"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(editOverview).toContain('Section updated successfully')

    const editArchitecture = execSync(
      `prd edit ${prdId} --section architecture --message "架构师编辑技术架构"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(editArchitecture).toContain('Section updated successfully')

    // 3. 提交和响应审查
    const submitReview = execSync(
      `prd review submit ${prdId} --reviewers "dev-team" --priority high`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(submitReview).toContain('Review submitted successfully')

    const respondReview = execSync(
      `prd review respond ${prdId} --decision "approved" --comment "架构设计合理"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(respondReview).toContain('Review response submitted')

    // 4. 版本管理操作
    const versionList = execSync(`prd version list ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(versionList).toContain('version 1')

    // 5. 删除PRD
    const deletePrd = execSync(`prd delete ${prdId} --confirm`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(deletePrd).toContain('deleted successfully')
  })

  test('product_manager角色：业务权限验证', async () => {
    // 设置product_manager用户
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.name "李产品"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "product_manager"', { cwd: testDir, env: process.env })

    // product_manager应该能够：
    // 1. 创建business和feature类型PRD
    const businessPrd = execSync(
      'prd create --title "产品需求PRD" --template business',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(businessPrd).toContain('created successfully')

    const featurePrd = execSync(
      'prd create --title "功能规格PRD" --template feature',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(featurePrd).toContain('created successfully')

    // 2. 不能创建technical类型PRD
    expect(() => {
      execSync('prd create --title "技术PRD" --template technical', {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*technical template/)

    const prdIdMatch = businessPrd.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    // 3. 可以编辑business相关章节
    const editRequirements = execSync(
      `prd edit ${prdId} --section requirements --message "产品经理编辑需求"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(editRequirements).toContain('Section updated successfully')

    // 4. 不能编辑architecture章节
    expect(() => {
      execSync(`prd edit ${prdId} --section architecture --message "尝试编辑架构"`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*architecture section/)

    // 5. 可以提交审查给技术团队
    const submitReview = execSync(
      `prd review submit ${prdId} --reviewers "tech-team" --priority medium`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(submitReview).toContain('Review submitted successfully')
  })

  test('developer角色：开发权限验证', async () => {
    // 设置developer用户
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.name "王开发"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "developer"', { cwd: testDir, env: process.env })

    // 先用architect角色创建PRD供测试
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })
    const createOutput = execSync(
      'prd create --title "开发测试PRD" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    // 恢复developer角色
    execSync('prd config set user.role "developer"', { cwd: testDir, env: process.env })

    // developer应该能够：
    // 1. 查看所有PRD
    const listOutput = execSync('prd list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(listOutput).toContain('开发测试PRD')

    const showOutput = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(showOutput).toContain('开发测试PRD')

    // 2. 不能创建PRD
    expect(() => {
      execSync('prd create --title "开发者PRD" --template feature', {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*create PRD/)

    // 3. 不能编辑PRD内容
    expect(() => {
      execSync(`prd edit ${prdId} --section implementation --message "开发者编辑"`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*edit PRD/)

    // 4. 可以响应审查请求
    const respondReview = execSync(
      `prd review respond ${prdId} --decision "changes_requested" --comment "实现难度较高，建议简化"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(respondReview).toContain('Review response submitted')

    // 5. 可以查看版本历史
    const versionList = execSync(`prd version list ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(versionList).toContain('version')
  })

  test('tester角色：测试权限验证', async () => {
    // 设置tester用户
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.name "赵测试"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "tester"', { cwd: testDir, env: process.env })

    // 先创建PRD供测试
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })
    const createOutput = execSync(
      'prd create --title "测试PRD" --template feature',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    execSync('prd config set user.role "tester"', { cwd: testDir, env: process.env })

    // tester应该能够：
    // 1. 查看所有PRD（只读权限）
    const listOutput = execSync('prd list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(listOutput).toContain('测试PRD')

    // 2. 不能创建PRD
    expect(() => {
      execSync('prd create --title "测试者PRD" --template feature', {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*create PRD/)

    // 3. 可以编辑测试相关章节
    const editTesting = execSync(
      `prd edit ${prdId} --section testing --message "测试人员添加测试计划"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(editTesting).toContain('Section updated successfully')

    // 4. 不能编辑其他章节
    expect(() => {
      execSync(`prd edit ${prdId} --section requirements --message "尝试编辑需求"`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*requirements section/)

    // 5. 可以参与审查流程
    const respondReview = execSync(
      `prd review respond ${prdId} --decision "changes_requested" --comment "测试用例不够完整"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(respondReview).toContain('Review response submitted')
  })

  test('viewer角色：只读权限验证', async () => {
    // 设置viewer用户
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.name "观察者"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "viewer"', { cwd: testDir, env: process.env })

    // 先创建PRD供测试
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })
    const createOutput = execSync(
      'prd create --title "观察者测试PRD" --template business',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    execSync('prd config set user.role "viewer"', { cwd: testDir, env: process.env })

    // viewer应该能够：
    // 1. 查看PRD列表和内容
    const listOutput = execSync('prd list', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(listOutput).toContain('观察者测试PRD')

    const showOutput = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(showOutput).toContain('观察者测试PRD')

    // 2. 查看版本历史
    const versionList = execSync(`prd version list ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(versionList).toContain('version')

    // 3. 不能创建PRD
    expect(() => {
      execSync('prd create --title "观察者PRD" --template business', {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*create PRD/)

    // 4. 不能编辑任何内容
    expect(() => {
      execSync(`prd edit ${prdId} --section overview --message "观察者尝试编辑"`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*edit PRD/)

    // 5. 不能删除PRD
    expect(() => {
      execSync(`prd delete ${prdId} --confirm`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*delete PRD/)

    // 6. 不能参与审查流程
    expect(() => {
      execSync(`prd review submit ${prdId} --reviewers "someone"`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*submit review/)

    expect(() => {
      execSync(`prd review respond ${prdId} --decision "approved"`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied.*respond review/)
  })

  test('角色切换和权限验证', async () => {
    execSync('prd config init', { cwd: testDir, env: process.env })

    // 测试从高权限到低权限的切换
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })

    // 以architect身份创建PRD
    const createOutput = execSync(
      'prd create --title "权限测试PRD" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    // 切换到developer角色
    execSync('prd config set user.role "developer"', { cwd: testDir, env: process.env })

    // 应该不能编辑PRD
    expect(() => {
      execSync(`prd edit ${prdId} --section overview --message "开发者尝试编辑"`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Permission denied/)

    // 切换回architect角色
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })

    // 应该能够重新编辑
    const editOutput = execSync(
      `prd edit ${prdId} --section overview --message "架构师重新编辑"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(editOutput).toContain('Section updated successfully')
  })

  test('敏感操作需要确认', async () => {
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })

    const createOutput = execSync(
      'prd create --title "删除测试PRD" --template business',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    // 删除操作需要确认
    expect(() => {
      execSync(`prd delete ${prdId}`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/requires confirmation/)

    // 带确认的删除应该成功
    const deleteOutput = execSync(`prd delete ${prdId} --confirm`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(deleteOutput).toContain('deleted successfully')

    // 版本回滚也需要确认
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })
    const newCreateOutput = execSync(
      'prd create --title "回滚测试PRD" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const newPrdId = newCreateOutput.match(/ID: (\w+-\w+)/)![1]

    expect(() => {
      execSync(`prd version restore ${newPrdId} 1`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/requires confirmation/)
  })
})