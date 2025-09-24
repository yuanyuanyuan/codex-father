# openai-codex-mcp

An MCP server to wrap the OpenAI Codex CLI tool for use with Claude Code.

## Overview

This project provides a simple JSON-RPC server that allows Claude Code to interact with the OpenAI Codex CLI tool. This enables Claude Code to use OpenAI's models for code generation, explanation, and problem-solving when needed.

## Video Demo
https://www.loom.com/share/5d9532a79ae24b309af08c1727156f9c?sid=d9277b91-bf8c-43ec-a3c6-dc69fc52e1d2

## Recent Improvements

The MCP server has been enhanced to provide a more intuitive and robust interface:

1. **Specialized Methods**: Added dedicated methods for common coding tasks:
   - `write_code`: Generate code for a specific task in a specified language
   - `explain_code`: Get detailed explanations of how code works
   - `debug_code`: Find and fix bugs in problematic code

2. **Model Selection**: Clearly defined model options with defaults:
   - o4-mini
   - o4-preview
   - o4-pro
   - o4-latest

3. **Simplified Syntax**: More intuitive parameter naming and structure for easier integration

These improvements make it easier for Claude Code to use OpenAI's models for specific programming tasks without requiring complex prompt engineering.

## Prerequisites

- Python 3.12+
- OpenAI Codex CLI tool (`npm install -g @openai/codex`)
- Valid OpenAI API key (for the Codex CLI, not for this server)

## Installation and Setup

This project uses a PEP‑621 `pyproject.toml`. Follow these steps:

```bash
# 1. Create & activate a venv
uv venv                     # creates a .venv/ directory
source .venv/bin/activate   # on Windows: .\.venv\Scripts\activate

# 2. Install package and dependencies into the venv
uv pip install .
```

After installation, the `codex_server` entrypoint is available in your PATH.

## Running the Server

### Quick Start
Use the provided setup script to automatically set up the environment and start the server:

```bash
./setup_and_run.sh
```

This script will:
- Check for the `codex` CLI installation
- Set up a Python virtual environment if needed
- Install the MCP tool via the Claude CLI if available
- Start the MCP server

### Manual Start
If you prefer to start the server manually:

1. Make sure the Codex CLI is installed and properly configured with your OpenAI API key
2. Start the server:
   ```bash
   codex_server
   ```
   *Alternatively, use uvicorn directly:* `uvicorn codex_server:app`

## Integrating with Claude Code

Once your MCP server is running, you can register it with Claude Code using either of these methods:

### Method 1: Using the Claude CLI (Recommended)

The repository includes a configuration file that can be installed directly using the Claude CLI:

```bash
# Install the MCP tool directly from the JSON config
claude mcp add /path/to/openai_codex_mcp.json

# Verify the tool was installed correctly
claude mcp list
```

### Method 2: Manual Configuration via UI

Alternatively, you can register the tool manually:

1. In Claude Code, navigate to **Settings → Tools → Manage MCP Tools**.
2. Create a new tool with:
   - **Name**: `openai_codex`
   - **Description**: `OpenAI Codex CLI integration via MCP server`
   - **Base URL**: `http://localhost:8000/`
   - **Protocol**: `JSON-RPC 2.0`
   - **Authentication**: _leave blank_
3. Save the tool.

Now, Claude Code can use the OpenAI Codex CLI tool for tasks where a different perspective or approach is desired. You can invoke it by asking Claude to use the OpenAI models for a particular task.

## API Usage

The MCP server provides multiple methods to interact with OpenAI's models for different coding tasks.

### Method 1: General Completion

For flexible, custom prompts to OpenAI:

```bash
curl -X POST http://localhost:8000/ \
     -H 'Content-Type: application/json' \
     -d '{
       "jsonrpc": "2.0",
       "method": "codex_completion",
       "params": {
         "prompt": "Write a JavaScript function to sort an array of objects by a property value",
         "model": "o4-mini"
       },
       "id": 1
     }'
```

### Method 2: Write Code

Specialized method for code generation with language specification:

```bash
curl -X POST http://localhost:8000/ \
     -H 'Content-Type: application/json' \
     -d '{
       "jsonrpc": "2.0",
       "method": "write_code",
       "params": {
         "task": "Calculate the first 100 Fibonacci numbers and return them as an array",
         "language": "python",
         "model": "o4-mini"
       },
       "id": 1
     }'
```

### Method 3: Explain Code

Specialized method for code explanation:

```bash
curl -X POST http://localhost:8000/ \
     -H 'Content-Type: application/json' \
     -d '{
       "jsonrpc": "2.0",
       "method": "explain_code",
       "params": {
         "code": "def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)",
         "model": "o4-mini"
       },
       "id": 1
     }'
```

### Method 4: Debug Code

Specialized method for finding and fixing bugs:

```bash
curl -X POST http://localhost:8000/ \
     -H 'Content-Type: application/json' \
     -d '{
       "jsonrpc": "2.0",
       "method": "debug_code",
       "params": {
         "code": "function fibonacci(n) {\n  if (n <= 0) return [];\n  if (n === 1) return [1];\n  let sequence = [1, 1];\n  for (let i = 2; i <= n; i++) {\n    sequence.push(sequence[i-2] + sequence[i-1]);\n  }\n  return sequence;\n}",
         "issue_description": "It generates one too many Fibonacci numbers",
         "model": "o4-mini"
       },
       "id": 1
     }'
```

### Available Models

#### Reasoning Models (O-series)
- `o4-mini`: Faster, more affordable reasoning model
- `o3`: Most powerful reasoning model
- `o3-mini`: A small model alternative to o3
- `o1`: Previous full o-series reasoning model
- `o1-mini`: A small model alternative to o1
- `o1-pro`: Version of o1 with more compute for better responses

#### GPT Models
- `gpt-4.1`: Flagship GPT model for complex tasks
- `gpt-4o`: Fast, intelligent, flexible GPT model
- `gpt-4.1-mini`: Balanced for intelligence, speed, and cost
- `gpt-4.1-nano`: Fastest, most cost-effective GPT-4.1 model
- `gpt-4o-mini`: Fast, affordable small model for focused tasks

### Available Parameters

#### General Completion (codex_completion)
- `prompt` (required): The prompt to send to Codex
- `model` (optional): The model to use (e.g., "o4-mini", "o3", "gpt-4.1", "gpt-4o-mini")
- `images` (optional): List of image paths or data URIs to include
- `additional_args` (optional): Additional CLI arguments to pass to Codex

#### Write Code (write_code)
- `task` (required): Description of the coding task
- `language` (required): Programming language for the solution (e.g., "python", "javascript", "java")
- `model` (optional): The model to use

#### Explain Code (explain_code)
- `code` (required): The code to explain
- `model` (optional): The model to use

#### Debug Code (debug_code)
- `code` (required): The code to debug
- `issue_description` (optional): Description of the issue or error
- `model` (optional): The model to use

## Example Usage with Claude Code

Once configured, you can ask Claude to use OpenAI Codex for specific tasks using any of the available methods:

### Using write_code Method

```
User: Can you use OpenAI Codex to write a Python function that generates prime numbers?

Claude: I'll use the OpenAI Codex write_code method to generate that function.

[Claude would use the write_code method with task="Write a Python function that generates prime numbers" and language="python"]
```

### Using explain_code Method

```
User: Can you ask OpenAI Codex to explain how this quicksort algorithm works?

Claude: I'll use OpenAI Codex to explain this algorithm.

[Claude would use the explain_code method with the code provided]
```

### Using debug_code Method

```
User: My JavaScript function has a bug. Can you use OpenAI Codex to debug it?

Claude: I'll ask OpenAI Codex to find and fix the bug in your code.

[Claude would use the debug_code method with the code provided]
```

### Specifying a Model

```
User: Can you use OpenAI Codex with the o4-preview model to write an efficient implementation of a binary search tree?

Claude: I'll use the o4-preview model to generate that implementation.

[Claude would use the specified model with the appropriate method]
```

This allows you to leverage both Claude and OpenAI's capabilities seamlessly within the same interface, with specialized methods for common coding tasks.