import { z } from 'zod';

export interface IEvaluationService {
  evaluate(prompt: string): Promise<string>;
}

export const EvaluationSchema = z.object({
  scores: z.object({
    clarity: z.number(),
    specificity: z.number(),
    context: z.number(),
    actionability: z.number(),
    safety: z.number(),
    testability: z.number(),
    hallucination: z.number(),
    token_consumption_efficiency: z.number(),
    global: z.number(),
  }),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  questions: z.array(z.string()),
  rewrite: z.string(),
});

export type EvaluationResult = z.infer<typeof EvaluationSchema>;