import { z } from 'zod';
export var JSONRPCErrorCode;
(function (JSONRPCErrorCode) {
    JSONRPCErrorCode[JSONRPCErrorCode["PARSE_ERROR"] = -32700] = "PARSE_ERROR";
    JSONRPCErrorCode[JSONRPCErrorCode["INVALID_REQUEST"] = -32600] = "INVALID_REQUEST";
    JSONRPCErrorCode[JSONRPCErrorCode["METHOD_NOT_FOUND"] = -32601] = "METHOD_NOT_FOUND";
    JSONRPCErrorCode[JSONRPCErrorCode["INVALID_PARAMS"] = -32602] = "INVALID_PARAMS";
    JSONRPCErrorCode[JSONRPCErrorCode["INTERNAL_ERROR"] = -32603] = "INTERNAL_ERROR";
    JSONRPCErrorCode[JSONRPCErrorCode["SERVER_ERROR"] = -32000] = "SERVER_ERROR";
})(JSONRPCErrorCode || (JSONRPCErrorCode = {}));
export const JSONRPCErrorSchema = z.object({
    code: z.nativeEnum(JSONRPCErrorCode),
    message: z.string(),
    data: z.unknown().optional(),
});
export const JSONRPCRequestSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number()]),
    method: z.string(),
    params: z.unknown().optional(),
});
export const JSONRPCResponseSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number()]),
    result: z.unknown().optional(),
    error: JSONRPCErrorSchema.optional(),
});
export const JSONRPCNotificationSchema = z.object({
    jsonrpc: z.literal('2.0'),
    method: z.string(),
    params: z.unknown().optional(),
});
export const MCPClientCapabilitiesSchema = z.object({
    roots: z
        .object({
        listChanged: z.boolean().optional(),
    })
        .optional(),
    sampling: z.record(z.unknown()).optional(),
});
export const MCPClientInfoSchema = z.object({
    name: z.string(),
    version: z.string(),
});
export const MCPInitializeParamsSchema = z.object({
    protocolVersion: z.string(),
    capabilities: MCPClientCapabilitiesSchema,
    clientInfo: MCPClientInfoSchema,
});
export const MCPServerCapabilitiesSchema = z.object({
    tools: z
        .object({
        listChanged: z.boolean().optional(),
    })
        .optional(),
    notifications: z.record(z.unknown()).optional(),
});
export const MCPServerInfoSchema = z.object({
    name: z.string(),
    version: z.string(),
});
export const MCPInitializeResultSchema = z.object({
    protocolVersion: z.string(),
    capabilities: MCPServerCapabilitiesSchema,
    serverInfo: MCPServerInfoSchema,
});
export const MCPToolInputSchemaSchema = z.object({
    type: z.literal('object'),
    properties: z.record(z.unknown()),
    required: z.array(z.string()).optional(),
    additionalProperties: z.boolean().optional(),
});
export const MCPToolSchema = z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: MCPToolInputSchemaSchema,
});
export const MCPToolsListResultSchema = z.object({
    tools: z.array(MCPToolSchema),
});
export const MCPToolsCallParamsSchema = z.object({
    name: z.string(),
    arguments: z.record(z.unknown()),
});
export const MCPToolsCallResultSchema = z.object({
    status: z.enum(['accepted', 'rejected']),
    jobId: z.string().uuid(),
    conversationId: z.string().uuid().optional(),
    message: z.string(),
});
export var MCPProgressEventType;
(function (MCPProgressEventType) {
    MCPProgressEventType["TASK_STARTED"] = "task-started";
    MCPProgressEventType["AGENT_MESSAGE"] = "agent-message";
    MCPProgressEventType["TASK_COMPLETE"] = "task-complete";
    MCPProgressEventType["TASK_ERROR"] = "task-error";
    MCPProgressEventType["APPROVAL_REQUIRED"] = "approval-required";
})(MCPProgressEventType || (MCPProgressEventType = {}));
export const MCPProgressNotificationParamsSchema = z.object({
    jobId: z.string().uuid(),
    eventType: z.nativeEnum(MCPProgressEventType),
    eventData: z.record(z.unknown()),
    timestamp: z.string().datetime(),
});
export const MCPCancelNotificationParamsSchema = z.object({
    requestId: z.union([z.string(), z.number()]),
    reason: z.string().optional(),
});
export var MCPMethod;
(function (MCPMethod) {
    MCPMethod["INITIALIZE"] = "initialize";
    MCPMethod["TOOLS_LIST"] = "tools/list";
    MCPMethod["TOOLS_CALL"] = "tools/call";
    MCPMethod["PROGRESS"] = "codex-father/progress";
    MCPMethod["CANCELLED"] = "notifications/cancelled";
})(MCPMethod || (MCPMethod = {}));
export function createJSONRPCRequest(id, method, params) {
    const request = {
        jsonrpc: '2.0',
        id,
        method,
    };
    if (params !== undefined) {
        request.params = params;
    }
    return request;
}
export function createJSONRPCResponse(id, result) {
    return {
        jsonrpc: '2.0',
        id,
        result,
    };
}
export function createJSONRPCErrorResponse(id, error) {
    return {
        jsonrpc: '2.0',
        id,
        error,
    };
}
export function createJSONRPCNotification(method, params) {
    const notification = {
        jsonrpc: '2.0',
        method,
    };
    if (params !== undefined) {
        notification.params = params;
    }
    return notification;
}
export function isJSONRPCRequest(msg) {
    return JSONRPCRequestSchema.safeParse(msg).success;
}
export function isJSONRPCResponse(msg) {
    return JSONRPCResponseSchema.safeParse(msg).success;
}
export function isJSONRPCNotification(msg) {
    return JSONRPCNotificationSchema.safeParse(msg).success;
}
export function isJSONRPCError(msg) {
    if (!isJSONRPCResponse(msg)) {
        return false;
    }
    return msg.error !== undefined;
}
