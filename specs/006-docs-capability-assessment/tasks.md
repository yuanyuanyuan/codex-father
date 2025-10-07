# Tasks: Multi-Agent Parallel Task Orchestration

**Input**: Design documents from `specs/006-docs-capability-assessment/`  
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md (tech stack, structure) → OK
2. Load design docs: data-model.md, contracts/, research.md, quickstart.md → OK
3. Generate tasks by category (Setup → Tests → Core → Integration → Polish)
4. Apply rules: Tests before implementation; [P] for independent files
5. Number tasks (T001..), add dependency notes, parallel examples
```

## Format: `[ID] [P?] Description`

- [P]: Can run in parallel (different files, no dependency)
- Always include exact file paths in descriptions

## Path Conventions (Single Project)

- Source: `core/*`, `src/*`
- Tests: `core/**/tests/*`
- Contracts reference: `specs/006-docs-capability-assessment/contracts/*`

## Phase 3.1: Setup

- [x] T001 Ensure CLI command scaffold exists in
      `core/cli/commands/orchestrate-command.ts`; wire into `core/cli/start.ts`
      command registry
      （已验证 core/cli/commands/orchestrate-command.ts，core/cli/start.ts:139）
- [x] T002 Ensure package dependency alignment: add `uuid` to `package.json`
      dependencies (used by `core/session/event-logger.ts` and new modules)
      （package.json.dependencies.uuid = "^11.1.0"）
- [x] T003 [P] Add JSON Schema validation helper for events at
      `core/lib/utils/stream-event-validator.ts` (uses
      `docs/schemas/stream-json-event.schema.json`)
      （core/lib/utils/stream-event-validator.ts 已实现 schema 校验）
- [x] T004 [P] Create orchestrator module layout under `core/orchestrator/`:
      `process-orchestrator.ts`, `task-scheduler.ts`, `sww-coordinator.ts`,
      `state-manager.ts`, `resource-monitor.ts`, `quick-validate.ts`,
      `patch-applier.ts`, `types.ts`
      （core/orchestrator/ 目录已包含列出的模块）

## Phase 3.2: Tests First (TDD) — MUST FAIL BEFORE 3.3

- [x] T005 [P] Contract test: CLI options and help per
      `contracts/orchestrate.cli.md` in
      `core/cli/tests/orchestrate-command.contract.test.ts`
      （npx vitest run core/cli/tests/orchestrate-command.contract.test.ts）
- [x] T006 [P] Contract test: exit codes and summary output per
      `contracts/orchestrate.cli.md` in
      `core/cli/tests/orchestrate-exit.contract.test.ts`
      （npx vitest run core/cli/tests/orchestrate-exit.contract.test.ts）
- [x] T007 [P] Schema test: stream events conform to
      `docs/schemas/stream-json-event.schema.json` in
      `core/orchestrator/tests/events.schema.test.ts`
      （已补全事件枚举，保持与契约一致：start/task_scheduled/task_started/tool_use/task_completed/task_failed/patch_applied/patch_failed/concurrency_reduced/concurrency_increased/resource_exhausted/cancel_requested/orchestration_completed/orchestration_failed；见 docs/schemas/stream-json-event.schema.json）
- [x] T008 [P] Data model test: zod schemas for Orchestration/Task/Agent/Patch
      in `core/orchestrator/tests/data-model.test.ts` based on `data-model.md`
      （core/orchestrator/types.ts 导出 Orchestration/Task/Agent/Patch schema）
- [x] T009 [P] Integration test: quickstart happy-path stream (stubbed
      orchestrator) in `core/orchestrator/tests/quickstart.integration.test.ts`
      per `quickstart.md`
      （core/orchestrator/tests/quickstart.integration.test.ts 复用 StateManager
      发射事件，校验 start → task_completed → orchestration_completed 流并断言
      seq 与 orchestrationId）
- [x] T010 [P] Scheduler test: topo sort + dependency wave scheduling in
      `core/orchestrator/tests/task-scheduler.test.ts`
      （task-scheduler.ts 提供拓扑排序与默认超时逻辑）

### Additional Tests for Missing FR/NFR Coverage

- [x] T031 [P] TaskDecomposer manual mode + cycle detection in
      `core/orchestrator/tests/task-decomposer.manual.test.ts`
      （core/orchestrator/task-decomposer.ts 已实现手动模式去重与循环检测；对应测试全部通过）
- [x] T032 [P] TaskDecomposer LLM mode (structured output parsing with mocked
      codex) in `core/orchestrator/tests/task-decomposer.llm.test.ts`
      （core/orchestrator/tests/task-decomposer.llm.test.ts 覆盖依赖推导与缺失字段错误分支）
- [x] T033 [P] RoleAssigner rule priority + LLM fallback in
      `core/orchestrator/tests/role-assigner.test.ts`
      （core/orchestrator/tests/role-assigner.test.ts 验证最长关键词优先于规则顺序，
      且缺省时触发 LLM fallback 并记录 reasoning）
- [x] T034 [P] Permissions enforcement per role
      (allowedTools/permission-mode/sandbox) in
      `core/orchestrator/tests/permissions-enforcement.test.ts`
      （已实现：process-orchestrator.ts 校验角色配置并注入 codex exec 安全参数）
- [x] T035 [P] Pre-assignment validator (context completeness; reject on
      missing) in `core/orchestrator/tests/pre-assignment-validator.test.ts`
      （core/orchestrator/pre-assignment-validator.ts 校验文件/环境/配置缺失；测试覆盖通过）
- [x] T036 [P] Task understanding restatement check (fail on mismatch) in
      `core/orchestrator/tests/understanding-check.test.ts`
      （core/orchestrator/understanding-check.ts 已实现 evaluator 接口并在测试中验证失败路径）
- [x] T037 [P] Contract test: JSON summary output mode in
      `core/orchestrator/tests/json-output.contract.test.ts`
      （orchestrate-command.ts 提供 JSON/stream-json 分支；契约测试已通过）
- [x] T038 [P] Contract test: JSONL audit log append-only + required fields in
      `core/orchestrator/tests/audit-jsonl.contract.test.ts`
      （StateManager.emitEvent 现写入 JSONL 并保持 seq 递增；测试验证通过）
- [x] T039 [P] Security test: redaction of sensitive data in events/logs in
      `core/orchestrator/tests/redaction.security.test.ts`
      （已实现：StateManager.emitEvent 支持 redactionPatterns；敏感信息写入前被替换为 [REDACTED]）
- [x] T040 [P] Integration: session recovery from Codex rollout in
      `core/orchestrator/tests/session-recovery.integration.test.ts`
      （已实现：ProcessOrchestrator.resumeSession 调用 codex exec resume，默认 sandbox=workspace-write/approval=never；测试通过）
- [x] T041 [P] Integration: resource exhaustion → auto downscale + task timeout
      in `core/orchestrator/tests/resource-timeout.integration.test.ts`
      （已实现：handleResourcePressure 触发 concurrency_reduced 与 task_failed(timeout)；测试通过）
- [ ] T042 [P] Contract test: manual intervention mode gating in
      `core/orchestrator/tests/manual-intervention.contract.test.ts`
      （manual-intervention.contract.test.ts 期望拒绝执行，但 orchestrator.orchestrate() 仍返回成功上下文，缺少 gating 实现）
- [x] T043 [P] Contract test: logs viewing/export CLI in
      `core/cli/tests/logs-command.contract.test.ts`
      （npx vitest run core/cli/tests/logs-command.contract.test.ts）

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [x] T011 Implement `types.ts`: OrchestrationConfig/Task/Agent/Patch zod
      schemas per `data-model.md`
      （core/orchestrator/types.ts 覆盖数据模型规范）
- [x] T012 Implement `task-scheduler.ts`: dependency graph, cycle detection,
      wave scheduling, timeout defaults
      （task-scheduler.ts 已实现依赖图/循环检测/波次调度）
- [x] T013 Implement `process-orchestrator.ts`: pool management (size ≤10),
      spawn `codex exec`, health check, graceful shutdown (60s)
      （ProcessOrchestrator 已实现并发池、codex exec 启动、healthCheck 与 requestCancel/shutdown；pool/health/cancel 测试通过）
- [ ] T014 Implement `sww-coordinator.ts`: Single Writer Window + two‑phase
      write, queue, sequence; append audit `patch_applied`/`patch_failed`;
      stream提示使用 `tool_use`/`task_failed`（保持与事件 Schema 一致）
      （SWWCoordinator 尚未发出 tool_use/task_failed 事件或串联外部日志）
- [x] T015 Implement `patch-applier.ts`: prefer `git apply`, fallback to native;
      return strategy + usedFallback
      （core/orchestrator/patch-applier.ts 已实现 git 优先与 native 回退；对应策略测试通过）
- [x] T016 Implement `quick-validate.ts`: run configured steps, fail on missing
      when `failOnMissing: true`
      （quick-validate.ts 支持 failOnMissing 与顺序执行 steps；测试覆盖错误与警告路径）
- [ ] T017 Implement `resource-monitor.ts`: sample `os`/`process` metrics,
      thresholds, hysteresis, auto up/down concurrency
      （resource-monitor.ts 未导出 shouldDownscale；滞回/降级测试失败）
- [x] T018 Implement `state-manager.ts`: Stream-JSON emitter + success rate
      aggregation; write JSONL via `EventLogger`
      （StateManager.emitEvent 提供 seq 递增与 JSONL 写入；state-manager.test.ts 验证通过）
- [x] T019 Implement CLI: `orchestrate-command.ts` parses options, loads config
      via `core/cli/config-loader.ts`, runs orchestrator, maps exit codes per
      contract
      （已实现：解析选项并加载配置；调用 `ProcessOrchestrator` 返回上下文；
      按契约映射退出码；保持 stream-json 仅两行输出）

### Implementations for Added Coverage

- [x] T044 Implement `task-decomposer.ts` (manual + LLM; cycle detection;
      structured parsing)
      （core/orchestrator/task-decomposer.ts 同时支持手动与 LLM 解析，测试覆盖成功/失败分支）
- [x] T045 Wire `TaskDecomposer` into orchestrate flow before scheduling; reject
      if cannot decompose
      （已接入：在调度前调用 `TaskDecomposer.validate`；失败仅写 JSONL 事件
      `decomposition_failed` → `orchestration_failed` 并中止）
- [x] T046 Implement `role-assigner.ts` (rules file load; priority match; LLM
      fallback; optional confirmation)
      （role-assigner.ts 已实现规则优先级与 LLM 回退；测试验证关键词覆盖与记录 reasoning）
- [x] T047 Enforce role permissions when spawning agents
      (allowedTools/permission-mode/sandbox applied) in
      `process-orchestrator.ts`
      （process-orchestrator.ts 在 spawnAgent 中校验角色权限并传递到 codex exec；测试通过）
- [x] T048 Implement `pre-assignment-validator.ts` (context completeness:
      files/env/config); emit rejection events
      （pre-assignment-validator.ts 已实现文件、环境变量、配置键校验；测试通过）
- [x] T049 Implement `understanding-check.ts` (restatement via codex;
      configurable gate) and integrate before execution
      （已接入：在任务分解之前执行理解门控；成功写 JSONL `understanding_validated`；
      失败按顺序写入 `understanding_failed` → `orchestration_failed` 并中止）
- [x] T050 Add JSON output mode to orchestrate summary (`--output-format json`)
      per contract
      （已实现：core/cli/commands/orchestrate-command.ts 提供 --output-format json，buildJsonSummary 输出 JSON 摘要）
- [x] T051 Ensure JSONL audit logging: append-only + required fields; add
      validator hooks in `state-manager.ts`
      （已实现：StateManager.emitEvent 通过 EventLogger 追加 JSONL，包含 orchestrationId/seq/timestamp/事件字段；见 core/orchestrator/state-manager.ts）
- [x] T052 Implement redaction pipeline for events/logs (respect repo redaction
      settings; sanitize tool_use summaries)
      （已增强：CLI 将根据配置开启默认脱敏模式集合（password/token/apiKey/authorization/
      sk- 格式），StateManager 统一对 key=value、冒号分隔与自由文本进行掩码；新增
      测试覆盖 tool_use 摘要混合场景。）
- [x] T053 Implement session recovery from Codex rollout
      (`codex exec resume <SESSION_ID>` integration) in
      `process-orchestrator.ts`
      （已接入：在 CLI `orchestrate` 新增 `--resume <path>`，调用
      `ProcessOrchestrator.resumeSession` 触发 `codex exec resume`；保留
      sandbox=workspace-write/approval=never 透传，不影响 stdout 两行契约；
      测试覆盖 resume 快捷路径与参数集）
- [x] T054 Ensure resource timeout + auto downscale behavior paths are
      implemented and observable (tie with `resource-monitor.ts`)
      （已联动：`handleResourcePressure` 在高负载时动态下调并发池大小并发出
      `concurrency_reduced`，恢复时上调并发并发出 `concurrency_increased`；
      调度阶段按 `currentPoolSize` 分批执行；新增用例验证降级生效。）
- [ ] T055 Implement manual intervention mode (config flag) to gate
      execution/role fallback; emit prompts as events
      （manual intervention 模式配置与事件缺失）
- [x] T056 Add `logs` CLI command at `core/cli/commands/logs-command.ts` to
      view/export `.codex-father/sessions/<id>/events.jsonl`
      （已实现读取/导出并支持 --follow/--limit/--format，见 core/cli/commands/logs-command.ts）

## Phase 3.4: Integration

- [x] T020 Wire orchestrate outputs to both console (stream-json) and JSONL file
      under `.codex-father/sessions/<id>/events.jsonl`
      （已实现：使用 `StateManager + EventLogger` 统一写入 JSONL（0600/0700）；
      CLI 严格仅输出 start 与 orchestration_completed 两行）
- [x] T021 Implement retry policy (max attempts=2, exponential backoff) and emit
      `task_retry_scheduled`
      （已实现：在 `runTaskWithRetry` 中按配置或默认进行指数回退；在每次失败且允许
      重试时写入 JSONL 事件 `task_retry_scheduled`，包含 `{ nextAttempt, delayMs }`；
      测试覆盖失败一次后重试与事件负载验证）
- [x] T022 Implement SWW isolation workspaces under
      `.codex-father/sessions/<id>/workspaces/agent_<n>/` and patches under
      `patches/`
      （已实现：Orchestrator 在 spawnAgent 前确保 `<sessionDir>/patches/` 与
      `<sessionDir>/workspaces/agent_<n>` 存在；Agent.workDir 指向对应工作目录。
      新增契约测试 `workspaces-structure.contract.test.ts` 验证结构。）
- [x] T023 Implement cancel handling (SIGINT): broadcast stop → wait 60s →
      terminate → summary report
      （已实现最小取消链路：写入 `cancel_requested`，等待后终止活跃 agent 并清空池，
      最终写入 `orchestration_failed`（reason=cancelled）。契约测试通过：
      `core/orchestrator/tests/cancel-handling.contract.test.ts`）
- [x] T024 Ensure sandbox and approvals defaults: `workspace-write`, `never` for
      orchestrator; codex processes inherit safety config
      （已确认：默认角色配置 developer/tester/reviewer 均为 sandbox=workspace-write、
      permissionMode=never；`launchCodexAgent` 透传 `--ask-for-approval` 与
      `--sandbox` 参数。测试覆盖：
      `core/orchestrator/tests/sandbox-approvals.defaults.test.ts`）

## Phase 3.5: Polish

- [x] T025 [P] Unit tests for SWW failure/rollback paths in
      `core/orchestrator/tests/sww-coordinator.test.ts`
      （sww-coordinator.test.ts 覆盖冲突、preCheck 失败、队列串行与回滚场景；本轮针对命令验证全部通过）
- [ ] T026 [P] Unit tests for resource monitor thresholds/hysteresis in
      `core/orchestrator/tests/resource-monitor.test.ts`
      （resource-monitor.test.ts 已编写阈值/滞回用例，但因 shouldDownscale 未导出导致本轮测试全数失败）
- [x] T027 [P] Unit tests for patch-applier strategies in
      `core/orchestrator/tests/patch-applier.test.ts`
      （patch-applier.test.ts 覆盖 git 优先、fallback 与 native-only 策略分支；全部断言通过）
- [x] T028 [P] CLI doc updates: extend
      `specs/006-docs-capability-assessment/quickstart.md` with real examples
      （quickstart.md 增补 orchestrate/ logs CLI 示例、事件片段与 JSONL 路径说明）
- [ ] T029 [P] Performance smoke: concurrent 10 agents baseline log in
      `core/orchestrator/tests/performance.smoke.test.ts`
      （core/orchestrator/tests/performance.smoke.test.ts 尚未创建）
- [ ] T030 Repository hygiene: eslint/prettier run; ensure no unused deps;
      update `docs/developer/AGENTS.md` pointers if paths changed
      （尚未执行 eslint/prettier 清理或同步 docs/developer/AGENTS.md）

## Dependencies

- Setup (T001–T004) precede tests and implementation
- Tests (T005–T010) must be written before core (T011–T019)
- `types.ts` (T011) blocks scheduler/state modules (T012, T018) and others
  referencing types
- `task-scheduler.ts` (T012) blocks orchestrator wiring (T013, T019)
- SWW/patch/validate (T014–T016) integrate into orchestrator (T013) and state
  (T018)
- Integration (T020–T024) after core; Polish (T025–T030) last

Additional dependencies:

- T031–T032 before T044–T045
- T033–T034 before T046–T047
- T035 before T048
- T036 before T049
- T037–T039 before T050–T052
- T040 before T053
- T041 validates T017/T054 behavior
- T042 before T055
- T043 before T056

## Parallel Example

```
# Launch independent [P] tests together (different files):
Task: "Contract test: CLI options and help"  (core/cli/tests/orchestrate-command.contract.test.ts)
Task: "Schema test: stream events"          (core/orchestrator/tests/events.schema.test.ts)
Task: "Data model test: zod schemas"        (core/orchestrator/tests/data-model.test.ts)
Task: "Integration quickstart (stub)"       (core/orchestrator/tests/quickstart.integration.test.ts)
Task: "Scheduler topo sort"                 (core/orchestrator/tests/task-scheduler.test.ts)

# Additional [P] group:
Task: "TaskDecomposer manual"               (core/orchestrator/tests/task-decomposer.manual.test.ts)
Task: "TaskDecomposer LLM"                  (core/orchestrator/tests/task-decomposer.llm.test.ts)
Task: "RoleAssigner rules/fallback"         (core/orchestrator/tests/role-assigner.test.ts)
Task: "JSON/JSONL contracts & redaction"   (core/orchestrator/tests/json-output.contract.test.ts, audit-jsonl.contract.test.ts, redaction.security.test.ts)
```

## Notes

- [P] tasks = different files, no conflicts; avoid multiple [P] tasks editing
  the same file
- Keep orchestrator process offline; only access LLM via `codex exec`
- Quick validate is mandatory; if missing tools, fail write and emit
  `patch_failed`
- Exit 0 iff successRate ≥ threshold and no `patch_failed`

## Validation Checklist

- [x] All contracts have corresponding tests (T005–T007)
      （core/cli 与 orchestrator 契约测试均通过，包括 stream event schema）
      （core/cli 与 orchestrator 契约测试均通过，包括 stream event schema）
- [x] All entities have model/schema tasks (T011)
      （core/orchestrator/types.ts 已落地数据模型）
- [ ] All tests come before implementation (T005–T010 before T011+)
      （仍有核心实现（T013-T019）缺失，待完成后再次核对测试顺序）
- [x] Parallel tasks truly independent ([P] only on different files)
      （当前 [P] 任务分布于不同测试文件，无文件冲突）
- [x] Each task specifies exact file path
      （所有任务描述均包含明确文件路径）
- [x] No task modifies same file as another [P] task
      （未发现并行任务指向同一文件）

## Progress Summary

- Done: 35 / 56
- Pending: 21 / 56
 
- Next [P] batch recommendation:
  1. T039（core/orchestrator/tests/redaction.security.test.ts）—修复红线脱敏，去除 superSecret/sk-* 泄露
  2. T040（core/orchestrator/tests/session-recovery.integration.test.ts）—实现 resumeSession，补齐 codex exec rollout 恢复
  3. T041（core/orchestrator/tests/resource-timeout.integration.test.ts）—补齐 handleResourcePressure 降级与任务超时联动
