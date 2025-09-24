#!/bin/bash
# Script to restart the Codex MCP server with latest changes

echo "Restarting OpenAI Codex MCP Server..."

# Kill any existing server process
pkill -f "codex_server" || echo "No existing server process found"
pkill -f "uvicorn codex_server" || echo "No existing uvicorn process found"

# Re-install the package
pip install -e . || { echo "Failed to install package"; exit 1; }

# Start the server in the background
nohup uvicorn codex_server:app --reload > codex_server.log 2>&1 &

# Wait for server to start
sleep 2

# Check if server is running
if pgrep -f "uvicorn codex_server" > /dev/null; then
    echo "Server started successfully on http://localhost:8000/"
    echo "Log file: codex_server.log"
else
    echo "Failed to start server"
    exit 1
fi