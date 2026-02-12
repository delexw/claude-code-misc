import { createProviderRegistry, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

type ProviderKey = `anthropic:${string}` | `openai:${string}`;

export function resolveModel(modelKey: string, apiKey: string): LanguageModel {
  const registry = createProviderRegistry({
    anthropic: createAnthropic({ apiKey }),
    openai: createOpenAI({ apiKey }),
  });

  return registry.languageModel(modelKey as ProviderKey);
}
