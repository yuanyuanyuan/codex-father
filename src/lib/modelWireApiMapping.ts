// 模型与 Wire API 映射
export interface ModelWireApiMapping {
  model: string;
  recommendedWireApi: 'chat' | 'responses';
  alternatives?: ('chat' | 'responses')[];
  notes?: string;
}

export const MODEL_WIRE_API_MAP: Record<string, ModelWireApiMapping> = {
  'gpt-5-codex': {
    model: 'gpt-5-codex',
    recommendedWireApi: 'responses',
    alternatives: ['responses'],
    notes: 'GPT-5 Codex requires responses API for optimal performance',
  },
  'gpt-4': {
    model: 'gpt-4',
    recommendedWireApi: 'chat',
    alternatives: ['chat'],
    notes: 'GPT-4 works best with chat API',
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    recommendedWireApi: 'chat',
    alternatives: ['chat'],
    notes: 'GPT-4 Turbo optimized for chat API',
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    recommendedWireApi: 'chat',
    alternatives: ['chat'],
    notes: 'GPT-3.5 Turbo uses chat API',
  },
  'claude-3-opus-20240229': {
    model: 'claude-3-opus-20240229',
    recommendedWireApi: 'chat',
    alternatives: ['chat'],
    notes: 'Claude 3 Opus uses chat API',
  },
  'claude-3-sonnet-20240229': {
    model: 'claude-3-sonnet-20240229',
    recommendedWireApi: 'chat',
    alternatives: ['chat'],
    notes: 'Claude 3 Sonnet uses chat API',
  },
};

export function getRecommendedWireApi(model: string): 'chat' | 'responses' | null {
  const mapping = MODEL_WIRE_API_MAP[model];
  return mapping ? mapping.recommendedWireApi : null;
}

export function validateWireApiForModel(
  model: string,
  wireApi: 'chat' | 'responses'
): {
  valid: boolean;
  recommended: 'chat' | 'responses';
  message?: string;
} {
  const mapping = MODEL_WIRE_API_MAP[model];

  if (!mapping) {
    return {
      valid: true, // 未知模型，允许任何配置
      recommended: wireApi,
      message: `Unknown model: ${model}. Using specified wire_api: ${wireApi}`,
    };
  }

  const valid = mapping.alternatives?.includes(wireApi) || mapping.recommendedWireApi === wireApi;

  return {
    valid,
    recommended: mapping.recommendedWireApi,
    message: valid
      ? undefined
      : `For model ${model}, recommended wire_api is ${mapping.recommendedWireApi}, not ${wireApi}. ${mapping.notes}`,
  };
}

export function getModelsForWireApi(wireApi: 'chat' | 'responses'): string[] {
  return Object.entries(MODEL_WIRE_API_MAP)
    .filter(
      ([_, mapping]) =>
        mapping.alternatives?.includes(wireApi) || mapping.recommendedWireApi === wireApi
    )
    .map(([model, _]) => model);
}
