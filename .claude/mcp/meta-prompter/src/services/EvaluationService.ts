import { generateObject } from 'ai';
import { IEvaluationService, EvaluationSchema } from '../interfaces/IEvaluationService.js';
import { IModelProvider } from '../interfaces/IModelProvider.js';
import { ILogger } from '../interfaces/ILogger.js';
import { buildEvaluationPrompt } from '../prompt.js';

export class EvaluationService implements IEvaluationService {
  constructor(
    private readonly modelProvider: IModelProvider,
    private readonly logger: ILogger,
    private readonly modelName: string,
    private readonly apiKey: string,
  ) {}

  async evaluate(prompt: string): Promise<string> {
    try {
      const model = this.modelProvider.getModel(this.modelName, this.apiKey);
      
      const result = await generateObject({
        model,
        temperature: 0,
        schema: EvaluationSchema,
        prompt: buildEvaluationPrompt(prompt),
      });

      // Log evaluation result
      await this.logger.logEvaluation(prompt, result);

      return JSON.stringify(result.object);
    } catch (error) {
      console.error('Error calling AI API:', error);
      throw new Error(
        `Failed to evaluate prompt: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}