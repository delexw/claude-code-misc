export interface AgentConfig {
  name: string;
  label: string;
  schedule?:
    | { type: "interval"; seconds: number }
    | { type: "calendar"; hour: number; minute: number; weekday?: number };
  runAtLoad?: boolean;
  envVars?: Record<string, string>;
}

export const agents: AgentConfig[] = [
  {
    name: "oncall-analyzer",
    label: "Claude Code Agent - Oncall Analyzer",
    schedule: { type: "calendar", hour: 9, minute: 0 },
  },
  {
    name: "get-shit-done",
    label: "Claude Code Agent - Get Shit Done",
    schedule: { type: "interval", seconds: 300 },
  },
  {
    name: "experience-reflector",
    label: "Claude Code Agent - Experience Reflector",
    schedule: { type: "calendar", hour: 0, minute: 0 },
  },
  {
    name: "memory-distiller",
    label: "Claude Code Agent - Memory Distiller",
    schedule: { type: "calendar", hour: 1, minute: 0, weekday: 0 },
  },
  {
    name: "release-log-sentinel",
    label: "Claude Code Agent - Release Log Sentinel",
    schedule: { type: "calendar", hour: 10, minute: 0, weekday: 0 },
  },
];
