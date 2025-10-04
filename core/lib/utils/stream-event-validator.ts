import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ValidationError, ValidationResult } from '../types.js';

const ERROR_CODES = {
  NOT_OBJECT: 'STREAM_EVENT_NOT_OBJECT',
  REQUIRED: 'STREAM_EVENT_REQUIRED',
  UNKNOWN_PROPERTY: 'STREAM_EVENT_UNKNOWN_PROPERTY',
  INVALID_TYPE: 'STREAM_EVENT_INVALID_TYPE',
  INVALID_EVENT: 'STREAM_EVENT_INVALID_EVENT',
  INVALID_TIMESTAMP: 'STREAM_EVENT_INVALID_TIMESTAMP',
  INVALID_SEQ: 'STREAM_EVENT_INVALID_SEQ',
  INVALID_DATA: 'STREAM_EVENT_INVALID_DATA',
} as const;

const RFC3339_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;

type StreamEventSchemaProperty = {
  readonly type?: string;
  readonly enum?: readonly string[];
  readonly format?: string;
};

interface StreamEventSchema {
  readonly additionalProperties?: boolean;
  readonly properties: Record<string, StreamEventSchemaProperty>;
  readonly required: readonly string[];
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(moduleDir, '../../../docs/schemas/stream-json-event.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as StreamEventSchema;

const ALLOWED_PROPERTIES = new Set(Object.keys(schema.properties));
const REQUIRED_PROPERTIES = new Set(schema.required);
const ALLOWED_EVENTS = (schema.properties.event?.enum ?? []) as readonly string[];

export type StreamJsonEvent = {
  event: (typeof ALLOWED_EVENTS)[number];
  timestamp: string;
  orchestrationId: string;
  seq: number;
  taskId?: string;
  role?: string;
  agentId?: string;
  data: Record<string, unknown>;
};

export type StreamEventValidationResult =
  | (ValidationResult & { valid: true; event: StreamJsonEvent })
  | (ValidationResult & { valid: false; event?: undefined });

export function validateStreamEvent(input: unknown): StreamEventValidationResult {
  const errors: ValidationError[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    errors.push({
      field: 'root',
      message: 'stream event must be an object',
      code: ERROR_CODES.NOT_OBJECT,
    });
    return { valid: false, errors, warnings: [] };
  }

  const candidate = input as Record<string, unknown>;

  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_PROPERTIES.has(key)) {
      errors.push({ field: key, message: 'unknown property', code: ERROR_CODES.UNKNOWN_PROPERTY });
    }
  }

  for (const field of REQUIRED_PROPERTIES) {
    if (!(field in candidate)) {
      errors.push({ field, message: 'is required', code: ERROR_CODES.REQUIRED });
    }
  }

  const eventValue = candidate.event;
  if (eventValue !== undefined) {
    if (typeof eventValue !== 'string') {
      errors.push({ field: 'event', message: 'must be a string', code: ERROR_CODES.INVALID_TYPE });
    } else if (!ALLOWED_EVENTS.includes(eventValue)) {
      errors.push({
        field: 'event',
        message: 'must match allowed event types',
        code: ERROR_CODES.INVALID_EVENT,
      });
    }
  }

  const timestampValue = candidate.timestamp;
  if (timestampValue !== undefined) {
    if (typeof timestampValue !== 'string') {
      errors.push({
        field: 'timestamp',
        message: 'must be a string',
        code: ERROR_CODES.INVALID_TYPE,
      });
    } else if (!RFC3339_REGEX.test(timestampValue) || Number.isNaN(Date.parse(timestampValue))) {
      errors.push({
        field: 'timestamp',
        message: 'must follow RFC3339 format',
        code: ERROR_CODES.INVALID_TIMESTAMP,
      });
    }
  }

  const orchestrationIdValue = candidate.orchestrationId;
  if (orchestrationIdValue !== undefined && typeof orchestrationIdValue !== 'string') {
    errors.push({
      field: 'orchestrationId',
      message: 'must be a string',
      code: ERROR_CODES.INVALID_TYPE,
    });
  }

  const seqValue = candidate.seq;
  if (seqValue !== undefined) {
    if (typeof seqValue !== 'number' || !Number.isInteger(seqValue) || seqValue < 0) {
      errors.push({
        field: 'seq',
        message: 'must be a non-negative integer',
        code: ERROR_CODES.INVALID_SEQ,
      });
    }
  }

  const dataValue = candidate.data;
  if (dataValue !== undefined) {
    if (typeof dataValue !== 'object' || dataValue === null || Array.isArray(dataValue)) {
      errors.push({
        field: 'data',
        message: 'must be a plain object',
        code: ERROR_CODES.INVALID_DATA,
      });
    }
  }

  for (const optionalField of ['taskId', 'role', 'agentId'] as const) {
    const value = candidate[optionalField];
    if (value !== undefined && typeof value !== 'string') {
      errors.push({
        field: optionalField,
        message: 'must be a string',
        code: ERROR_CODES.INVALID_TYPE,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings: [] };
  }

  const normalized: StreamJsonEvent = {
    event: eventValue as StreamJsonEvent['event'],
    timestamp: timestampValue as string,
    orchestrationId: orchestrationIdValue as string,
    seq: seqValue as number,
    data: dataValue as Record<string, unknown>,
  };

  if (typeof candidate.taskId === 'string') {
    normalized.taskId = candidate.taskId;
  }
  if (typeof candidate.role === 'string') {
    normalized.role = candidate.role;
  }
  if (typeof candidate.agentId === 'string') {
    normalized.agentId = candidate.agentId;
  }

  return { valid: true, errors: [], warnings: [], event: normalized };
}
