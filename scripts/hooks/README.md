# Git 钩子 (`hooks`)

该目录包含由 Git 钩子触发的脚本。

## 文件结构

- `docs_maintainer_hook.sh`: 一个在提交时触发的脚本，用于通知文档维护代理有关代码更改的信息。
- `check-bilingual-docs.sh`: 在 `pre-push`
  阶段强制“根 README 关联文档”的双语同步（`*.md` ↔ `*.en.md`）。

## 使用

Husky 已在 `.husky/pre-push` 自动调用
`check-bilingual-docs.sh`，且仅检查“与根 README.md 有链接关系”的文档（默认递归深度 2）。手动运行：

```bash
npm run docs:check-bilingual
```

可通过环境变量临时关闭（不推荐）：

```bash
DOCS_BILINGUAL_ENFORCE=0 git push --no-verify
```

调整递归深度（默认 2）：

```bash
DOCS_BILINGUAL_MAX_DEPTH=3 npm run docs:check-bilingual
```
