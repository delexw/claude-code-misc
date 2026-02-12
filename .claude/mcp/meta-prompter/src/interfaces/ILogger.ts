import type { EvaluationResult } from './IEvaluationService.js';

export interface ILogger {
  logEvaluation(prompt: string, evaluation: EvaluationResult): Promise<void>;
}
