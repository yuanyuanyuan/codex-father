#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Scaffold Product/Tech PRD v2.0 docs for a new project.

Usage:
  bash scripts/scaffold_prd.sh -k <PROJECT_KEY> -n "<Product Name>" -t <T1|T2|T3> -p "<PM Name>" -l "<TL Name>"

Example:
  bash scripts/scaffold_prd.sh -k phoenix -n "Phoenix 知识平台" -t T1 -p "Alice" -l "Bob"

Outputs:
  docs/projects/<key>/<key>-产品PRD-v2.0.md
  docs/projects/<key>/<key>-技术PRD-v2.0.md
  docs/projects/<key>/adr/ADR-0001-初始架构选择.md
USAGE
}

KEY=""; NAME=""; TIER=""; PM=""; TL=""
while getopts ":k:n:t:p:l:h" opt; do
  case $opt in
    k) KEY="$OPTARG";;
    n) NAME="$OPTARG";;
    t) TIER="$OPTARG";;
    p) PM="$OPTARG";;
    l) TL="$OPTARG";;
    h) usage; exit 0;;
    \?) echo "Invalid option: -$OPTARG"; usage; exit 1;;
    :) echo "Option -$OPTARG requires an argument."; usage; exit 1;;
  esac
done

if [[ -z "$KEY" || -z "$NAME" || -z "$TIER" || -z "$PM" || -z "$TL" ]]; then
  usage; exit 1
fi

if [[ "$TIER" != "T1" && "$TIER" != "T2" && "$TIER" != "T3" ]]; then
  echo "TIER must be one of: T1, T2, T3"; exit 1
fi

DATE=$(date +%F)
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

TEMPL_PRD="$ROOT_DIR/docs/templates/产品PRD模板-v2.0-增强版.md"
TEMPL_TECH="$ROOT_DIR/docs/templates/技术PRD模板-v2.0-增强版.md"
TEMPL_ADR="$ROOT_DIR/docs/templates/ADR-模板.md"

DEST_DIR="$ROOT_DIR/docs/projects/$KEY"
mkdir -p "$DEST_DIR/adr" "$DEST_DIR/runbooks"

PRD_FILE="$DEST_DIR/${KEY}-产品PRD-v2.0.md"
TECH_FILE="$DEST_DIR/${KEY}-技术PRD-v2.0.md"
ADR_FILE="$DEST_DIR/adr/ADR-0001-初始架构选择.md"

cp "$TEMPL_PRD" "$PRD_FILE"
cp "$TEMPL_TECH" "$TECH_FILE"
cp "$TEMPL_ADR" "$ADR_FILE"

# Fill placeholders in Product PRD
sed -i "1 s/\[功能\/产品名称\]/${NAME//\//\/}/" "$PRD_FILE"
sed -i "s/| 创建日期 | YYYY-MM-DD |/| 创建日期 | ${DATE} |/" "$PRD_FILE"
sed -i "s/| 最后更新 | YYYY-MM-DD |/| 最后更新 | ${DATE} |/" "$PRD_FILE"
sed -i "s/| 适用层级 | T1 \/ T2 \/ T3 |/| 适用层级 | ${TIER} |/" "$PRD_FILE"
sed -i "s/| 产品负责人（PM） | \[姓名\] |/| 产品负责人（PM） | ${PM} |/" "$PRD_FILE"
sed -i "s/| 技术负责人（TL） | \[姓名\] |/| 技术负责人（TL） | ${TL} |/" "$PRD_FILE"

# Fill placeholders in Tech PRD
sed -i "1 s/\[系统\/项目名称\]/${NAME//\//\/}/" "$TECH_FILE"
sed -i "s/| 创建日期 | YYYY-MM-DD |/| 创建日期 | ${DATE} |/" "$TECH_FILE"
sed -i "s/| 最后更新 | YYYY-MM-DD |/| 最后更新 | ${DATE} |/" "$TECH_FILE"
sed -i "s/| 适用层级 | T1 \/ T2 \/ T3 |/| 适用层级 | ${TIER} |/" "$TECH_FILE"
sed -i "s/| 关联 PRD | 链接到产品PRD v2.0 |/| 关联 PRD | docs\/projects\/${KEY}\/${KEY}-产品PRD-v2.0.md |/" "$TECH_FILE"

# Seed ADR
sed -i "s/\[编号\]/0001/" "$ADR_FILE"
sed -i "s/\[标题\]/初始架构选择/" "$ADR_FILE"
sed -i "s/\[状态\]/Proposed/" "$ADR_FILE"
sed -i "s/\[日期\]/${DATE}/" "$ADR_FILE"

cat <<EOF
Scaffolded files:
  - $PRD_FILE
  - $TECH_FILE
  - $ADR_FILE

Next steps:
  1) Edit the PRD and select modules in “模块使用清单（裁剪记录）”。
  2) Fill Goals/KR/Guardrails/Cost and the Features table (RICE/风险/DoR/Owner).
  3) In Tech PRD, complete Architecture, Contracts, Migration, Observability, Rollback SOP, Version Governance.
  4) Commit and start the cross-review.
EOF

