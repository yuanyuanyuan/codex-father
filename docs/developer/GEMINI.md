# Gemini Code Assistant Context

This document provides context for the Gemini Code Assistant to understand the
`codex-father` project.

## Project Overview

`codex-father` is a TypeScript-based MCP (Model Context Protocol) server that
exposes the "Codex CLI" as a standard MCP tool. It enables asynchronous
execution of Codex CLI commands, manages their lifecycle, and provides an
approval mechanism for security.

The project is structured as a monorepo using npm workspaces, with the core
logic in the root package and the MCP server implementation in
`mcp/codex-mcp-server`.

### Key Technologies

- **Language:** TypeScript
- **Platform:** Node.js
- **Server:** Express
- **CLI:** Commander
- **Testing:** Vitest
- **Linting:** ESLint
- **Formatting:** Prettier
- **CI/CD:** GitHub Actions, Semantic Release

### Architecture

The application is designed with a modular architecture, separating concerns
into the following core components:

- **MCP Server (`core/mcp`):** Implements the MCP protocol using
  `@modelcontextprotocol/sdk`, handling `tools/list` and `tools/call` requests.
- **Process Manager (`core/process`):** Manages the lifecycle of the Codex CLI
  child process.
- **Session Manager (`core/session`):** Manages sessions and logs events.
- **Approval System (`core/approval`):** Provides a policy engine and terminal
  UI for approving tool calls.
- **Bridge Layer (`core/mcp/bridge-layer.ts`):** Translates between the MCP
  protocol and the underlying Codex CLI tools.

## Building and Running

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

```bash
npm install
```

### Running the MCP Server

To start the MCP server for development:

```bash
npm run dev --workspace=mcp/codex-mcp-server
```

To run the production-ready server:

```bash
npx @starkdev020/codex-father-mcp-server
```

### Running Tests

To run all tests:

```bash
npm test
```

To run tests in watch mode:

```bash
npm run test:watch
```

To see test coverage:

```bash
npm run test:coverage
```

## Development Conventions

### Code Style

The project uses Prettier for code formatting and ESLint for linting. Please run
the following commands before committing changes:

```bash
npm run format
npm run lint
```

### Commit Messages

The project follows the
[Conventional Commits](https://www.conventionalcommits.org/) specification.

### Branching

Please create a new branch for each feature or bug fix.

### Pull Requests

Before submitting a pull request, please ensure that all checks pass:

```bash
npm run check:all
```

---

## 英文思考，中文回复！
