import { createAnthropic } from '@ai-sdk/anthropic';
import { IModelProvider } from '../interfaces/IModelProvider.js';

export class AnthropicProvider implements IModelProvider {
  private readonly models = {
    'opus-4-1': 'claude-opus-4-1-20250805',
    'sonnet-4': 'claude-sonnet-4-20250514',
    'sonnet-4.5': 'claude-sonnet-4-5-20250929',
  };

  getModel(modelName: string, apiKey: string) {
    if (!this.models[modelName as keyof typeof this.models]) {
      throw new Error(`Unsupported Anthropic model: ${modelName}`);
    }

    const anthropic = createAnthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });
    
    return anthropic(this.models[modelName as keyof typeof this.models]);
  }

  getSupportedModels(): string[] {
    return Object.keys(this.models);
  }
}