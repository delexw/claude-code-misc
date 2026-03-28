---
name: inktui
description: "Build beautiful CLI apps with Ink (React for terminals), ink-ui components, and create-ink-app scaffolding. Use this skill whenever the user wants to build a terminal/CLI user interface with React, create interactive command-line tools, use Ink components like Box/Text, work with ink-ui widgets (Select, TextInput, Spinner, etc.), scaffold a new CLI app with create-ink-app, or write any JSX that renders to the terminal. Also triggers when the user mentions 'ink', 'ink-ui', '@inkjs/ui', 'CLI app with React', 'terminal UI', 'create-ink-app', or imports from the 'ink' package. If the user wants to build an interactive CLI and isn't already using blessed, prompts, or enquirer, this skill applies."
---

# Ink — React for CLIs

Ink is a React renderer for terminal applications. It uses Yoga (flexbox) for layout and renders to stdout. Every element is a flex container — think `<div style="display: flex">` for the terminal.

## Quick Start

```bash
# Scaffold a new project
npx create-ink-app my-cli              # JavaScript
npx create-ink-app --typescript my-cli # TypeScript
```

Or add to an existing project:
```bash
npm install ink react
npm install @inkjs/ui  # Optional: pre-built UI components
```

## Core Architecture

Ink apps are React component trees rendered via `render()`. The process stays alive while there's work in the event loop. Exit via Ctrl+C, `useApp().exit()`, or `instance.unmount()`.

```tsx
import React, {useState} from 'react';
import {render, Text, Box} from 'ink';

function App() {
  const [count, setCount] = useState(0);
  return (
    <Box flexDirection="column">
      <Text>Count: {count}</Text>
      <Text color="green">Press q to quit</Text>
    </Box>
  );
}

render(<App />);
```

## Reference Files

Read these for detailed API documentation and examples:

- [references/components.md](references/components.md) — All Ink core components (`Box`, `Text`, `Newline`, `Spacer`, `Static`, `Transform`) with full props
- [references/hooks.md](references/hooks.md) — All hooks (`useInput`, `useApp`, `useFocus`, `useFocusManager`, `useStdin`, `useStdout`, `useStderr`, `useWindowSize`, `useBoxMetrics`, `useCursor`, `usePaste`)
- [references/ink-ui.md](references/ink-ui.md) — All `@inkjs/ui` components (`TextInput`, `Select`, `MultiSelect`, `Spinner`, `ProgressBar`, `Alert`, `Badge`, `StatusMessage`, `ConfirmInput`, `EmailInput`, `PasswordInput`, `OrderedList`, `UnorderedList`) with props and theming
- [references/patterns.md](references/patterns.md) — Common patterns: multi-step wizards, loading states, tables, command routing, testing, fullscreen apps, and real-world examples

## Key Concepts

### Layout is Flexbox
Every element is a flex container. Use `<Box>` for layout with standard flex props: `flexDirection`, `justifyContent`, `alignItems`, `gap`, `padding`, `margin`, etc. Percentage widths/heights are supported.

### Text Must Be in `<Text>`
All string content must be wrapped in `<Text>`. Direct string children of `<Box>` will error. Nest `<Text>` inside `<Text>` for inline styling:

```tsx
<Text>
  Hello <Text bold color="green">World</Text>
</Text>
```

### `<Static>` for Permanent Output
Use `<Static>` for output that should persist above the interactive area (like log lines). Content rendered in `<Static>` is written once and never re-rendered:

```tsx
<Static items={logs}>
  {(log, i) => <Text key={i}>{log}</Text>}
</Static>
```

### Input Handling
Use `useInput` hook — not DOM events:

```tsx
import {useInput, useApp} from 'ink';

function App() {
  const {exit} = useApp();
  useInput((input, key) => {
    if (input === 'q') exit();
    if (key.return) handleSubmit();
  });
  return <Text>Press q to quit</Text>;
}
```

### Borders
`<Box>` supports border styles: `"single"`, `"double"`, `"round"`, `"bold"`, `"singleDouble"`, `"doubleSingle"`, `"classic"`.

```tsx
<Box borderStyle="round" borderColor="green" padding={1}>
  <Text>Bordered content</Text>
</Box>
```

### Testing
Use `ink-testing-library`:

```tsx
import {render} from 'ink-testing-library';

const {lastFrame, stdin} = render(<App />);
expect(lastFrame()).toContain('Hello');
stdin.write('q'); // simulate input
```

### render() Options

```tsx
const instance = render(<App />, {
  stdout: process.stdout,        // custom writable stream
  stdin: process.stdin,          // custom readable stream
  stderr: process.stderr,        // custom writable stream
  exitOnCtrlC: true,             // default
  patchConsole: true,            // intercept console.log
  debug: false,
  maxFps: 30,
  incrementalRendering: false,   // only re-render changed lines
  concurrent: false,             // React concurrent mode (Suspense, useTransition)
  interactive: true,             // auto-detected; false in CI
  isScreenReaderEnabled: false,  // or set INK_SCREEN_READER=true
  onRender: ({renderTime}) => {},// callback after each render
  kittyKeyboard: {mode: 'auto'}, // 'auto' | 'enabled' | 'disabled'
});

await instance.waitUntilExit();
```

### renderToString() for Snapshots

```tsx
import {renderToString} from 'ink';
const output = renderToString(<App />, {columns: 80});
```

## Common Mistakes to Avoid

1. **Bare strings in `<Box>`** — Always wrap text in `<Text>`
2. **Using DOM events** — Use `useInput` hook instead
3. **Forgetting `key` prop in `<Static>`** — Items need unique keys
4. **Not handling raw mode** — `useInput` requires raw mode (automatic in `render()`, but manual in tests)
5. **Infinite re-renders** — Same React rules apply; memoize callbacks, avoid setting state in render
6. **Multiple active inputs** — Use `isDisabled` prop on ink-ui components or `isActive` on `useInput`/`useFocus` to manage which component receives input
