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

describe("generatePlist — defaultInstruction", () => {
  it("includes defaultInstruction as positional arg after '--' separator", () => {
    const plist = generatePlist({ ...BASE, defaultInstruction: "incidents today" }, HOME);
    // Should have "--" separator entry
    expect(plist).toContain("<string>--</string>");
    // Should have the instruction as a string entry after "--"
    expect(plist).toContain("<string>incidents today</string>");
    // "--" must appear before the instruction
    const dashIdx = plist.indexOf("<string>--</string>");
    const instrIdx = plist.indexOf("<string>incidents today</string>");
    expect(dashIdx).toBeLessThan(instrIdx);
  });

  it("still includes '--' separator even when defaultInstruction is absent", () => {
    const plist = generatePlist(BASE, HOME);
    expect(plist).toContain("<string>--</string>");
    // No instruction entry should follow
    const dashIdx = plist.indexOf("<string>--</string>");
    const afterDash = plist.slice(dashIdx + "<string>--</string>".length);
    // Next string entry should be closing </array>, not an instruction
    expect(afterDash.trimStart()).toMatch(/^\s*<\/array>/);
  });

  it("XML-escapes special characters in defaultInstruction", () => {
    const plist = generatePlist({ ...BASE, defaultInstruction: "incidents & alerts" }, HOME);
    expect(plist).toContain("<string>incidents &amp; alerts</string>");
    expect(plist).not.toContain("<string>incidents & alerts</string>");
  });

  it("passes instruction via '$@' in shell command so node receives it as argv", () => {
    const plist = generatePlist({ ...BASE, defaultInstruction: "incidents today" }, HOME);
    // The shell -c command must use "$@" to forward positional args
    expect(plist).toContain('"$@"');
  });
});
