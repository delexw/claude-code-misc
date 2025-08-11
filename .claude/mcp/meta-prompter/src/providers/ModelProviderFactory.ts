import { IModelProvider } from '../interfaces/IModelProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';

export class ModelProviderFactory {
  private static readonly providers: IModelProvider[] = [
    new OpenAIProvider(),
    new AnthropicProvider(),
  ];

  static getProvider(modelName: string): IModelProvider {
    // Find the provider that supports this model
    for (const provider of this.providers) {
      if (provider.getSupportedModels().includes(modelName)) {
        return provider;
      }
    }

    throw new Error(
      `Unsupported model: ${modelName}. Supported models: ${this.getSupportedModels().join(', ')}`,
    );
  }

  static getSupportedModels(): string[] {
    // Collect all supported models from all providers
    return this.providers.flatMap(provider => provider.getSupportedModels());
  }
}