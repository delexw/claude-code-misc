import fs from 'fs/promises';
import { ILogger } from '../interfaces/ILogger.js';
import { EvaluationResult } from '../interfaces/IEvaluationService.js';

export class FileLogger implements ILogger {
  constructor(private readonly filePath: string = 'evaluation_result.jsonl') {}

  async logEvaluation(prompt: string, evaluation: EvaluationResult): Promise<void> {
    try {
      const logEntry = JSON.stringify({ prompt, evaluation }) + '\n';
      await fs.appendFile(this.filePath, logEntry);
    } catch (error) {
      console.error('Failed to log evaluation:', error);
      // Don't throw - logging failure shouldn't break the evaluation
    }
  }
}
