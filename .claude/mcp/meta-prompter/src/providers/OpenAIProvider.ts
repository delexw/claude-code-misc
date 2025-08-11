import { createOpenAI } from '@ai-sdk/openai';
import { IModelProvider } from '../interfaces/IModelProvider.js';

export class OpenAIProvider implements IModelProvider {
  private readonly models = {
    'gpt-5': 'gpt-5',
  };

  getModel(modelName: string, apiKey: string) {
    if (!this.models[modelName as keyof typeof this.models]) {
      throw new Error(`Unsupported OpenAI model: ${modelName}`);
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
    });
    
    return openai(this.models[modelName as keyof typeof this.models]);
  }

  getSupportedModels(): string[] {
    return Object.keys(this.models);
  }
}