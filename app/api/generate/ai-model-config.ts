// app/api/generate/ai-model-config.ts
export type ModelProvider = 'openai' | 'google';
export type ModelName = 'gpt-4.1' | 'gemini-2.5-flash';

export interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
}

export const SELECTED_MODEL: ModelName = 'gpt-4.1';
export const MODEL_CONFIGS: Record<ModelName, ModelConfig> = {
  'gpt-4.1': {
    provider: 'openai',
    modelName: 'gpt-4.1',
  },
  'gemini-2.5-flash': {
    provider: 'google',
    modelName: 'gemini-2.5-flash-preview-04-17',
  },
};
