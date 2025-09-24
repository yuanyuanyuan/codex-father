#!/usr/bin/env python3
"""
OpenAI Codex MCP Server for use with Claude Code.
This server implements JSON-RPC 2.0 over HTTP to wrap the OpenAI Codex CLI.
"""

import os
import sys
import json
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(
    title="OpenAI Codex MCP Server",
    description="An MCP server to wrap the OpenAI Codex CLI for use with Claude Code",
    version="0.1.0",
)

def run_codex(prompt: str, model: Optional[str] = None, 
              images: Optional[List[str]] = None, quiet: bool = True,
              additional_args: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Run the OpenAI Codex CLI tool with the given parameters.
    
    Args:
        prompt: The prompt to send to Codex
        model: The model to use (e.g., "o4-mini", "o4-preview")
        images: List of image paths to include
        quiet: Run in non-interactive mode
        additional_args: Additional CLI arguments to pass to Codex
        
    Returns:
        A dictionary containing the response from Codex
    """
    # Build command
    cmd = ["codex"]
    
    # Add options
    if quiet:
        cmd.append("--quiet")
    
    if model:
        cmd.extend(["--model", model])
    
    if images:
        for image_path in images:
            # For temp files received from Claude, save the content
            if image_path.startswith("data:"):
                with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp:
                    # Handle data URI format if needed
                    if "base64," in image_path:
                        import base64
                        header, encoded = image_path.split(",", 1)
                        image_data = base64.b64decode(encoded)
                        temp.write(image_data)
                        image_path = temp.name
                    else:
                        # Otherwise save as-is
                        temp.write(image_path.encode())
                        image_path = temp.name
            
            cmd.extend(["--image", image_path])
    
    if additional_args:
        cmd.extend(additional_args)
    
    # Add the prompt
    cmd.append(prompt)
    
    print(f"Executing command: {' '.join(cmd)}", file=sys.stderr)
    
    try:
        # Run the command and capture output
        result = subprocess.run(
            cmd,
            text=True,
            capture_output=True,
            check=True
        )
        
        # Parse the output - for quiet mode, we get just the final output
        output = result.stdout.strip()
        
        return {
            "status": "success",
            "output": output,
            "stderr": result.stderr
        }
    except subprocess.CalledProcessError as e:
        print(f"Error running codex: {e}", file=sys.stderr)
        return {
            "status": "error",
            "error": str(e),
            "output": e.stdout,
            "stderr": e.stderr,
            "exit_code": e.returncode
        }
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/", summary="JSON-RPC endpoint")
async def rpc(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    jsonrpc = payload.get("jsonrpc")
    method = payload.get("method")
    id_ = payload.get("id")
    params = payload.get("params", {})

    if jsonrpc != "2.0" or not method or id_ is None:
        raise HTTPException(status_code=400, detail="Invalid JSON-RPC request")

    # Log the request
    print(f"Received request: method={method}, params={params}", file=sys.stderr)

    try:
        if method == "codex_completion":
            # Extract parameters
            prompt = params.get("prompt", "")
            model = params.get("model", "o4-mini")
            images = params.get("images", [])
            additional_args = params.get("additional_args", [])
            
            if not prompt:
                error = {"code": -32602, "message": "Missing required parameter: prompt"}
                return JSONResponse({"jsonrpc": "2.0", "id": id_, "error": error}, status_code=400)
            
            result = run_codex(
                prompt=prompt,
                model=model,
                images=images,
                additional_args=additional_args
            )
            
            return JSONResponse({"jsonrpc": "2.0", "id": id_, "result": result})
            
        elif method == "write_code":
            # Extract parameters
            task = params.get("task", "")
            language = params.get("language", "")
            model = params.get("model", "o4-mini")
            
            if not task:
                error = {"code": -32602, "message": "Missing required parameter: task"}
                return JSONResponse({"jsonrpc": "2.0", "id": id_, "error": error}, status_code=400)
                
            if not language:
                error = {"code": -32602, "message": "Missing required parameter: language"}
                return JSONResponse({"jsonrpc": "2.0", "id": id_, "error": error}, status_code=400)
                
            # Build prompt for code generation
            prompt = f"Write {language} code for the following task:\n\n{task}\n\nPlease provide only the code with helpful comments."
            
            result = run_codex(
                prompt=prompt,
                model=model
            )
            
            return JSONResponse({"jsonrpc": "2.0", "id": id_, "result": result})
            
        elif method == "explain_code":
            # Extract parameters
            code = params.get("code", "")
            model = params.get("model", "o4-mini")
            
            if not code:
                error = {"code": -32602, "message": "Missing required parameter: code"}
                return JSONResponse({"jsonrpc": "2.0", "id": id_, "error": error}, status_code=400)
                
            # Build prompt for code explanation
            prompt = f"Explain the following code in detail, including what it does, how it works, and any notable patterns or algorithms used:\n\n```\n{code}\n```"
            
            result = run_codex(
                prompt=prompt,
                model=model
            )
            
            return JSONResponse({"jsonrpc": "2.0", "id": id_, "result": result})
            
        elif method == "debug_code":
            # Extract parameters
            code = params.get("code", "")
            issue_description = params.get("issue_description", "")
            model = params.get("model", "o4-mini")
            
            if not code:
                error = {"code": -32602, "message": "Missing required parameter: code"}
                return JSONResponse({"jsonrpc": "2.0", "id": id_, "error": error}, status_code=400)
                
            # Build prompt for debugging
            prompt = f"Debug the following code"
            if issue_description:
                prompt += f", which has the following issue: {issue_description}"
            prompt += f":\n\n```\n{code}\n```\n\nPlease identify any bugs, explain them, and provide the corrected code."
            
            result = run_codex(
                prompt=prompt,
                model=model
            )
            
            return JSONResponse({"jsonrpc": "2.0", "id": id_, "result": result})
            
        else:
            error = {"code": -32601, "message": f"Method '{method}' not found"}
            return JSONResponse({"jsonrpc": "2.0", "id": id_, "error": error}, status_code=404)
            
    except Exception as e:
        error = {"code": -32000, "message": str(e)}
        return JSONResponse({"jsonrpc": "2.0", "id": id_, "error": error}, status_code=500)

def main():
    # Check if codex is installed
    try:
        result = subprocess.run(["which", "codex"], capture_output=True, text=True)
        if result.returncode != 0:
            print("ERROR: 'codex' command not found in PATH", file=sys.stderr)
            print("Please install the OpenAI Codex CLI: npm install -g @openai/codex", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"Error checking for codex: {e}", file=sys.stderr)
        sys.exit(1)
        
    port = int(os.getenv("PORT", "8000"))
    print(f"Starting Codex MCP server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")

if __name__ == "__main__":
    main()