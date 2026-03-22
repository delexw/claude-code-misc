import { describe, expect, it } from "vitest";
import { generatePlist } from "./generate.js";
import type { AgentDef } from "../lib/agents.js";
import { Brain } from "lucide-react";

const BASE: AgentDef = {
  name: "test-agent",
  displayName: "Test Agent",
  label: "Claude Code Agent - Test Agent",
  manifestKey: "test_agent",
  toolName: "run_test_agent",
  description: "A test agent",
  requiredEnvVars: [],
  scheduleDisplay: "daily 09:00",
  schedule: { type: "calendar", hour: 9, minute: 0 },
  icon: Brain,
};

const HOME = "/Users/test";

describe("generatePlist — ProgramArguments", () => {
  it("does not include a '--' separator", () => {
    const plist = generatePlist(BASE, HOME);
    expect(plist).not.toContain("<string>--</string>");
  });

  it("does not include '$@' in the shell command", () => {
    const plist = generatePlist(BASE, HOME);
    expect(plist).not.toContain('"$@"');
  });
});
