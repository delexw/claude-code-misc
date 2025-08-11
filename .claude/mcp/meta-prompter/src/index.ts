#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { ModelProviderFactory } from "./providers/ModelProviderFactory.js";
import { EvaluationService } from "./services/EvaluationService.js";
import { FileLogger } from "./services/FileLogger.js";

// Create FastMCP server
const server = new FastMCP({
  name: "prompt-evaluator",
  version: "1.0.0",
});

// Add ping tool
server.addTool({
  name: "ping",
  description: "Simple ping test to verify connection",
  parameters: z.object({}),
  execute: async () => {
    return "Pong! MCP server is connected and working.";
  },
});

// Add evaluate tool
server.addTool({
  name: "evaluate",
  description: "Evaluate a prompt using AI analysis",
  parameters: z.object({
    prompt: z.string().describe("The prompt to evaluate"),
  }),
  execute: async ({ prompt }: { prompt: string }) => {
    // Get config from environment variables
    const modelName = process.env.PROMPT_EVAL_MODEL || "sonnet-4";
    const apiKey = process.env.PROMPT_EVAL_API_KEY;

    if (!apiKey) {
      throw new Error(
        "PROMPT_EVAL_API_KEY not configured. Please set it in your .mcp.json file."
      );
    }

    try {
      // Use dependency injection for better testability and SOLID compliance
      const modelProvider = ModelProviderFactory.getProvider(modelName);
      const logger = new FileLogger();
      const evaluationService = new EvaluationService(modelProvider, logger, modelName, apiKey);

      return await evaluationService.evaluate(prompt);
    } catch (error) {
      console.error("Error calling AI API:", error);
      throw new Error(
        `Failed to evaluate prompt: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  },
});

// Start the server
async function main() {
  await server.start();
  console.error("Prompt Evaluator MCP server running with FastMCP");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});