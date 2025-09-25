SHELL := /usr/bin/env bash

.PHONY: mcp-build e2e smoke test clean-sessions

mcp-build:
	@echo "[make] build MCP TS server";
	@cd mcp/codex-mcp-server && npm install --silent && npm run build --silent

e2e: mcp-build
	@bash tests/mcp_ts_e2e.sh

smoke:
	@bash tests/smoke_start_json.sh
	@bash tests/smoke_job_json.sh

test: smoke e2e

clean-sessions:
	@set -euo pipefail; \
	SESS_DIR=".codex-father/sessions"; \
	if [[ -d "$$SESS_DIR" ]]; then \
	  echo "[make] cleaning $$SESS_DIR"; \
	  rm -rf "$$SESS_DIR"/*; \
	else \
	  echo "[make] no sessions dir"; \
	fi

