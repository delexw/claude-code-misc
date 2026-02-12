import { generateText, Output, type LanguageModel } from 'ai';
import { IEvaluationService, EvaluationSchema } from '../interfaces/IEvaluationService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { buildEvaluationPrompt } from '../prompt.js';

export class EvaluationService implements IEvaluationService {
  constructor(
    private readonly model: LanguageModel,
    private readonly logger: ILogger,
  ) {}

  async evaluate(prompt: string): Promise<string> {
    try {
      const { output } = await generateText({
        model: this.model,
        temperature: 0,
        output: Output.object({ schema: EvaluationSchema }),
        prompt: buildEvaluationPrompt(prompt),
      });

      if (!output) {
        throw new Error('No structured output generated');
      }

      // Log evaluation result
      await this.logger.logEvaluation(prompt, output);

      return JSON.stringify(output);
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
