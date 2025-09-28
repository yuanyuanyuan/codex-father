/**
 * T008: 版本管理集成测试
 *
 * 测试PRD版本历史、对比、回滚等功能
 * 对应quickstart.md中"场景3: 版本管理和回滚"部分
 *
 * 这个测试在TDD的Red阶段会失败，因为版本管理系统尚未实现
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync, mkdirSync, existsSync } from 'fs'

describe('PRD版本管理集成测试', () => {
  let testDir: string
  let configPath: string

  beforeEach(() => {
    testDir = join(tmpdir(), `prd-version-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    configPath = join(testDir, 'prd-config.yaml')

    process.env.CODEX_FATHER_HOME = testDir
    process.env.PRD_CONFIG_PATH = configPath

    // 初始化基本配置
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.name "版本管理员"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  test('版本创建和历史追踪', async () => {
    // 创建初始PRD
    const createOutput = execSync(
      'prd create --title "版本管理测试PRD" --template technical --description "测试版本管理功能"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    const prdIdMatch = createOutput.match(/ID: (\w+-\w+)/)
    const prdId = prdIdMatch![1]

    // 验证初始版本 (版本1)
    const initialVersionList = execSync(`prd version list ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(initialVersionList).toContain('version 1')
    expect(initialVersionList).toContain('Initial creation')
    expect(initialVersionList).toContain('版本管理员')

    // 第一次编辑 - 添加概述 (版本2)
    const firstEdit = execSync(
      `prd edit ${prdId} --section overview --message "添加系统概述和背景"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(firstEdit).toContain('Section updated successfully')

    // 第二次编辑 - 添加架构图 (版本3)
    const secondEdit = execSync(
      `prd edit ${prdId} --section architecture --message "添加技术架构Mermaid图表"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(secondEdit).toContain('Section updated successfully')

    // 第三次编辑 - 修改实施计划 (版本4)
    const thirdEdit = execSync(
      `prd edit ${prdId} --section implementation --message "更新实施计划和时间安排"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    expect(thirdEdit).toContain('Section updated successfully')

    // 验证版本历史完整性
    const fullVersionList = execSync(`prd version list ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(fullVersionList).toContain('version 1')
    expect(fullVersionList).toContain('version 2')
    expect(fullVersionList).toContain('version 3')
    expect(fullVersionList).toContain('version 4')
    expect(fullVersionList).toContain('添加系统概述和背景')
    expect(fullVersionList).toContain('添加技术架构Mermaid图表')
    expect(fullVersionList).toContain('更新实施计划和时间安排')

    // 验证版本列表按时间倒序排列
    const versionLines = fullVersionList.split('\n').filter(line => line.includes('version'))
    expect(versionLines[0]).toContain('version 4') // 最新版本在前
    expect(versionLines[versionLines.length - 1]).toContain('version 1') // 最早版本在后
  })

  test('版本对比功能', async () => {
    // 创建PRD并进行多次编辑
    const createOutput = execSync(
      'prd create --title "版本对比测试" --template business',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 编辑生成多个版本
    execSync(
      `prd edit ${prdId} --section requirements --message "添加核心业务需求"`,
      { cwd: testDir, env: process.env }
    )

    execSync(
      `prd edit ${prdId} --section market --message "添加市场分析和竞品对比"`,
      { cwd: testDir, env: process.env }
    )

    execSync(
      `prd edit ${prdId} --section timeline --message "制定详细开发时间线"`,
      { cwd: testDir, env: process.env }
    )

    // 测试版本1到版本3的对比
    const diff1to3 = execSync(`prd version diff ${prdId} --from 1 --to 3`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(diff1to3).toContain('Version Comparison')
    expect(diff1to3).toContain('From: version 1')
    expect(diff1to3).toContain('To: version 3')
    expect(diff1to3).toContain('添加核心业务需求')
    expect(diff1to3).toContain('添加市场分析和竞品对比')
    expect(diff1to3).toContain('+ sections added')
    expect(diff1to3).toContain('requirements')
    expect(diff1to3).toContain('market')

    // 测试版本2到版本4的对比
    const diff2to4 = execSync(`prd version diff ${prdId} --from 2 --to 4`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(diff2to4).toContain('添加市场分析和竞品对比')
    expect(diff2to4).toContain('制定详细开发时间线')
    expect(diff2to4).toContain('market')
    expect(diff2to4).toContain('timeline')

    // 测试相邻版本对比 (版本3到版本4)
    const diff3to4 = execSync(`prd version diff ${prdId} --from 3 --to 4`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(diff3to4).toContain('制定详细开发时间线')
    expect(diff3to4).toContain('timeline')

    // 测试无差异对比 (版本2到版本2)
    const diffSame = execSync(`prd version diff ${prdId} --from 2 --to 2`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(diffSame).toContain('No differences found')
    expect(diffSame).toContain('version 2')
  })

  test('版本回滚功能', async () => {
    // 创建PRD并进行编辑
    const createOutput = execSync(
      'prd create --title "版本回滚测试" --template feature --description "测试版本回滚能力"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 创建多个版本
    execSync(
      `prd edit ${prdId} --section feature --message "添加功能详细描述"`,
      { cwd: testDir, env: process.env }
    )

    execSync(
      `prd edit ${prdId} --section acceptance --message "添加验收标准"`,
      { cwd: testDir, env: process.env }
    )

    // 错误的编辑 - 需要回滚
    execSync(
      `prd edit ${prdId} --section implementation --message "错误的实施方案，需要回滚"`,
      { cwd: testDir, env: process.env }
    )

    // 验证当前是版本4
    const beforeRollback = execSync(`prd show ${prdId} --version current`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(beforeRollback).toContain('错误的实施方案，需要回滚')

    // 回滚到版本2 (stable version)
    const rollbackOutput = execSync(
      `prd version restore ${prdId} 2 --message "回滚到稳定版本，重新设计实施方案" --confirm`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(rollbackOutput).toContain('Version restored successfully')
    expect(rollbackOutput).toContain('Current version: 5') // 回滚创建新版本
    expect(rollbackOutput).toContain('Restored from: version 2')

    // 验证回滚后的内容
    const afterRollback = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(afterRollback).toContain('添加功能详细描述') // 版本2的内容应该存在
    expect(afterRollback).not.toContain('添加验收标准') // 版本3的内容不应该存在
    expect(afterRollback).not.toContain('错误的实施方案') // 版本4的内容不应该存在

    // 验证版本历史记录完整
    const versionList = execSync(`prd version list ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(versionList).toContain('version 1')
    expect(versionList).toContain('version 2')
    expect(versionList).toContain('version 3')
    expect(versionList).toContain('version 4')
    expect(versionList).toContain('version 5') // 回滚创建的新版本
    expect(versionList).toContain('回滚到稳定版本，重新设计实施方案')
  })

  test('版本查看和内容访问', async () => {
    // 创建PRD
    const createOutput = execSync(
      'prd create --title "历史版本查看测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 编辑生成不同版本
    const version2Content = "版本2的架构设计内容"
    execSync(
      `prd edit ${prdId} --section architecture --message "${version2Content}"`,
      { cwd: testDir, env: process.env }
    )

    const version3Content = "版本3的安全考虑内容"
    execSync(
      `prd edit ${prdId} --section security --message "${version3Content}"`,
      { cwd: testDir, env: process.env }
    )

    // 查看特定版本内容
    const version1 = execSync(`prd show ${prdId} --version 1`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(version1).toContain('历史版本查看测试')
    expect(version1).not.toContain(version2Content)
    expect(version1).not.toContain(version3Content)

    const version2 = execSync(`prd show ${prdId} --version 2`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(version2).toContain('历史版本查看测试')
    expect(version2).toContain(version2Content)
    expect(version2).not.toContain(version3Content)

    const version3 = execSync(`prd show ${prdId} --version 3`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(version3).toContain('历史版本查看测试')
    expect(version3).toContain(version2Content)
    expect(version3).toContain(version3Content)

    // 查看当前版本 (应该等同于版本3)
    const current = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(current).toContain(version2Content)
    expect(current).toContain(version3Content)

    // 以Markdown格式查看特定版本
    const markdownVersion2 = execSync(`prd show ${prdId} --version 2 --format markdown`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    expect(markdownVersion2).toContain('# 历史版本查看测试')
    expect(markdownVersion2).toContain(version2Content)
  })

  test('版本元数据和统计信息', async () => {
    // 创建PRD
    const createOutput = execSync(
      'prd create --title "版本统计测试" --template business',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 不同用户进行编辑
    execSync('prd config set user.name "架构师A"', { cwd: testDir, env: process.env })
    execSync(
      `prd edit ${prdId} --section architecture --message "架构师的技术设计"`,
      { cwd: testDir, env: process.env }
    )

    execSync('prd config set user.name "产品经理B"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "product_manager"', { cwd: testDir, env: process.env })
    execSync(
      `prd edit ${prdId} --section requirements --message "产品经理的需求细化"`,
      { cwd: testDir, env: process.env }
    )

    execSync('prd config set user.name "测试工程师C"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "tester"', { cwd: testDir, env: process.env })
    execSync(
      `prd edit ${prdId} --section testing --message "测试工程师的测试计划"`,
      { cwd: testDir, env: process.env }
    )

    // 查看版本统计信息
    const versionStats = execSync(`prd version list ${prdId} --detailed`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(versionStats).toContain('架构师A')
    expect(versionStats).toContain('产品经理B')
    expect(versionStats).toContain('测试工程师C')
    expect(versionStats).toContain('架构师的技术设计')
    expect(versionStats).toContain('产品经理的需求细化')
    expect(versionStats).toContain('测试工程师的测试计划')

    // 版本大小统计
    expect(versionStats).toMatch(/Size:.*bytes/)
    expect(versionStats).toMatch(/Created:.*ago/)

    // 检查版本之间的变更统计
    const changeStats = execSync(`prd version diff ${prdId} --from 1 --to 4 --stats`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(changeStats).toContain('Changes Summary')
    expect(changeStats).toMatch(/\+.*sections added/)
    expect(changeStats).toMatch(/\+.*lines added/)
    expect(changeStats).toContain('3 contributors')
  })

  test('版本错误处理和边界情况', async () => {
    const createOutput = execSync(
      'prd create --title "版本错误测试" --template feature',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 测试不存在的版本号
    expect(() => {
      execSync(`prd show ${prdId} --version 999`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Version 999 not found/)

    expect(() => {
      execSync(`prd version diff ${prdId} --from 1 --to 999`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Version 999 not found/)

    // 测试无效的版本号
    expect(() => {
      execSync(`prd show ${prdId} --version invalid`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Invalid version number/)

    // 测试回滚到不存在的版本
    expect(() => {
      execSync(`prd version restore ${prdId} 999 --confirm`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Version 999 not found/)

    // 测试回滚需要确认
    expect(() => {
      execSync(`prd version restore ${prdId} 1`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/requires confirmation/)

    // 测试diff参数错误
    expect(() => {
      execSync(`prd version diff ${prdId} --from 2 --to 1`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/from version must be less than or equal to to version/)

    // 测试不存在的PRD ID
    expect(() => {
      execSync('prd version list nonexistent-prd', {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/PRD not found/)
  })

  test('版本性能要求验证', async () => {
    // 创建PRD
    const createOutput = execSync(
      'prd create --title "版本性能测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 创建多个版本
    for (let i = 2; i <= 10; i++) {
      execSync(
        `prd edit ${prdId} --section test-section-${i} --message "版本${i}的内容"`,
        { cwd: testDir, env: process.env }
      )
    }

    // 测试版本列表查询性能 (< 500ms)
    const listStartTime = Date.now()
    execSync(`prd version list ${prdId}`, { cwd: testDir, env: process.env })
    const listTime = Date.now() - listStartTime
    expect(listTime).toBeLessThan(500)

    // 测试版本对比性能 (< 1秒)
    const diffStartTime = Date.now()
    execSync(`prd version diff ${prdId} --from 1 --to 10`, { cwd: testDir, env: process.env })
    const diffTime = Date.now() - diffStartTime
    expect(diffTime).toBeLessThan(1000)

    // 测试版本回滚性能 (< 2秒)
    const rollbackStartTime = Date.now()
    execSync(`prd version restore ${prdId} 5 --confirm`, { cwd: testDir, env: process.env })
    const rollbackTime = Date.now() - rollbackStartTime
    expect(rollbackTime).toBeLessThan(2000)

    // 测试历史版本查看性能 (< 300ms)
    const showStartTime = Date.now()
    execSync(`prd show ${prdId} --version 3`, { cwd: testDir, env: process.env })
    const showTime = Date.now() - showStartTime
    expect(showTime).toBeLessThan(300)
  })
})