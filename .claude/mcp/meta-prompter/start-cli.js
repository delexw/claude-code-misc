#!/usr/bin/env node

// CommonJS wrapper for ES module CLI
(async () => {
  await import('./dist/cli.js');
})();
