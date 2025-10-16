import { describe, it, expect } from 'vitest';

// 被测模块（相对路径从 tests/unit/ 到 src/）
import {
  MODEL_WIRE_API_MAP,
  getRecommendedWireApi,
  validateWireApiForModel,
  getModelsForWireApi,
  type WireApi,
} from '../../core/lib/queue/api.js';

describe('MODEL_WIRE_API_MAP 映射正确性', () => {
  it('gpt-5-codex → responses', () => {
    expect(MODEL_WIRE_API_MAP['gpt-5-codex']).toBe('responses');
  });

  it('gpt-4 → chat', () => {
    expect(MODEL_WIRE_API_MAP['gpt-4']).toBe('chat');
  });

  it('gpt-4-turbo → chat', () => {
    expect(MODEL_WIRE_API_MAP['gpt-4-turbo']).toBe('chat');
  });

  it('gpt-3.5-turbo → chat', () => {
    expect(MODEL_WIRE_API_MAP['gpt-3.5-turbo']).toBe('chat');
  });

  it('claude-3-opus-20240229 → chat', () => {
    expect(MODEL_WIRE_API_MAP['claude-3-opus-20240229']).toBe('chat');
  });

  it('claude-3-sonnet-20240229 → chat', () => {
    expect(MODEL_WIRE_API_MAP['claude-3-sonnet-20240229']).toBe('chat');
  });
});

describe('查询函数行为', () => {
  it('getRecommendedWireApi 返回正确建议', () => {
    expect(getRecommendedWireApi('gpt-5-codex')).toBe('responses');
    expect(getRecommendedWireApi('gpt-4')).toBe('chat');
    expect(getRecommendedWireApi('unknown-model')).toBeNull();
  });

  it('validateWireApiForModel 校验配置正确与错误', () => {
    expect(validateWireApiForModel('gpt-5-codex', 'responses')).toBe(true);
    expect(validateWireApiForModel('gpt-5-codex', 'chat')).toBe(false);

    // 未知模型：允许任意 wire_api
    expect(validateWireApiForModel('unknown-model', 'chat')).toBe(true);
    expect(validateWireApiForModel('unknown-model', 'responses')).toBe(true);
  });

  it('getModelsForWireApi 返回模型列表', () => {
    const responsesModels = getModelsForWireApi('responses');
    expect(responsesModels.sort()).toEqual(['gpt-5-codex']);

    const expectedChatModels = [
      // OpenAI
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4-32k',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      // Anthropic
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2',
    ].sort();

    const chatModels = getModelsForWireApi('chat').sort();
    expect(chatModels).toEqual(expectedChatModels);
  });
});

describe('性能与边界', () => {
  it('查询为 O(1) 且 1000 次 < 5ms', () => {
    const keysToQuery = [
      'gpt-5-codex',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'unknown-model',
    ];

    // 预热
    for (let i = 0; i < keysToQuery.length; i++) {
      void getRecommendedWireApi(keysToQuery[i]);
    }

    const start = process.hrtime.bigint();
    let acc: (WireApi | null) | undefined;
    for (let i = 0; i < 1000; i++) {
      const key = keysToQuery[i % keysToQuery.length];
      acc = getRecommendedWireApi(key);
    }
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000; // ns → ms

    // 限制：1000 次查询 < 5ms
    expect(durationMs).toBeLessThan(5);
    expect(acc).not.toBeUndefined();
  });

  it('边界：空字符串、未知模型、大小写敏感', () => {
    expect(getRecommendedWireApi('')).toBeNull();
    expect(getRecommendedWireApi('UNKNOWN')).toBeNull();
    expect(getRecommendedWireApi('gpt-4'.toUpperCase())).toBeNull();
    expect(getRecommendedWireApi('gpt-4')).toBe('chat');
  });
});
