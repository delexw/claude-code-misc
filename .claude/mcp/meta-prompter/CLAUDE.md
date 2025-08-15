# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Meta-Prompter MCP Server that evaluates prompts using AI models and returns structured JSON analysis. It functions as an MCP (Model Context Protocol) server that provides prompt evaluation services through two main tools: `ping` for connection testing and `evaluate` for prompt analysis.

## Development Commands

### Setup and Build
- `./setup.sh` - Complete setup: installs dependencies and builds the project
- `npm install --legacy-peer-deps` - Install dependencies (note the legacy peer deps flag)
- `npm run build` - Compile TypeScript to JavaScript in `/dist`
- `npm start` - Run the compiled server from `/dist/index.js`

### Development Tools
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npx @modelcontextprotocol/inspector node dist/index.js` - Test with MCP Inspector

### Testing
Currently no test suite is configured (package.json shows placeholder test script).

### Results Viewing
- `eval-viewer.html` - SPA for viewing evaluation results (served as MCP resource)
- Evaluation results are logged to `evaluation_result.jsonl` in JSONL format

## Architecture Overview

### Core Structure
The project follows SOLID principles with dependency injection and clear separation of concerns:

```
src/
├── index.ts              # FastMCP server setup and tool registration
├── prompt.ts             # Evaluation prompt template and builder
├── interfaces/           # TypeScript interfaces for contracts
│   ├── IEvaluationService.ts
│   ├── ILogger.ts
│   └── IModelProvider.ts
├── providers/            # AI model provider implementations
│   ├── AnthropicProvider.ts
│   ├── ModelProviderFactory.ts
│   └── OpenAIProvider.ts
└── services/             # Business logic services
    ├── EvaluationService.ts
    └── FileLogger.ts
```

### Key Components

**FastMCP Server (`index.ts`)**: Entry point that registers two tools:
- `ping`: Connection verification
- `evaluate`: Main prompt evaluation with 8-dimension scoring

**Evaluation System**: 
- Uses structured prompt template in `prompt.ts` with weighted scoring across 8 dimensions
- Temperature set to 0 for consistent scoring
- Returns JSON-only structured results via `generateObject` from AI SDK

**Provider Pattern**: 
- `ModelProviderFactory` creates appropriate providers (Anthropic/OpenAI)
- Supports multiple AI models through unified interface
- Default model is "sonnet-4"

**Logging**: 
- `FileLogger` appends evaluation results to `evaluation_result.jsonl`
- Results viewable via `eval-viewer.html` SPA
- Non-blocking logging (evaluation continues even if logging fails)

## Environment Configuration

Required environment variables:
- `PROMPT_EVAL_MODEL` - AI model name (defaults to "sonnet-4")  
- `PROMPT_EVAL_API_KEY` - API key for the chosen model provider

Optional:
- `OPENAI_BASE_URL` - Custom OpenAI endpoint
- `ANTHROPIC_BASE_URL` - Custom Anthropic endpoint

## MCP Integration

Configure with Claude Code using:
```bash
claude mcp add meta-prompter --env PROMPT_EVAL_MODEL=sonnet-4 --env PROMPT_EVAL_API_KEY=<api_key> -- node <absolute_path>/start.js
```

## Code Standards

ESLint configuration enforces:
- TypeScript strict mode with explicit typing
- Single quotes, 2-space indentation, trailing commas
- No unused variables, prefer const over let/var
- Console logging allowed for MCP server operations

The project uses ES modules (`"type": "module"`) with Node.js 18+ requirement.

## Key Dependencies

- **AI SDK**: `ai` package with `generateObject` for structured responses
- **Model Providers**: `@ai-sdk/anthropic`, `@ai-sdk/openai` for AI integration
- **MCP Framework**: `fastmcp` for Model Context Protocol server functionality
- **Schema Validation**: `zod` for TypeScript type generation and runtime validation
- **Development**: `tsx` and `jiti` for TypeScript execution during development