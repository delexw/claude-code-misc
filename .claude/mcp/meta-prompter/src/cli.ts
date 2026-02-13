#!/usr/bin/env node
import { createRequire } from 'module';
import { evaluate } from './evaluate.js';

function printUsage(): void {
  console.error(`Usage: meta-prompter [options] [prompt]

Evaluate a prompt using AI analysis.

Arguments:
  prompt                The prompt to evaluate (or pipe via stdin)

Options:
  --prompt <text>       The prompt to evaluate (alternative to positional arg)
  --model <key>         Model key (default: PROMPT_EVAL_MODEL env or anthropic:claude-sonnet-4-5)
  --api-key <key>       API key (default: PROMPT_EVAL_API_KEY env)
  --compact             Output compact JSON instead of pretty-printed
  -h, --help            Show this help message
  -v, --version         Show version number

Environment:
  PROMPT_EVAL_MODEL     Model key in provider:model-id format
  PROMPT_EVAL_API_KEY   API key for the chosen model provider`);
}

interface CliArgs {
  prompt?: string;
  model?: string;
  apiKey?: string;
  compact: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { compact: false, help: false, version: false };
  const positional: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
    case '-h':
    case '--help':
      args.help = true;
      break;
    case '-v':
    case '--version':
      args.version = true;
      break;
    case '--prompt':
      args.prompt = argv[++i];
      break;
    case '--model':
      args.model = argv[++i];
      break;
    case '--api-key':
      args.apiKey = argv[++i];
      break;
    case '--compact':
      args.compact = true;
      break;
    default:
      if (arg.startsWith('-')) {
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
      }
      positional.push(arg);
    }
    i++;
  }

  if (!args.prompt && positional.length > 0) {
    args.prompt = positional.join(' ');
  }

  return args;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.version) {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    console.log(pkg.version);
    process.exit(0);
  }

  let prompt = args.prompt;

  if (!prompt) {
    prompt = await readStdin();
  }

  if (!prompt) {
    console.error('Error: No prompt provided. Pass a prompt as an argument, via --prompt, or pipe to stdin.\n');
    printUsage();
    process.exit(1);
  }

  try {
    const result = await evaluate(prompt, {
      modelKey: args.model,
      apiKey: args.apiKey,
    });

    const output = args.compact
      ? JSON.stringify(result)
      : JSON.stringify(result, null, 2);
    console.log(output);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    process.exit(1);
  }
}

main();
