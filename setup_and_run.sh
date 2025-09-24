#!/usr/bin/env bash
# Quick-start script for OpenAI Codex MCP server

# Exit on error
set -e

# Check for codex CLI
if ! command -v codex &> /dev/null; then
    echo "Error: 'codex' command not found."
    echo "Please install the OpenAI Codex CLI: npm install -g @openai/codex"
    exit 1
fi

# Setup Python environment if not already set up
if [ ! -d ".venv" ]; then
    echo "Setting up Python virtual environment..."
    uv venv
    source .venv/bin/activate
    uv pip install -e .
else
    source .venv/bin/activate
fi

# Get absolute path to the JSON config file
CONFIG_PATH=$(realpath openai_codex_mcp.json)

# Check if Claude CLI is available
if command -v claude &> /dev/null; then
    echo "Claude CLI found. Would you like to install the MCP tool configuration? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        # Try to install the tool
        echo "Installing OpenAI Codex MCP tool configuration..."
        claude mcp add "$CONFIG_PATH" || echo "Failed to install MCP tool. You may need to do this manually."
    fi
else
    echo "Claude CLI not found. You'll need to configure the MCP tool manually."
    echo "See README.md for instructions."
fi

# Start the server
echo "Starting OpenAI Codex MCP server..."
codex_server