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
- [x] T002 Ensure package dependency alignment: add `uuid` to `package.json`
      dependencies (used by `core/session/event-logger.ts` and new modules)
- [x] T003 [P] Add JSON Schema validation helper for events at
      `core/lib/utils/stream-event-validator.ts` (uses
      `docs/schemas/stream-json-event.schema.json`)
- [x] T004 [P] Create orchestrator module layout under `core/orchestrator/`:
      `process-orchestrator.ts`, `task-scheduler.ts`, `sww-coordinator.ts`,
      `state-manager.ts`, `resource-monitor.ts`, `quick-validate.ts`,
      `patch-applier.ts`, `types.ts`

## Phase 3.2: Tests First (TDD) — MUST FAIL BEFORE 3.3

- [x] T005 [P] Contract test: CLI options and help per
      `contracts/orchestrate.cli.md` in
      `core/cli/tests/orchestrate-command.contract.test.ts`
- [x] T006 [P] Contract test: exit codes and summary output per
      `contracts/orchestrate.cli.md` in
      `core/cli/tests/orchestrate-exit.contract.test.ts`
- [x] T007 [P] Schema test: stream events conform to
      `docs/schemas/stream-json-event.schema.json` in
      `core/orchestrator/tests/events.schema.test.ts`
- [x] T008 [P] Data model test: zod schemas for Orchestration/Task/Agent/Patch
      in `core/orchestrator/tests/data-model.test.ts` based on `data-model.md`
- [x] T009 [P] Integration test: quickstart happy-path stream (stubbed
      orchestrator) in `core/orchestrator/tests/quickstart.integration.test.ts`
      per `quickstart.md`
- [x] T010 [P] Scheduler test: topo sort + dependency wave scheduling in
      `core/orchestrator/tests/task-scheduler.test.ts`

### Additional Tests for Missing FR/NFR Coverage

- [ ] T031 [P] TaskDecomposer manual mode + cycle detection in
      `core/orchestrator/tests/task-decomposer.manual.test.ts`
- [ ] T032 [P] TaskDecomposer LLM mode (structured output parsing with mocked
      codex) in `core/orchestrator/tests/task-decomposer.llm.test.ts`
- [ ] T033 [P] RoleAssigner rule priority + LLM fallback in
      `core/orchestrator/tests/role-assigner.test.ts`
- [ ] T034 [P] Permissions enforcement per role
      (allowedTools/permission-mode/sandbox) in
      `core/orchestrator/tests/permissions-enforcement.test.ts`
- [ ] T035 [P] Pre-assignment validator (context completeness; reject on
      missing) in `core/orchestrator/tests/pre-assignment-validator.test.ts`
- [ ] T036 [P] Task understanding restatement check (fail on mismatch) in
      `core/orchestrator/tests/understanding-check.test.ts`
- [ ] T037 [P] Contract test: JSON summary output mode in
      `core/orchestrator/tests/json-output.contract.test.ts`
- [ ] T038 [P] Contract test: JSONL audit log append-only + required fields in
      `core/orchestrator/tests/audit-jsonl.contract.test.ts`
- [ ] T039 [P] Security test: redaction of sensitive data in events/logs in
      `core/orchestrator/tests/redaction.security.test.ts`
- [ ] T040 [P] Integration: session recovery from Codex rollout in
      `core/orchestrator/tests/session-recovery.integration.test.ts`
- [ ] T041 [P] Integration: resource exhaustion → auto downscale + task timeout
      in `core/orchestrator/tests/resource-timeout.integration.test.ts`
- [ ] T042 [P] Contract test: manual intervention mode gating in
      `core/orchestrator/tests/manual-intervention.contract.test.ts`
- [ ] T043 [P] Contract test: logs viewing/export CLI in
      `core/cli/tests/logs-command.contract.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] T011 Implement `types.ts`: OrchestrationConfig/Task/Agent/Patch zod
      schemas per `data-model.md`
- [ ] T012 Implement `task-scheduler.ts`: dependency graph, cycle detection,
      wave scheduling, timeout defaults
- [ ] T013 Implement `process-orchestrator.ts`: pool management (size ≤10),
      spawn `codex exec`, health check, graceful shutdown (60s)
- [ ] T014 Implement `sww-coordinator.ts`: Single Writer Window + two‑phase
      write, queue, sequence; append audit `patch_applied`/`patch_failed`;
      stream提示使用 `tool_use`/`task_failed`（保持与事件 Schema 一致）
- [ ] T015 Implement `patch-applier.ts`: prefer `git apply`, fallback to native;
      return strategy + usedFallback
- [ ] T016 Implement `quick-validate.ts`: run configured steps, fail on missing
      when `failOnMissing: true`
- [ ] T017 Implement `resource-monitor.ts`: sample `os`/`process` metrics,
      thresholds, hysteresis, auto up/down concurrency
- [ ] T018 Implement `state-manager.ts`: Stream-JSON emitter + success rate
      aggregation; write JSONL via `EventLogger`
- [ ] T019 Implement CLI: `orchestrate-command.ts` parses options, loads config
      via `core/cli/config-loader.ts`, runs orchestrator, maps exit codes per
      contract

### Implementations for Added Coverage

- [ ] T044 Implement `task-decomposer.ts` (manual + LLM; cycle detection;
      structured parsing)
- [ ] T045 Wire `TaskDecomposer` into orchestrate flow before scheduling; reject
      if cannot decompose
- [ ] T046 Implement `role-assigner.ts` (rules file load; priority match; LLM
      fallback; optional confirmation)
- [ ] T047 Enforce role permissions when spawning agents
      (allowedTools/permission-mode/sandbox applied) in
      `process-orchestrator.ts`
- [ ] T048 Implement `pre-assignment-validator.ts` (context completeness:
      files/env/config); emit rejection events
- [ ] T049 Implement `understanding-check.ts` (restatement via codex;
      configurable gate) and integrate before execution
- [ ] T050 Add JSON output mode to orchestrate summary (`--output-format json`)
      per contract
- [ ] T051 Ensure JSONL audit logging: append-only + required fields; add
      validator hooks in `state-manager.ts`
- [ ] T052 Implement redaction pipeline for events/logs (respect repo redaction
      settings; sanitize tool_use summaries)
- [ ] T053 Implement session recovery from Codex rollout
      (`codex exec resume <SESSION_ID>` integration) in
      `process-orchestrator.ts`
- [ ] T054 Ensure resource timeout + auto downscale behavior paths are
      implemented and observable (tie with `resource-monitor.ts`)
- [ ] T055 Implement manual intervention mode (config flag) to gate
      execution/role fallback; emit prompts as events
- [ ] T056 Add `logs` CLI command at `core/cli/commands/logs-command.ts` to
      view/export `.codex-father/sessions/<id>/events.jsonl`

## Phase 3.4: Integration

- [ ] T020 Wire orchestrate outputs to both console (stream-json) and JSONL file
      under `.codex-father/sessions/<id>/events.jsonl`
- [ ] T021 Implement retry policy (max attempts=2, exponential backoff) and emit
      `task_retry_scheduled`
- [ ] T022 Implement SWW isolation workspaces under
      `.codex-father/sessions/<id>/workspaces/agent_<n>/` and patches under
      `patches/`
- [ ] T023 Implement cancel handling (SIGINT): broadcast stop → wait 60s →
      terminate → summary report
- [ ] T024 Ensure sandbox and approvals defaults: `workspace-write`, `never` for
      orchestrator; codex processes inherit safety config

## Phase 3.5: Polish

- [ ] T025 [P] Unit tests for SWW failure/rollback paths in
      `core/orchestrator/tests/sww-coordinator.test.ts`
- [ ] T026 [P] Unit tests for resource monitor thresholds/hysteresis in
      `core/orchestrator/tests/resource-monitor.test.ts`
- [ ] T027 [P] Unit tests for patch-applier strategies in
      `core/orchestrator/tests/patch-applier.test.ts`
- [ ] T028 [P] CLI doc updates: extend
      `specs/006-docs-capability-assessment/quickstart.md` with real examples
- [ ] T029 [P] Performance smoke: concurrent 10 agents baseline log in
      `core/orchestrator/tests/performance.smoke.test.ts`
- [ ] T030 Repository hygiene: eslint/prettier run; ensure no unused deps;
      update `docs/developer/AGENTS.md` pointers if paths changed

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

- [ ] All contracts have corresponding tests (T005–T007)
- [ ] All entities have model/schema tasks (T011)
- [ ] All tests come before implementation (T005–T010 before T011+)
- [ ] Parallel tasks truly independent ([P] only on different files)
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task
