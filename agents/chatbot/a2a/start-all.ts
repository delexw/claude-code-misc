/**
 * Start all 5 A2A agent servers with dynamically allocated ports.
 *
 * Uses getAvailablePort() (net.createServer port=0) — no external deps.
 * Writes a2a/.ports.json so the Next.js API route can discover the ports.
 */

import { consola } from "consola";
import { getAvailablePort, writePortsManifest } from "./lib/base-server.js";
import { PORTS_FILE } from "@/lib/paths";
import { startServer as startCheckpointLearner } from "./servers/checkpoint-learner.js";
import { startServer as startGetShitDone } from "./servers/get-shit-done.js";
import { startServer as startJsonlCompatChecker } from "./servers/jsonl-compat-checker.js";
import { startServer as startMemorySynthesizer } from "./servers/memory-synthesizer.js";
import { startServer as startPirAnalyzer } from "./servers/pir-analyzer.js";

consola.box("🤖  Agent A2A Servers\nAllocating dynamic ports and starting up…");

const [
  checkpointLearnerPort,
  getShitDonePort,
  jsonlCompatCheckerPort,
  memorySynthesizerPort,
  pirAnalyzerPort,
] = await Promise.all([
  getAvailablePort(),
  getAvailablePort(),
  getAvailablePort(),
  getAvailablePort(),
  getAvailablePort(),
]);

startCheckpointLearner(checkpointLearnerPort);
startGetShitDone(getShitDonePort);
startJsonlCompatChecker(jsonlCompatCheckerPort);
startMemorySynthesizer(memorySynthesizerPort);
startPirAnalyzer(pirAnalyzerPort);

writePortsManifest({
  checkpoint_learner: checkpointLearnerPort,
  get_shit_done: getShitDonePort,
  jsonl_compat_checker: jsonlCompatCheckerPort,
  memory_synthesizer: memorySynthesizerPort,
  pir_analyzer: pirAnalyzerPort,
});

consola.box(
  [
    "✅  All 5 A2A servers running\n",
    `  🧠  Checkpoint Learner    :${checkpointLearnerPort}`,
    `  ⚡  Get Shit Done         :${getShitDonePort}`,
    `  🔍  JSONL Compat Checker  :${jsonlCompatCheckerPort}`,
    `  🔗  Memory Synthesizer    :${memorySynthesizerPort}`,
    `  📋  PIR Analyzer          :${pirAnalyzerPort}`,
    "",
    `  📄  Port manifest → ${PORTS_FILE}`,
  ].join("\n"),
);

consola.info("Ready — waiting for chatbot connections via A2A SSE");

process.on("SIGINT", () => {
  consola.info("Shutting down A2A servers…");
  process.exit(0);
});
