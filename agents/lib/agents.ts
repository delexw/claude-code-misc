import type { LucideIcon } from "lucide-react";
import { Brain, Zap, Radar, FlaskConical, BellRing } from "lucide-react";

export interface AgentDef {
  /** kebab-case identifier — used for file names, plist label suffix, log dirs */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** launchd service label */
  label: string;
  /** Underscore key used in .ports.json manifest */
  manifestKey: string;
  /** MCP tool name exposed to Claude */
  toolName: string;
  /** Short description for MCP tool and system prompt */
  description: string;
  /** Required environment variables (checked at startup) */
  requiredEnvVars: string[];
  /** Human-readable schedule string for UI display */
  scheduleDisplay: string;
  /** launchd schedule */
  schedule?:
    | { type: "interval"; seconds: number }
    | { type: "calendar"; hour: number; minute: number; weekday?: number };
  /** Icon component for UI display */
  icon: LucideIcon;
  /** Whether to run immediately when loaded */
  runAtLoad?: boolean;
  /** Extra static env vars to embed in the launchd plist */
  envVars?: Record<string, string>;
}

export const AGENTS: AgentDef[] = [
  {
    name: "experience-reflector",
    displayName: "Experience Reflector",
    label: "Claude Code Agent - Experience Reflector",
    manifestKey: "experience_reflector",
    toolName: "run_experience_reflector",
    description:
      "Extract domain knowledge from Claude Code checkpoint sessions into project MEMORY.md files. " +
      "Requires CHECKPOINT_REPOS env var.",
    requiredEnvVars: ["CHECKPOINT_REPOS"],
    icon: Brain,
    scheduleDisplay: "daily 00:00",
    schedule: { type: "calendar", hour: 0, minute: 0 },
  },
  {
    name: "get-shit-done",
    displayName: "Get Shit Done",
    label: "Claude Code Agent - Get Shit Done",
    manifestKey: "get_shit_done",
    toolName: "run_get_shit_done",
    description:
      "Automated JIRA ticket implementer: discovers sprint tickets, forges implementations in " +
      "parallel git worktrees, and creates PRs. Requires GSD_REPOS + JIRA_ASSIGNEE env vars.",
    requiredEnvVars: ["GSD_REPOS", "JIRA_ASSIGNEE"],
    icon: Zap,
    scheduleDisplay: "every 5 min",
    schedule: { type: "interval", seconds: 300 },
  },
  {
    name: "release-log-sentinel",
    displayName: "Release Log Sentinel",
    label: "Claude Code Agent - Release Log Sentinel",
    manifestKey: "release_log_sentinel",
    toolName: "run_release_log_sentinel",
    description:
      "Monitor Claude Code releases for JSONL format changes that could break tail-claude-gui. " +
      "Creates GitHub issues for new breaking changes. Requires gh CLI authentication.",
    requiredEnvVars: [],
    icon: Radar,
    scheduleDisplay: "Sun 10:00",
    schedule: { type: "calendar", hour: 10, minute: 0, weekday: 0 },
  },
  {
    name: "memory-distiller",
    displayName: "Memory Distiller",
    label: "Claude Code Agent - Memory Distiller",
    manifestKey: "memory_distiller",
    toolName: "run_memory_distiller",
    description:
      "Distil cross-project memory patterns into the global ~/.claude/CLAUDE.md. " +
      "Requires MEMORY_REPOS env var listing ≥2 project paths.",
    requiredEnvVars: ["MEMORY_REPOS"],
    icon: FlaskConical,
    scheduleDisplay: "Sun 01:00",
    schedule: { type: "calendar", hour: 1, minute: 0, weekday: 0 },
  },
  {
    name: "oncall-analyzer",
    displayName: "Oncall Analyzer",
    label: "Claude Code Agent - Oncall Analyzer",
    manifestKey: "oncall_analyzer",
    toolName: "run_oncall_analyzer",
    description:
      "Generate a Post Incident Record from PagerDuty incidents in the past 24 hours. " +
      "Requires PIR_REPOS + PIR_DOMAIN env vars.",
    requiredEnvVars: ["PIR_REPOS", "PIR_DOMAIN"],
    icon: BellRing,
    scheduleDisplay: "daily 09:00",
    schedule: { type: "calendar", hour: 9, minute: 0 },
  },
];
