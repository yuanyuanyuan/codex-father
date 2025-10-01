import { z } from 'zod';
export type JSONRPCVersion = '2.0';
export type JSONRPCId = string | number;
export declare enum JSONRPCErrorCode {
    PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603,
    SERVER_ERROR = -32000
}
export interface JSONRPCError {
    code: JSONRPCErrorCode;
    message: string;
    data?: unknown;
}
export declare const JSONRPCErrorSchema: z.ZodObject<{
    code: z.ZodNativeEnum<typeof JSONRPCErrorCode>;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    code: JSONRPCErrorCode;
    message: string;
    data?: unknown;
}, {
    code: JSONRPCErrorCode;
    message: string;
    data?: unknown;
}>;
export interface JSONRPCRequest<T = unknown> {
    jsonrpc: JSONRPCVersion;
    id: JSONRPCId;
    method: string;
    params?: T;
}
export declare const JSONRPCRequestSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    method: z.ZodString;
    params: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    id: string | number;
    method: string;
    jsonrpc: "2.0";
    params?: unknown;
}, {
    id: string | number;
    method: string;
    jsonrpc: "2.0";
    params?: unknown;
}>;
export interface JSONRPCResponse<T = unknown> {
    jsonrpc: JSONRPCVersion;
    id: JSONRPCId;
    result?: T;
    error?: JSONRPCError;
}
export declare const JSONRPCResponseSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodNativeEnum<typeof JSONRPCErrorCode>;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: JSONRPCErrorCode;
        message: string;
        data?: unknown;
    }, {
        code: JSONRPCErrorCode;
        message: string;
        data?: unknown;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string | number;
    jsonrpc: "2.0";
    result?: unknown;
    error?: {
        code: JSONRPCErrorCode;
        message: string;
        data?: unknown;
    } | undefined;
}, {
    id: string | number;
    jsonrpc: "2.0";
    result?: unknown;
    error?: {
        code: JSONRPCErrorCode;
        message: string;
        data?: unknown;
    } | undefined;
}>;
export interface JSONRPCNotification<T = unknown> {
    jsonrpc: JSONRPCVersion;
    method: string;
    params?: T;
}
export declare const JSONRPCNotificationSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    method: z.ZodString;
    params: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    method: string;
    jsonrpc: "2.0";
    params?: unknown;
}, {
    method: string;
    jsonrpc: "2.0";
    params?: unknown;
}>;
export interface MCPClientCapabilities {
    roots?: {
        listChanged?: boolean;
    };
    sampling?: Record<string, unknown>;
}
export declare const MCPClientCapabilitiesSchema: z.ZodObject<{
    roots: z.ZodOptional<z.ZodObject<{
        listChanged: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        listChanged?: boolean | undefined;
    }, {
        listChanged?: boolean | undefined;
    }>>;
    sampling: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    roots?: {
        listChanged?: boolean | undefined;
    } | undefined;
    sampling?: Record<string, unknown> | undefined;
}, {
    roots?: {
        listChanged?: boolean | undefined;
    } | undefined;
    sampling?: Record<string, unknown> | undefined;
}>;
export interface MCPClientInfo {
    name: string;
    version: string;
}
export declare const MCPClientInfoSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
}, {
    name: string;
    version: string;
}>;
export interface MCPInitializeParams {
    protocolVersion: string;
    capabilities: MCPClientCapabilities;
    clientInfo: MCPClientInfo;
}
export declare const MCPInitializeParamsSchema: z.ZodObject<{
    protocolVersion: z.ZodString;
    capabilities: z.ZodObject<{
        roots: z.ZodOptional<z.ZodObject<{
            listChanged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            listChanged?: boolean | undefined;
        }, {
            listChanged?: boolean | undefined;
        }>>;
        sampling: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        roots?: {
            listChanged?: boolean | undefined;
        } | undefined;
        sampling?: Record<string, unknown> | undefined;
    }, {
        roots?: {
            listChanged?: boolean | undefined;
        } | undefined;
        sampling?: Record<string, unknown> | undefined;
    }>;
    clientInfo: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        version: string;
    }, {
        name: string;
        version: string;
    }>;
}, "strip", z.ZodTypeAny, {
    protocolVersion: string;
    capabilities: {
        roots?: {
            listChanged?: boolean | undefined;
        } | undefined;
        sampling?: Record<string, unknown> | undefined;
    };
    clientInfo: {
        name: string;
        version: string;
    };
}, {
    protocolVersion: string;
    capabilities: {
        roots?: {
            listChanged?: boolean | undefined;
        } | undefined;
        sampling?: Record<string, unknown> | undefined;
    };
    clientInfo: {
        name: string;
        version: string;
    };
}>;
export interface MCPServerCapabilities {
    tools?: {
        listChanged?: boolean;
    };
    notifications?: Record<string, unknown>;
}
export declare const MCPServerCapabilitiesSchema: z.ZodObject<{
    tools: z.ZodOptional<z.ZodObject<{
        listChanged: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        listChanged?: boolean | undefined;
    }, {
        listChanged?: boolean | undefined;
    }>>;
    notifications: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    tools?: {
        listChanged?: boolean | undefined;
    } | undefined;
    notifications?: Record<string, unknown> | undefined;
}, {
    tools?: {
        listChanged?: boolean | undefined;
    } | undefined;
    notifications?: Record<string, unknown> | undefined;
}>;
export interface MCPServerInfo {
    name: string;
    version: string;
}
export declare const MCPServerInfoSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
}, {
    name: string;
    version: string;
}>;
export interface MCPInitializeResult {
    protocolVersion: string;
    capabilities: MCPServerCapabilities;
    serverInfo: MCPServerInfo;
}
export declare const MCPInitializeResultSchema: z.ZodObject<{
    protocolVersion: z.ZodString;
    capabilities: z.ZodObject<{
        tools: z.ZodOptional<z.ZodObject<{
            listChanged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            listChanged?: boolean | undefined;
        }, {
            listChanged?: boolean | undefined;
        }>>;
        notifications: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        tools?: {
            listChanged?: boolean | undefined;
        } | undefined;
        notifications?: Record<string, unknown> | undefined;
    }, {
        tools?: {
            listChanged?: boolean | undefined;
        } | undefined;
        notifications?: Record<string, unknown> | undefined;
    }>;
    serverInfo: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        version: string;
    }, {
        name: string;
        version: string;
    }>;
}, "strip", z.ZodTypeAny, {
    protocolVersion: string;
    capabilities: {
        tools?: {
            listChanged?: boolean | undefined;
        } | undefined;
        notifications?: Record<string, unknown> | undefined;
    };
    serverInfo: {
        name: string;
        version: string;
    };
}, {
    protocolVersion: string;
    capabilities: {
        tools?: {
            listChanged?: boolean | undefined;
        } | undefined;
        notifications?: Record<string, unknown> | undefined;
    };
    serverInfo: {
        name: string;
        version: string;
    };
}>;
export interface MCPToolInputSchema {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
}
export declare const MCPToolInputSchemaSchema: z.ZodObject<{
    type: z.ZodLiteral<"object">;
    properties: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    additionalProperties: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[] | undefined;
    additionalProperties?: boolean | undefined;
}, {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[] | undefined;
    additionalProperties?: boolean | undefined;
}>;
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: MCPToolInputSchema;
}
export declare const MCPToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    inputSchema: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        additionalProperties: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[] | undefined;
        additionalProperties?: boolean | undefined;
    }, {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[] | undefined;
        additionalProperties?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[] | undefined;
        additionalProperties?: boolean | undefined;
    };
}, {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[] | undefined;
        additionalProperties?: boolean | undefined;
    };
}>;
export interface MCPToolsListResult {
    tools: MCPTool[];
}
export declare const MCPToolsListResultSchema: z.ZodObject<{
    tools: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        inputSchema: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            additionalProperties: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[] | undefined;
            additionalProperties?: boolean | undefined;
        }, {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[] | undefined;
            additionalProperties?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        inputSchema: {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[] | undefined;
            additionalProperties?: boolean | undefined;
        };
    }, {
        name: string;
        description: string;
        inputSchema: {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[] | undefined;
            additionalProperties?: boolean | undefined;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tools: {
        name: string;
        description: string;
        inputSchema: {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[] | undefined;
            additionalProperties?: boolean | undefined;
        };
    }[];
}, {
    tools: {
        name: string;
        description: string;
        inputSchema: {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[] | undefined;
            additionalProperties?: boolean | undefined;
        };
    }[];
}>;
export interface MCPToolsCallParams {
    name: string;
    arguments: Record<string, unknown>;
}
export declare const MCPToolsCallParamsSchema: z.ZodObject<{
    name: z.ZodString;
    arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    arguments: Record<string, unknown>;
}, {
    name: string;
    arguments: Record<string, unknown>;
}>;
export interface MCPToolsCallResult {
    status: 'accepted' | 'rejected';
    jobId: string;
    conversationId?: string;
    message: string;
}
export declare const MCPToolsCallResultSchema: z.ZodObject<{
    status: z.ZodEnum<["accepted", "rejected"]>;
    jobId: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "accepted" | "rejected";
    message: string;
    jobId: string;
    conversationId?: string | undefined;
}, {
    status: "accepted" | "rejected";
    message: string;
    jobId: string;
    conversationId?: string | undefined;
}>;
export declare enum MCPProgressEventType {
    TASK_STARTED = "task-started",
    AGENT_MESSAGE = "agent-message",
    TASK_COMPLETE = "task-complete",
    TASK_ERROR = "task-error",
    APPROVAL_REQUIRED = "approval-required"
}
export interface MCPProgressNotificationParams {
    jobId: string;
    eventType: MCPProgressEventType;
    eventData: Record<string, unknown>;
    timestamp: string;
}
export declare const MCPProgressNotificationParamsSchema: z.ZodObject<{
    jobId: z.ZodString;
    eventType: z.ZodNativeEnum<typeof MCPProgressEventType>;
    eventData: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    jobId: string;
    timestamp: string;
    eventType: MCPProgressEventType;
    eventData: Record<string, unknown>;
}, {
    jobId: string;
    timestamp: string;
    eventType: MCPProgressEventType;
    eventData: Record<string, unknown>;
}>;
export interface MCPCancelNotificationParams {
    requestId: JSONRPCId;
    reason?: string;
}
export declare const MCPCancelNotificationParamsSchema: z.ZodObject<{
    requestId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    requestId: string | number;
    reason?: string | undefined;
}, {
    requestId: string | number;
    reason?: string | undefined;
}>;
export type MCPInitializeRequest = JSONRPCRequest<MCPInitializeParams>;
export type MCPInitializeResponse = JSONRPCResponse<MCPInitializeResult>;
export type MCPToolsListRequest = JSONRPCRequest<null>;
export type MCPToolsListResponse = JSONRPCResponse<MCPToolsListResult>;
export type MCPToolsCallRequest = JSONRPCRequest<MCPToolsCallParams>;
export type MCPToolsCallResponse = JSONRPCResponse<MCPToolsCallResult>;
export type MCPProgressNotification = JSONRPCNotification<MCPProgressNotificationParams>;
export type MCPCancelNotification = JSONRPCNotification<MCPCancelNotificationParams>;
export declare enum MCPMethod {
    INITIALIZE = "initialize",
    TOOLS_LIST = "tools/list",
    TOOLS_CALL = "tools/call",
    PROGRESS = "codex-father/progress",
    CANCELLED = "notifications/cancelled"
}
export type MCPMessage = MCPInitializeRequest | MCPInitializeResponse | MCPToolsListRequest | MCPToolsListResponse | MCPToolsCallRequest | MCPToolsCallResponse | MCPProgressNotification | MCPCancelNotification;
export declare function createJSONRPCRequest<T>(id: JSONRPCId, method: string, params?: T): JSONRPCRequest<T>;
export declare function createJSONRPCResponse<T>(id: JSONRPCId, result: T): JSONRPCResponse<T>;
export declare function createJSONRPCErrorResponse(id: JSONRPCId, error: JSONRPCError): JSONRPCResponse;
export declare function createJSONRPCNotification<T>(method: string, params?: T): JSONRPCNotification<T>;
export declare function isJSONRPCRequest(msg: unknown): msg is JSONRPCRequest;
export declare function isJSONRPCResponse(msg: unknown): msg is JSONRPCResponse;
export declare function isJSONRPCNotification(msg: unknown): msg is JSONRPCNotification;
export declare function isJSONRPCError(msg: unknown): boolean;
