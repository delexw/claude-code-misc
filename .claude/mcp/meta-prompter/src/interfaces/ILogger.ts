import type { GenerateObjectResult } from 'ai';
import type { EvaluationResult } from './IEvaluationService.js';

export interface ILogger {
  logEvaluation(prompt: string, evaluation: GenerateObjectResult<EvaluationResult>): Promise<void>; 
}