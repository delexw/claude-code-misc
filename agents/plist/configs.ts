export interface AgentConfig {
  name: string;
  label: string;
  schedule:
    | { type: "interval"; seconds: number }
    | { type: "calendar"; hour: number; minute: number; weekday?: number };
  runAtLoad?: boolean;
}

export const agents: AgentConfig[] = [
  {
    name: "pir-analyzer",
    label: "Claude Code Agent - PIR Analyzer",
    schedule: { type: "calendar", hour: 9, minute: 0 },
  },
  {
    name: "get-shit-done",
    label: "Claude Code Agent - Get Shit Done",
    schedule: { type: "interval", seconds: 300 },
  },
  {
    name: "checkpoint-learner",
    label: "Claude Code Agent - Checkpoint Learner",
    schedule: { type: "calendar", hour: 0, minute: 0 },
  },
  {
    name: "memory-synthesizer",
    label: "Claude Code Agent - Memory Synthesizer",
    schedule: { type: "calendar", hour: 1, minute: 0, weekday: 0 },
  },
  {
    name: "jsonl-compat-checker",
    label: "Claude Code Agent - JSONL Compat Checker",
    schedule: { type: "calendar", hour: 10, minute: 0, weekday: 0 },
  },
  {
    name: "test-env",
    label: "Claude Code Agent - Test Env",
    schedule: { type: "calendar", hour: 0, minute: 0 }, // manual only
    runAtLoad: true,
  },
];
