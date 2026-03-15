import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/pir-analyzer.ts",
    "src/get-shit-done.ts",
    "src/checkpoint-learner.ts",
    "src/memory-synthesizer.ts",
    "src/jsonl-compat-checker.ts",
  ],
  format: "esm",
  outDir: "dist",
  bundle: true,
  splitting: false,
  platform: "node",
  target: "node22",
  banner: { js: "#!/usr/bin/env node" },
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
});
