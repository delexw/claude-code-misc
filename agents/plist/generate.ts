import type { AgentConfig } from "./configs.js";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scheduleBlock(config: AgentConfig): string {
  const { schedule } = config;
  if (schedule.type === "interval") {
    return `\t<key>StartInterval</key>
\t<integer>${schedule.seconds}</integer>`;
  }

  let inner = `\t\t<key>Hour</key>
\t\t<integer>${schedule.hour}</integer>
\t\t<key>Minute</key>
\t\t<integer>${schedule.minute}</integer>`;

  if ("weekday" in schedule && schedule.weekday !== undefined) {
    inner += `\n\t\t<key>Weekday</key>
\t\t<integer>${schedule.weekday}</integer>`;
  }

  return `\t<key>StartCalendarInterval</key>
\t<dict>
${inner}
\t</dict>`;
}

/**
 * Dynamically capture the entire current dev environment at build time.
 * No filtering — the plist gets exactly what your shell has.
 */
export function captureDevEnv(): Record<string, string> {
  const captured: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (val !== undefined) captured[key] = val;
  }
  return captured;
}

export function generatePlist(
  config: AgentConfig,
  home: string,
  envVars?: Record<string, string>,
): string {
  const envrcPath = `${home}/.claude/scheduler/.envrc`;
  const nodePath = `${home}/.asdf/shims/node`;
  const scriptPath = `${home}/.claude/scheduler/${config.name}.mjs`;
  const logDir = `${home}/.claude/scheduler/logs/.${config.name}`;
  const runAtLoad = config.runAtLoad ?? false;

  // Use bash login shell to source .envrc before running node
  const bashCmd = escapeXml(
    `[ -f '${envrcPath}' ] && source '${envrcPath}'; exec '${nodePath}' '${scriptPath}'`,
  );

  // Build EnvironmentVariables dict entries from captured env
  const env = envVars ?? {};
  // Ensure HOME is always set
  if (!env.HOME) env.HOME = home;

  const envEntries = Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([k, v]) =>
        `\t\t<key>${escapeXml(k)}</key>\n\t\t<string>${escapeXml(v)}</string>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>EnvironmentVariables</key>
\t<dict>
${envEntries}
\t</dict>
\t<key>Label</key>
\t<string>${escapeXml(config.label)}</string>
\t<key>LowPriorityIO</key>
\t<true/>
\t<key>Nice</key>
\t<integer>10</integer>
\t<key>ProcessType</key>
\t<string>Background</string>
\t<key>ProgramArguments</key>
\t<array>
\t\t<string>/bin/bash</string>
\t\t<string>-l</string>
\t\t<string>-c</string>
\t\t<string>${bashCmd}</string>
\t</array>
\t<key>RunAtLoad</key>
\t<${runAtLoad}/>
\t<key>StandardErrorPath</key>
\t<string>${logDir}/err.log</string>
\t<key>StandardOutPath</key>
\t<string>${logDir}/out.log</string>
${scheduleBlock(config)}
\t<key>WorkingDirectory</key>
\t<string>${home}</string>
</dict>
</plist>
`;
}

export function plistLabel(config: AgentConfig): string {
  return `com.claude.scheduler.${config.name}`;
}
