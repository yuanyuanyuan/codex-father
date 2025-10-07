比较麻烦，暂时不做。


目前需要处理的目录是docs/\_\_archive,docs/mvp,specs

下面是要实现需求所需要增加的功能:

设计目标

- 开源主仓继续公开；specs/、docs/ 内容私有化，且可版本管理。
- 本地与 CI 可直接从 ./specs、./docs 引用；缺失时优雅降级。
- 最小侵入：不改现有引用路径；变更聚焦到拉取与权限。
- KISS/DRY/YAGNI：两个子模块、一个引导脚本、统一降级策略。

总体架构

- 在公仓根目录挂两个子模块：specs/、docs/。
- 两个子模块各自独立私有仓，默认用 SSH URL（便于部署只读 Key）。
- 公仓仅固定子模块“提交指针”，保证可重现；升级通过显式更新指针。

仓库与权限

- 私有仓命名：<org>/<repo>-specs-private 与 <org>/<repo>-docs-private。
- 访问策略：
  - 本地开发：成员使用个人 SSH Key（只读/读写按需）。
  - CI：为两个私有仓各配置只读 Deploy Key；公仓 CI 使用同一只读私钥。
- .gitmodules 约定：
  - submodule.specs.path specs
  - submodule.specs.url git@github.com:<org>/<repo>-specs-private.git
  - submodule.docs.path docs
  - submodule.docs.url git@github.com:<org>/<repo>-docs-private.git
  - 如需跟踪分支可设 branch = main，但仍以“固定指针提交”为准。

本地开发流程（脚本化）

- 引导脚本：scripts/bootstrap-private.sh
  - 行为：检测 SSH/Token → git submodule update --init --recursive --depth=1
  - 失败时：打印提示并设置环境变量 PRIVATE_MODULES_AVAILABLE=0，后续流程降级。
  - 成功时：PRIVATE_MODULES_AVAILABLE=1
- 约定：所有依赖私有内容的任务在入口检查 PRIVATE_MODULES_AVAILABLE 或目录存在性。
- 常见指令：
  - 首次：git clone <public-repo> && ./scripts/bootstrap-private.sh
  - 更新：git submodule update --remote --merge（或固定到指定提交）

CI/CD 集成

- GitHub Actions（推荐 SSH + Deploy Key）- 为两私有仓各添加只读 Deploy
  Key（同一公钥，可复用）。- 在公仓 Secrets 配置私钥：SUBMODULES_RO_SSH_KEY. -
  Checkout 步骤：- uses: actions/checkout@v4 - with: submodules: 'recursive',
  ssh-key: '${{ secrets.SUBMODULES_RO_SSH_KEY }}' - 如需浅克隆：fetch-depth:
  1 - 来自 fork 的 PR 无法读取 Secrets：步骤前检测 if: github.event_name !=
  'pull_request' ||
  !github.event.pull_request.head.repo.fork，否则跳过子模块并走降级路径。
- GitHub Actions（可选 HTTPS + PAT）
  - .gitmodules 使用 https://github.com/<org>/<repo>.git
  - Checkout：with: submodules: 'recursive', token: '${{ secrets.GH_PAT }}'
- GitLab
  CI - 设置变量：GIT_SUBMODULE_STRATEGY=recursive、GIT_SUBMODULE_DEPTH=1 - 注入只读私钥：before_script 中 eval
  "$(ssh-agent -s)" && ssh-add <(echo
  "$SUBMODULES_RO_SSH_KEY") && git
  submodule update --init --recursive --depth=1 - Fork MR：同样按变量开关降级。

引用与降级约定

- 代码/脚本统一从固定路径读取：specs/...、docs/...
- 入口处最小检查：
  - Bash: [ -d "specs/.git" ] || echo "私有内容不可用，已降级"
  - Node: fs.existsSync('specs') ? useReal() : useFallback()
- 降级策略（示例）：
  - 读不到则跳过生成某些产物、使用占位内容、或直接标注“私有内容未初始化”。
  - CI 默认降级为“通过但不产出含私有内容的工件”，避免阻断开源 PR。

子模块生命周期与协作流程

- 修改私有内容：- 到子模块目录开发 → 在私有仓提交/推送 → 回到公仓根 git add
  specs（提交指针变化）→ 在公仓创建 PR。
- 回滚：
  - 在公仓将子模块指针回退到历史提交 → 提交 PR。
- 避免在公仓直接修改子模块工作区（造成“脏子模块”）；强制在子模块自身开 PR。

迁移与历史清理（如现已混在公仓历史中）

- 路线 1（推荐）：新开两个私有仓 → 从公仓导出历史 - 使用 git subtree split
  --prefix=specs -b
  specs-history 导出 → 以此初始化私有仓。- 同理处理 docs。- 在公仓移除原目录 → 加回子模块 → 提交。
- 路线 2：开源镜像仓（public）用 git
  filter-repo 移除 specs/、docs/ 历史，再挂子模块。
- 高风险操作清单（执行前需明确确认）：
  - 历史改写（git filter-repo/git filter-branch）与强推远端。
  - 清理已发布的构建产物或 Release 附件中可能包含的敏感内容。
  - 远端默认分支重置、保护分支策略调整。

安全与合规要点

- 子模块 URL 默认使用 SSH；CI 用只读 Deploy Key，权限最小化。
- 开源构建产物中排除私有内容：发布脚本只从 dist/、build/ 收集；禁止打包 specs/、docs/ 原文件。
- 审计：在 PR 检查中增加规则，若 specs/ 或 docs/ 未初始化则允许通过但标注提示。
- 变更可追溯：公仓的子模块指针与私有仓提交 ID 形成“可重现构建”证据链。

常见陷阱与规避

- 忘记初始化子模块：用统一引导脚本，CI/本地均调用。
- Fork PR 无法拉取子模块：分支级条件跳过 + 降级。
- .gitmodules 与实际远端不一致：在 CI 加 git submodule sync --recursive。
- 浅克隆导致获取不到目标提交：必要时对单个子模块取消 --depth 或显式 git fetch
  --unshallow。验收清单

- 两个私有仓创建完毕并设只读 Deploy Key。
- 公仓 .gitmodules 配置完成；git submodule update 在本地可用。
- scripts/bootstrap-private.sh 设计与降级规则评审通过。
- CI 能在“带密钥”和“无密钥（fork PR）”两种场景分别成功执行。
- 现有代码在私有目录缺失时不崩溃，引用路径不变。

原则适配说明

- KISS：仅引入子模块与一个引导脚本，避免额外服务与复杂秘钥编排。
- DRY：本地与 CI 都调用同一引导脚本，统一降级逻辑。
- YAGNI：不引入第三方子模块管理器，不做自动分支追踪的魔法同步。
- 单一职责：公仓编排依赖与发布，私有仓承载私密内容演进。
