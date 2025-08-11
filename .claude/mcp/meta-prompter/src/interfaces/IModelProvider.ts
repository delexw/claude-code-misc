import type { LanguageModel } from 'ai';

export interface IModelProvider {
  getModel(modelName: string, apiKey: string): LanguageModel;
  getSupportedModels(): string[];
}