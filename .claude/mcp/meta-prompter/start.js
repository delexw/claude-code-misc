#!/usr/bin/env node

// Smart dispatcher: any args → CLI mode, no args → MCP server
// MCP servers receive no process args (they communicate via stdio JSON-RPC)
(async () => {
  if (process.argv.length > 2) {
    await import('./dist/cli.js');
  } else {
    await import('./dist/index.js');
  }
})();
