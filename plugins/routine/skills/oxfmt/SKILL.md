---
name: oxfmt
description: Run and configure oxfmt — the high-performance JavaScript/TypeScript formatter built on the Oxc compiler stack, ~30x faster than Prettier. Use this skill whenever working in a project that has oxfmt installed (check for `oxfmt` in package.json devDependencies or an `.oxfmtrc.json` / `.oxfmtrc.jsonc` config file). This includes when you need to format code after making changes, set up oxfmt in a new project, migrate from Prettier, configure formatting rules, set up editor integration (VS Code, Neovim, Zed, JetBrains), or add formatting checks to CI/CD pipelines. Also use when the user mentions "oxfmt", "oxc formatter", "format with oxc", or asks about Prettier alternatives with better performance.
---

# Oxfmt — The Oxc Formatter

Oxfmt is a Prettier-compatible formatter for the JavaScript ecosystem. It currently passes ~95% of Prettier's JS/TS test suite. It formats JavaScript, JSX, TypeScript, TSX, JSON, JSONC, JSON5, YAML, TOML, HTML, Angular, Vue, CSS, SCSS, Less, Markdown, MDX, GraphQL, Ember, and Handlebars.

## When to use oxfmt

- After modifying code in a project that has oxfmt installed
- Setting up formatting in a new JS/TS project
- Migrating from Prettier to oxfmt
- Configuring formatting rules, editor integration, or CI checks

## Quick reference

### Installation

```bash
# Pick your package manager
npm add -D oxfmt
pnpm add -D oxfmt
yarn add -D oxfmt
bun add -D oxfmt
```

Add scripts to `package.json`:
```json
{
  "scripts": {
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check"
  }
}
```

Running `oxfmt` with no arguments formats the current directory (like `prettier --write .`).

### CLI flags

| Flag | Purpose |
|------|---------|
| `--check` | Check formatting without writing (exit 1 if unformatted) |
| `--list-different` | List files that would change |
| `--write` | Format and write in place (default) |
| `--init` | Create `.oxfmtrc.json` with defaults |
| `--migrate=prettier` | Convert `.prettierrc` to `.oxfmtrc.json` |
| `--migrate=biome` | Convert Biome config to `.oxfmtrc.json` |
| `-c PATH` | Use a specific config file |
| `--ignore-path PATH` | Custom ignore file (repeatable) |
| `--with-node-modules` | Include `node_modules/` (skipped by default) |
| `--no-error-on-unmatched-pattern` | Don't fail on unmatched globs |
| `--stdin-filepath PATH` | Format stdin, using PATH to infer parser |
| `--threads N` | Thread count (set to 1 for single core) |
| `--lsp` | Start the LSP server (used by editors) |

CLI does **not** support formatting options as flags (e.g., no `--no-semi`). Use the config file instead — this keeps formatting consistent across CLI, editors, and CI.

### Configuration

Oxfmt looks for `.oxfmtrc.json` or `.oxfmtrc.jsonc` starting from the current directory, walking up.

Generate a starter config:
```bash
oxfmt --init
```

#### Core options

```jsonc
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,       // Line width limit (default: 100, Prettier default is 80)
  "tabWidth": 2,           // Spaces per indent level
  "useTabs": false,        // Tabs vs spaces
  "semi": true,            // Semicolons
  "singleQuote": false,    // Quote style
  "trailingComma": "all",  // Trailing commas in multi-line
  "insertFinalNewline": true
}
```

Note: oxfmt defaults `printWidth` to 100, while Prettier defaults to 80. If migrating, decide which you prefer.

#### Per-file overrides

```json
{
  "printWidth": 100,
  "overrides": [
    {
      "files": ["*.test.js", "*.spec.ts"],
      "options": { "printWidth": 120 }
    },
    {
      "files": ["*.json"],
      "excludeFiles": ["package.json"],
      "options": { "tabWidth": 4 }
    }
  ]
}
```

#### Built-in features

These are disabled by default but can be enabled in the config:

- **`sortImports`** — Sorts import statements
- **`sortTailwindcss`** — Sorts Tailwind CSS classes
- **`sortPackageJson`** — Sorts `package.json` fields (enabled by default)

#### Ignore patterns

Add `ignorePatterns` in the config file, or use a `.oxfmtignore` / `.prettierignore` file:
```json
{
  "ignorePatterns": ["dist/", "coverage/", "*.min.js"]
}
```

#### .editorconfig support

Oxfmt reads these `.editorconfig` properties (nearest file only, no merging):
- `end_of_line` → `endOfLine`
- `indent_style` → `useTabs`
- `indent_size` → `tabWidth`
- `max_line_length` → `printWidth`
- `insert_final_newline` → `insertFinalNewline`

### Migrating from Prettier

```bash
# Install oxfmt
pnpm add -D oxfmt

# Auto-convert .prettierrc → .oxfmtrc.json
oxfmt --migrate=prettier

# Format everything so the diff is clean
pnpm oxfmt

# Replace Prettier scripts in package.json
# "prettier --write ."  → "oxfmt"
# "prettier --check ."  → "oxfmt --check"
```

After migration, review the generated `.oxfmtrc.json` — especially `printWidth` since the default changed from 80 to 100.

### Editor integration

Editor extensions use the local `oxfmt --lsp`, so oxfmt must be installed in the project.

**VS Code / Cursor:**
Install the "Oxc" extension from the VS Code Marketplace. Recommended team setup:

`.vscode/extensions.json`:
```json
{ "recommendations": ["oxc.oxc-vscode"] }
```

`.vscode/settings.json`:
```json
{
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "editor.formatOnSave": true
}
```

**Zed:** Install the oxc extension from Zed's marketplace.

**JetBrains (IntelliJ / WebStorm):** Install from JetBrains Marketplace.

**Neovim:**
- With nvim-lspconfig: `npm i -g oxfmt` then `vim.lsp.enable('oxfmt')`
- With conform.nvim: set `formatters_by_ft` for js/ts/json/vue
- With coc.nvim: `:CocInstall coc-oxc`

**Other LSP-compatible editors (Emacs, Helix, Sublime):** Point at `oxfmt --lsp`.

**Non-LSP editors:** Pipe via stdin: `cat file.js | oxfmt --stdin-filepath file.js`

### CI setup

**GitHub Actions:**
```yaml
jobs:
  format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run fmt:check
```

**GitLab CI:**
```yaml
oxfmt:
  image: node:lts
  stage: test
  before_script:
    - npm install
  script:
    - npm run fmt:check
```

**Autofix (GitHub):** Use [autofix.ci](https://autofix.ci) — run `oxfmt` (no `--check`) and let the action commit fixes.

### Pre-commit hook (lint-staged)

```json
{
  "lint-staged": {
    "*": "oxfmt --no-error-on-unmatched-pattern"
  }
}
```

Use `--no-error-on-unmatched-pattern` so non-supported file types don't cause errors.

### Node.js API

```js
import { format } from "oxfmt";

const result = format("foo.ts", "const   x:string   =   1", {
  semi: false,
  singleQuote: true,
});
console.log(result); // const x: string = 1
```

## Workflow after code changes

When you've modified files in an oxfmt-enabled project:

1. Run `pnpm oxfmt` (or the project's fmt script) to format changed files
2. If in CI or a check context, use `--check` instead to verify without writing

The formatter is fast enough to run on the entire project — no need to target individual files unless piping via stdin.
