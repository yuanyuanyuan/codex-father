# Source Code (`src`)

This directory contains the main source code for the `codex-father` application.
The code is organized into the following subdirectories:

- **`api/`**: Contains the source code for the Express.js server that exposes
  the MCP (Model Context Protocol) tool.
- **`cli/`**: Contains the implementation of the command-line interface (CLI)
  using Commander.js.
- **`lib/`**: Contains the core business logic, including the process manager,
  session manager, and approval system.
- **`mcp/`**: Contains the MCP (Model Context Protocol) server implementation,
  including the bridge layer that translates between the MCP protocol and the
  underlying Codex CLI tools.
- **`_archived/`**: Contains archived or deprecated source code that is no
  longer in use but is kept for reference.

For more detailed information about the architecture, please refer to the
[architecture documentation](../docs/architecture/README.md).
