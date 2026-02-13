import { type EvaluationResult } from './interfaces/IEvaluationService.js';
import { resolveModel } from './resolveModel.js';
import { EvaluationService } from './services/EvaluationService.js';
import { FileLogger } from './services/FileLogger.js';

export type { EvaluationResult };

export interface EvaluateOptions {
  modelKey?: string;
  apiKey?: string;
}

export async function evaluate(prompt: string, options?: EvaluateOptions): Promise<EvaluationResult> {
  const modelKey = options?.modelKey
    ?? process.env.PROMPT_EVAL_MODEL
    ?? 'anthropic:claude-sonnet-4-5';
  const apiKey = options?.apiKey ?? process.env.PROMPT_EVAL_API_KEY;

  if (!apiKey) {
    throw new Error(
      'PROMPT_EVAL_API_KEY not configured. Set it as an environment variable or pass --api-key.',
    );
  }

  const model = resolveModel(modelKey, apiKey);
  const logger = new FileLogger();
  const evaluationService = new EvaluationService(model, logger);

  return await evaluationService.evaluate(prompt);
}
