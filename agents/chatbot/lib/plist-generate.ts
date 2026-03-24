/**
 * Next.js-safe plist generation.
 *
 * agents/plist/generate.ts imports from "../../lib/paths.js" (ESM .js extension)
 * which webpack cannot resolve outside the app root. This file replicates the
 * same logic but computes scheduler paths from process.env.HOME directly.
 */

import { join } from "node:path";
import type { AgentDef } from "@@/lib/agents";
import { SCHEDULER_ROOT, SCHEDULER_LOGS } from "@@/lib/paths";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scheduleBlock(config: AgentDef): string {
  const { schedule } = config;
  if (!schedule) return "";

  if (schedule.type === "interval") {
    return ["    <key>StartInterval</key>", `    <integer>${schedule.seconds}</integer>`].join(
      "\n",
    );
  }

  const entries = [
    "        <key>Hour</key>",
    `        <integer>${schedule.hour}</integer>`,
    "        <key>Minute</key>",
    `        <integer>${schedule.minute}</integer>`,
  ];

  if ("weekday" in schedule && schedule.weekday !== undefined) {
    entries.push("        <key>Weekday</key>", `        <integer>${schedule.weekday}</integer>`);
  }

  return ["    <key>StartCalendarInterval</key>", "    <dict>", ...entries, "    </dict>"].join(
    "\n",
  );
}

function envVarsBlock(envVars: Record<string, string>): string {
  const entries = Object.entries(envVars)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .flatMap(([k, v]) => [
      `        <key>${escapeXml(k)}</key>`,
      `        <string>${escapeXml(v)}</string>`,
    ]);

  return ["    <key>EnvironmentVariables</key>", "    <dict>", ...entries, "    </dict>"].join(
    "\n",
  );
}

/**
 * Returns the plist FILENAME stem (e.g. "com.claude.scheduler.get-shit-done").
 * Used only for ~/Library/LaunchAgents/<stem>.plist — NOT as the launchd service identifier.
 *
 * HARD RULE: the launchd service label (used in launchctl commands and isLoaded checks)
 * is config.label (e.g. "Claude Code Agent - Get Shit Done"), not this function's return value.
 */
export function plistLabel(config: AgentDef): string {
  return `com.claude.scheduler.${config.name}`;
}

export function generatePlist(config: AgentDef, home: string): string {
  const envrcPath = join(SCHEDULER_ROOT, ".envrc");
  const nodePath = `${home}/.asdf/shims/node`;
  const scriptPath = join(SCHEDULER_ROOT, `${config.name}.mjs`);
  const logDir = join(SCHEDULER_LOGS, `.${config.name}`);
  const runAtLoad = config.runAtLoad ?? false;

  const asdfSh = "/opt/homebrew/opt/asdf/libexec/asdf.sh";
  const shellCmd = escapeXml(
    `[ -f '${asdfSh}' ] && . '${asdfSh}'; [ -f '${envrcPath}' ] && source '${envrcPath}'; exec '${nodePath}' '${scriptPath}'`,
  );

  const sections: string[] = [];

  if (config.envVars) {
    sections.push(envVarsBlock(config.envVars));
  }

  sections.push("    <key>Label</key>", `    <string>${escapeXml(config.label)}</string>`);
  sections.push("    <key>ProcessType</key>", "    <string>Interactive</string>");

  const programArgs = [
    "        <string>/bin/zsh</string>",
    "        <string>-l</string>",
    "        <string>-c</string>",
    `        <string>${shellCmd}</string>`,
  ];
  sections.push("    <key>ProgramArguments</key>", "    <array>", ...programArgs, "    </array>");

  sections.push("    <key>RunAtLoad</key>", `    <${runAtLoad}/>`);

  sections.push(
    "    <key>StandardErrorPath</key>",
    `    <string>${logDir}/err.log</string>`,
    "    <key>StandardOutPath</key>",
    `    <string>${logDir}/out.log</string>`,
  );

  const schedule = scheduleBlock(config);
  if (schedule) {
    sections.push(schedule);
  }

  sections.push("    <key>WorkingDirectory</key>", `    <string>${home}</string>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${sections.join("\n")}
</dict>
</plist>
`;
}
