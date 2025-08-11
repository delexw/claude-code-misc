#!/usr/bin/env node

// CommonJS wrapper for ES module
(async () => {
  await import('./dist/index.js');
})();