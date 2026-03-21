import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/oncall-analyzer.ts",
    "src/get-shit-done.ts",
    "src/experience-reflector.ts",
    "src/memory-distiller.ts",
    "src/release-log-sentinel.ts",
  ],
  format: "esm",
  outDir: "dist",
  bundle: true,
  splitting: false,
  external: ["@ladybugdb/core"], // native addon — cannot be bundled
  platform: "node",
  target: "node22",
  banner: { js: "#!/usr/bin/env node" },
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
});
