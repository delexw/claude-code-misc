/**
 * Start all 5 A2A agent servers with dynamically allocated ports.
 *
 * Uses getAvailablePort() (net.createServer port=0) — no external deps.
 * Writes a2a/.ports.json so the Next.js API route can discover the ports.
 */

import { consola } from "consola";
import { getAvailablePort, writePortsManifest } from "./lib/base-server.js";
import { PORTS_FILE } from "@/lib/paths";
import { startServer as startExperienceReflector } from "./servers/experience-reflector.js";
import { startServer as startGetShitDone } from "./servers/get-shit-done.js";
import { startServer as startReleaseLogSentinel } from "./servers/release-log-sentinel.js";
import { startServer as startMemoryDistiller } from "./servers/memory-distiller.js";
import { startServer as startOncallAnalyzer } from "./servers/oncall-analyzer.js";

consola.box("🤖  Agent A2A Servers\nAllocating dynamic ports and starting up…");

const [
  experienceReflectorPort,
  getShitDonePort,
  releaseLogSentinelPort,
  memoryDistillerPort,
  oncallAnalyzerPort,
] = await Promise.all([
  getAvailablePort(),
  getAvailablePort(),
  getAvailablePort(),
  getAvailablePort(),
  getAvailablePort(),
]);

startExperienceReflector(experienceReflectorPort);
startGetShitDone(getShitDonePort);
startReleaseLogSentinel(releaseLogSentinelPort);
startMemoryDistiller(memoryDistillerPort);
startOncallAnalyzer(oncallAnalyzerPort);

writePortsManifest({
  experience_reflector: experienceReflectorPort,
  get_shit_done: getShitDonePort,
  release_log_sentinel: releaseLogSentinelPort,
  memory_distiller: memoryDistillerPort,
  oncall_analyzer: oncallAnalyzerPort,
});

consola.box(
  [
    "✅  All 5 A2A servers running\n",
    `  🧠  Experience Reflector   :${experienceReflectorPort}`,
    `  ⚡  Get Shit Done         :${getShitDonePort}`,
    `  🔍  Release Log Sentinel  :${releaseLogSentinelPort}`,
    `  🔗  Memory Distiller      :${memoryDistillerPort}`,
    `  📋  Oncall Analyzer       :${oncallAnalyzerPort}`,
    "",
    `  📄  Port manifest → ${PORTS_FILE}`,
  ].join("\n"),
);

consola.info("Ready — waiting for chatbot connections via A2A SSE");

process.on("SIGINT", () => {
  consola.info("Shutting down A2A servers…");
  process.exit(0);
});
