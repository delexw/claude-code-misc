import { exec } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execAsync = promisify(exec);
import { AGENTS } from "@@/lib/agents";
import { generatePlist, plistLabel } from "@/lib/plist-generate";
import { uid, agentPlistPath, tryRun, isLoaded } from "@/lib/launchd";
import { externalPackagesInBundle } from "@/lib/bundle-utils";
import {
  LAUNCH_AGENTS_DIR,
  SCHEDULER_LOGS,
  SCHEDULER_ROOT,
  AGENTS_ROOT,
  AGENTS_DIST,
} from "@@/lib/paths";

const HOME = process.env.HOME!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentName = searchParams.get("agentName");

  // Single-agent mode
  if (agentName) {
    const agent = AGENTS.find((a) => a.name === agentName);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const plistPath = agentPlistPath(agent.name);
    return NextResponse.json({
      plistExists: existsSync(plistPath),
      loaded: await isLoaded(agent.label),
      plistPath,
    });
  }

  // All-agents mode
  const entries = await Promise.all(
    AGENTS.map(async (agent) => {
      const plistPath = agentPlistPath(agent.name);
      return [
        agent.name,
        { plistExists: existsSync(plistPath), loaded: await isLoaded(agent.label), plistPath },
      ] as const;
    }),
  );
  return NextResponse.json({ agents: Object.fromEntries(entries) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { agentName?: string; action?: string };
  const { agentName, action } = body;

  const agent = AGENTS.find((a) => a.name === agentName);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const label = plistLabel(agent);
  const plistPath = join(LAUNCH_AGENTS_DIR, `${label}.plist`);
  const u = uid();

  switch (action) {
    case "upload": {
      mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
      writeFileSync(plistPath, generatePlist(agent, HOME));
      break;
    }

    case "load": {
      await tryRun(`launchctl bootstrap gui/${u} ${plistPath}`);
      break;
    }

    case "unload": {
      await tryRun(`launchctl bootout gui/${u} ${plistPath}`);
      await tryRun(`launchctl bootout gui/${u}/${agent.label}`);
      break;
    }

    case "delete": {
      await tryRun(`launchctl bootout gui/${u} ${plistPath}`);
      await tryRun(`launchctl bootout gui/${u}/${agent.label}`);
      if (existsSync(plistPath)) {
        unlinkSync(plistPath);
      }
      break;
    }

    case "install": {
      // Step 1: Build only this agent's entry (--metafile for reliable external detection)
      await execAsync(`npx tsup src/${agent.name}.ts --metafile`, { cwd: AGENTS_ROOT });

      // Step 2: Deploy this agent's script
      mkdirSync(SCHEDULER_ROOT, { recursive: true });
      const scriptSrc = join(AGENTS_DIST, `${agent.name}.mjs`);
      const scriptDest = join(SCHEDULER_ROOT, `${agent.name}.mjs`);
      copyFileSync(scriptSrc, scriptDest);
      chmodSync(scriptDest, 0o755);

      // Step 3: Copy only the native packages this agent's bundle actually imports
      for (const pkg of externalPackagesInBundle(agent.name)) {
        const src = join(AGENTS_ROOT, "node_modules", pkg);
        if (existsSync(src)) {
          mkdirSync(join(SCHEDULER_ROOT, "node_modules"), { recursive: true });
          cpSync(src, join(SCHEDULER_ROOT, "node_modules", pkg), { recursive: true });
        }
      }

      // Step 4: Install this agent's plist
      await tryRun(`launchctl bootout gui/${u} ${plistPath}`);
      await tryRun(`launchctl bootout gui/${u}/${agent.label}`);
      mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
      writeFileSync(plistPath, generatePlist(agent, HOME));
      const logDir = join(SCHEDULER_LOGS, `.${agent.name}`);
      mkdirSync(logDir, { recursive: true });
      await tryRun(`launchctl bootstrap gui/${u} ${plistPath}`);
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({
    plistExists: existsSync(plistPath),
    loaded: await isLoaded(agent.label),
    plistPath,
  });
}
