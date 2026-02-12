#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { evaluate } from './evaluate.js';
import { EvaluationSchema } from './interfaces/IEvaluationService.js';

const server = new McpServer({
  name: 'prompt-evaluator',
  version: '0.1.0',
});

// Add ping tool
server.registerTool('ping', {
  description: 'Simple ping test to verify connection',
}, async () => ({
  content: [{ type: 'text', text: 'Pong! MCP server is connected and working.' }],
}));

// Add evaluate tool with structured output
server.registerTool('evaluate', {
  description: 'Evaluate a prompt using AI analysis',
  inputSchema: {
    prompt: z.string().describe('The prompt to evaluate'),
  },
  outputSchema: EvaluationSchema,
}, async ({ prompt }) => {
  const result = await evaluate(prompt);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Prompt Evaluator MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
