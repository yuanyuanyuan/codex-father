import type { CLIParser } from '../parser.js';
import { MCPServer } from '../../mcp/server.js';
export declare function registerMCPCommand(parser: CLIParser): void;
export declare function getMCPServerInstance(): MCPServer | null;
export declare function clearMCPServerInstance(): void;
