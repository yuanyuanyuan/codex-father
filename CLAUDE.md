# codex-father Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-27

## Active Technologies
- TypeScript 5.x + Node.js 18+ (统一技术栈) (001-docs-readme-phases)

## Project Structure
```
src/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
TypeScript 5.x + Node.js 18+ (统一技术栈): Follow standard conventions

## Recent Changes
- 001-docs-readme-phases: Added TypeScript 5.x + Node.js 18+ (统一技术栈)

<!-- MANUAL ADDITIONS START -->
## Documentation Maintainer
- Project subagent lives at `.claude/agents/docs-maintainer.md`; invoke it for incremental doc sync.
- Hook automation uses `scripts/hooks/docs_maintainer_hook.sh` and is registered in `.claude/settings.local.json` for `SessionStart` and `PostToolUse`.
- Hook output artifacts (context, prompt, log) are stored under `.claude/hooks/docs-maintainer/` for traceability.
- Override the auto-run command by setting `DOCS_MAINTAINER_SUBAGENT_CMD`; defaults to `claude subagents run docs-maintenance-expert`.
- See Claude Code Hooks and Subagents guides for CLI syntax and security expectations.
<!-- MANUAL ADDITIONS END -->