import { join } from "node:path";
import type { AgentConfig } from "./configs.js";
import { SCHEDULER_ROOT, SCHEDULER_LOGS } from "../lib/paths.js";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scheduleBlock(config: AgentConfig): string {
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

export function generatePlist(config: AgentConfig, home: string): string {
  const envrcPath = join(SCHEDULER_ROOT, ".envrc");
  const nodePath = `${home}/.asdf/shims/node`;
  const scriptPath = join(SCHEDULER_ROOT, `${config.name}.mjs`);
  const logDir = join(SCHEDULER_LOGS, `.${config.name}`);
  const runAtLoad = config.runAtLoad ?? false;

  // Use zsh login shell + explicitly source asdf.sh to ensure ~/.asdf/shims
  // is on PATH (login shell alone doesn't source .zshrc in launchd context)
  const asdfSh = "/opt/homebrew/opt/asdf/libexec/asdf.sh";
  const shellCmd = escapeXml(
    `[ -f '${asdfSh}' ] && . '${asdfSh}'; [ -f '${envrcPath}' ] && source '${envrcPath}'; exec '${nodePath}' '${scriptPath}'`,
  );

  const sections: string[] = [];

  // EnvironmentVariables (optional)
  if (config.envVars) {
    sections.push(envVarsBlock(config.envVars));
  }

  // Label
  sections.push("    <key>Label</key>", `    <string>${escapeXml(config.label)}</string>`);

  // ProcessType
  sections.push("    <key>ProcessType</key>", "    <string>Interactive</string>");

  // ProgramArguments
  sections.push(
    "    <key>ProgramArguments</key>",
    "    <array>",
    "        <string>/bin/zsh</string>",
    "        <string>-l</string>",
    "        <string>-c</string>",
    `        <string>${shellCmd}</string>`,
    "    </array>",
  );

  // RunAtLoad
  sections.push("    <key>RunAtLoad</key>", `    <${runAtLoad}/>`);

  // StandardErrorPath / StandardOutPath
  sections.push(
    "    <key>StandardErrorPath</key>",
    `    <string>${logDir}/err.log</string>`,
    "    <key>StandardOutPath</key>",
    `    <string>${logDir}/out.log</string>`,
  );

  // Schedule (optional)
  const schedule = scheduleBlock(config);
  if (schedule) {
    sections.push(schedule);
  }

  // WorkingDirectory
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

export function plistLabel(config: AgentConfig): string {
  return `com.claude.scheduler.${config.name}`;
}
