/**
 * 模型与 wire_api 映射表
 *
 * ⚠️ Critical: gpt-5-codex 必须使用 'responses'，使用 'chat' 会导致 HTTP 405 错误
 *
 * @module modelWireApiMapping
 */

export type WireApi = 'chat' | 'responses';

/**
 * 模型到 wire_api 的映射关系
 *
 * 数据来源: specs/008-ultrathink-codex-0/research.md#6-模型与wire_api映射
 */
export const MODEL_WIRE_API_MAP: Record<string, WireApi> = {
  // OpenAI Codex (必须使用 responses)
  'gpt-5-codex': 'responses',

  // OpenAI GPT-4 系列 (使用 chat)
  'gpt-4': 'chat',
  'gpt-4-turbo': 'chat',
  'gpt-4-turbo-preview': 'chat',
  'gpt-4-32k': 'chat',

  // OpenAI GPT-3.5 系列 (使用 chat)
  'gpt-3.5-turbo': 'chat',
  'gpt-3.5-turbo-16k': 'chat',

  // Anthropic Claude 系列 (使用 chat)
  'claude-3-opus-20240229': 'chat',
  'claude-3-sonnet-20240229': 'chat',
  'claude-3-haiku-20240307': 'chat',
  'claude-2.1': 'chat',
  'claude-2': 'chat',
};

/**
 * 获取模型推荐的 wire_api
 *
 * @param model - 模型名称
 * @returns 推荐的 wire_api，若模型未知则返回 null
 *
 * @example
 * ```typescript
 * getRecommendedWireApi('gpt-5-codex') // => 'responses'
 * getRecommendedWireApi('gpt-4')       // => 'chat'
 * getRecommendedWireApi('unknown')     // => null
 * ```
 */
export function getRecommendedWireApi(model: string): WireApi | null {
  return MODEL_WIRE_API_MAP[model] ?? null;
}

/**
 * 验证模型与 wire_api 的配置是否匹配
 *
 * @param model - 模型名称
 * @param wireApi - 配置的 wire_api
 * @returns 配置是否正确（未知模型总是返回 true）
 *
 * @example
 * ```typescript
 * validateWireApiForModel('gpt-5-codex', 'responses') // => true
 * validateWireApiForModel('gpt-5-codex', 'chat')      // => false (会导致 405 错误)
 * validateWireApiForModel('unknown-model', 'chat')    // => true (未知模型允许任意配置)
 * ```
 */
export function validateWireApiForModel(model: string, wireApi: WireApi): boolean {
  const recommended = MODEL_WIRE_API_MAP[model];
  if (!recommended) {
    // 未知模型，允许任意 wire_api
    return true;
  }
  return recommended === wireApi;
}

/**
 * 获取使用指定 wire_api 的所有模型
 *
 * @param wireApi - wire_api 类型
 * @returns 使用该 wire_api 的模型列表
 *
 * @example
 * ```typescript
 * getModelsForWireApi('responses') // => ['gpt-5-codex']
 * getModelsForWireApi('chat')      // => ['gpt-4', 'gpt-4-turbo', ...]
 * ```
 */
export function getModelsForWireApi(wireApi: WireApi): string[] {
  return Object.entries(MODEL_WIRE_API_MAP)
    .filter(([, api]) => api === wireApi)
    .map(([model]) => model);
}
