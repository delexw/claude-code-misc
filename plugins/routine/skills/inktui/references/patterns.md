# Common Ink Patterns & Examples

## Project Scaffolding

```bash
# JavaScript
npx create-ink-app my-cli

# TypeScript
npx create-ink-app --typescript my-cli
```

Generated structure:
```
my-cli/
├── source/
│   ├── app.tsx       # Main component
│   └── cli.tsx       # Entry point with argument parsing
├── package.json
├── tsconfig.json
└── readme.md
```

Typical `cli.tsx` entry point:
```tsx
#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(`
  Usage
    $ my-cli <input>

  Options
    --name  Your name

  Examples
    $ my-cli --name=Jane
`, {
  importMeta: import.meta,
  flags: {
    name: {
      type: 'string',
    },
  },
});

render(<App name={cli.flags.name} />);
```

---

## Multi-Step Wizard

A common pattern for CLI tools that gather input in stages:

```tsx
import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {TextInput, Select, ConfirmInput, Spinner} from '@inkjs/ui';

type Step = 'name' | 'framework' | 'confirm' | 'creating';

function CreateProject() {
  const [step, setStep] = useState<Step>('name');
  const [config, setConfig] = useState({name: '', framework: ''});

  if (step === 'name') {
    return (
      <Box flexDirection="column">
        <Text bold>What is your project name?</Text>
        <TextInput
          placeholder="my-project"
          onSubmit={name => {
            setConfig(c => ({...c, name}));
            setStep('framework');
          }}
        />
      </Box>
    );
  }

  if (step === 'framework') {
    return (
      <Box flexDirection="column">
        <Text bold>Choose a framework:</Text>
        <Select
          options={[
            {label: 'React', value: 'react'},
            {label: 'Vue', value: 'vue'},
            {label: 'Svelte', value: 'svelte'},
          ]}
          onChange={framework => {
            setConfig(c => ({...c, framework}));
            setStep('confirm');
          }}
        />
      </Box>
    );
  }

  if (step === 'confirm') {
    return (
      <Box flexDirection="column">
        <Text>Create <Text bold>{config.name}</Text> with <Text bold>{config.framework}</Text>?</Text>
        <ConfirmInput
          onConfirm={() => setStep('creating')}
          onCancel={() => setStep('name')}
        />
      </Box>
    );
  }

  return <Spinner label={`Creating ${config.name}...`} />;
}
```

---

## Task Runner / Progress Display

Show completed tasks with `<Static>` and current task with a spinner:

```tsx
import React, {useState, useEffect} from 'react';
import {Box, Text, Static} from 'ink';
import {Spinner, StatusMessage, ProgressBar} from '@inkjs/ui';

interface Task {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

function TaskRunner({tasks: initialTasks}: {tasks: string[]}) {
  const [completed, setCompleted] = useState<Array<{name: string; ok: boolean}>>([]);
  const [current, setCurrent] = useState(0);
  const total = initialTasks.length;

  useEffect(() => {
    if (current >= total) return;

    const timer = setTimeout(() => {
      setCompleted(c => [...c, {name: initialTasks[current], ok: true}]);
      setCurrent(i => i + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [current]);

  return (
    <Box flexDirection="column">
      {/* Completed tasks scroll above */}
      <Static items={completed}>
        {(task, i) => (
          <StatusMessage key={i} variant={task.ok ? 'success' : 'error'}>
            {task.name}
          </StatusMessage>
        )}
      </Static>

      {/* Current task */}
      {current < total ? (
        <Box flexDirection="column" gap={1}>
          <Spinner label={initialTasks[current]} />
          <ProgressBar value={Math.round((current / total) * 100)} />
          <Text dimColor>{current}/{total} tasks</Text>
        </Box>
      ) : (
        <StatusMessage variant="success">All tasks completed!</StatusMessage>
      )}
    </Box>
  );
}
```

---

## Simple Table

Ink doesn't have a built-in table, but you can build one with `<Box>`:

```tsx
import React from 'react';
import {Box, Text} from 'ink';

interface Column<T> {
  header: string;
  key: keyof T;
  width: number;
  color?: string;
}

function Table<T extends Record<string, unknown>>({
  data,
  columns,
}: {
  data: T[];
  columns: Column<T>[];
}) {
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {columns.map(col => (
          <Box key={String(col.key)} width={col.width}>
            <Text bold underline>{col.header}</Text>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {data.map((row, i) => (
        <Box key={i}>
          {columns.map(col => (
            <Box key={String(col.key)} width={col.width}>
              <Text color={col.color}>{String(row[col.key])}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

// Usage
<Table
  data={[
    {name: 'api-server', status: 'running', cpu: '12%'},
    {name: 'worker', status: 'stopped', cpu: '0%'},
    {name: 'scheduler', status: 'running', cpu: '3%'},
  ]}
  columns={[
    {header: 'Service', key: 'name', width: 20},
    {header: 'Status', key: 'status', width: 15, color: 'green'},
    {header: 'CPU', key: 'cpu', width: 10},
  ]}
/>
```

---

## Command Router

For multi-command CLIs (like `git commit`, `git push`):

```tsx
import React from 'react';
import {render, Box, Text} from 'ink';
import meow from 'meow';

// Sub-commands as separate components
function InitCommand({name}: {name: string}) {
  return <Text>Initializing project: {name}</Text>;
}

function BuildCommand({watch}: {watch: boolean}) {
  return <Text>Building{watch ? ' (watch mode)' : ''}...</Text>;
}

function HelpCommand() {
  return (
    <Box flexDirection="column">
      <Text bold>Commands:</Text>
      <Text>  init &lt;name&gt;  - Initialize a project</Text>
      <Text>  build        - Build the project</Text>
      <Text>  help         - Show this help</Text>
    </Box>
  );
}

// Router
const cli = meow(`...`, {importMeta: import.meta});
const [command, ...args] = cli.input;

const commands: Record<string, React.ReactNode> = {
  init: <InitCommand name={args[0] || 'my-project'} />,
  build: <BuildCommand watch={!!cli.flags.watch} />,
  help: <HelpCommand />,
};

render(commands[command] || <HelpCommand />);
```

---

## Fullscreen App

Take over the entire terminal:

```tsx
import React, {useState} from 'react';
import {Box, Text, useInput, useApp, useWindowSize} from 'ink';

function FullscreenApp() {
  const {exit} = useApp();
  const {columns, rows} = useWindowSize();
  const [selected, setSelected] = useState(0);

  const items = ['Dashboard', 'Settings', 'Logs', 'Help'];

  useInput((input, key) => {
    if (input === 'q') exit();
    if (key.upArrow) setSelected(s => Math.max(0, s - 1));
    if (key.downArrow) setSelected(s => Math.min(items.length - 1, s + 1));
  });

  return (
    <Box width={columns} height={rows} flexDirection="row">
      {/* Sidebar */}
      <Box
        width={20}
        flexDirection="column"
        borderStyle="single"
        borderRight
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        paddingX={1}
      >
        <Text bold color="cyan">Menu</Text>
        {items.map((item, i) => (
          <Text key={i} inverse={i === selected} color={i === selected ? 'cyan' : undefined}>
            {i === selected ? '>' : ' '} {item}
          </Text>
        ))}
        <Box flexGrow={1} />
        <Text dimColor>q to quit</Text>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} padding={1}>
        <Text>{items[selected]} content area</Text>
      </Box>
    </Box>
  );
}
```

---

## Loading State Pattern

Show a spinner while async work completes, then display results:

```tsx
import React, {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import {Spinner, Alert} from '@inkjs/ui';

function AsyncOperation() {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    doSomethingAsync()
      .then(result => {
        setData(result);
        setState('success');
      })
      .catch(err => {
        setError(err.message);
        setState('error');
      });
  }, []);

  if (state === 'loading') {
    return <Spinner label="Working..." />;
  }

  if (state === 'error') {
    return <Alert variant="error">{error}</Alert>;
  }

  return (
    <Alert variant="success">
      Operation completed: {JSON.stringify(data)}
    </Alert>
  );
}
```

---

## Focus Management

Managing input focus across multiple interactive elements:

```tsx
import React, {useState} from 'react';
import {Box, Text, useFocus} from 'ink';
import {TextInput, Select} from '@inkjs/ui';

function FormField({label, children, id}: {label: string; children: React.ReactNode; id: string}) {
  const {isFocused} = useFocus({id});

  return (
    <Box flexDirection="column">
      <Text bold color={isFocused ? 'cyan' : undefined}>
        {isFocused ? '▸ ' : '  '}{label}
      </Text>
      {children}
    </Box>
  );
}

function Form() {
  const [step, setStep] = useState(0);

  return (
    <Box flexDirection="column" gap={1}>
      <TextInput
        isDisabled={step !== 0}
        placeholder="Name"
        onSubmit={() => setStep(1)}
      />
      <TextInput
        isDisabled={step !== 1}
        placeholder="Email"
        onSubmit={() => setStep(2)}
      />
      {step >= 2 && (
        <Select
          options={[
            {label: 'Free', value: 'free'},
            {label: 'Pro', value: 'pro'},
          ]}
          onChange={() => setStep(3)}
        />
      )}
    </Box>
  );
}
```

---

## Testing with ink-testing-library

```bash
npm install --save-dev ink-testing-library
```

```tsx
import React from 'react';
import {render} from 'ink-testing-library';
import {Text} from 'ink';
import App from './app.js';

// Basic render test
test('renders greeting', () => {
  const {lastFrame} = render(<App name="World" />);
  expect(lastFrame()).toContain('Hello, World');
});

// Test with user input
test('handles input', () => {
  const {lastFrame, stdin} = render(<App />);
  expect(lastFrame()).toContain('Press q to quit');

  stdin.write('q');
  expect(lastFrame()).toContain('Goodbye');
});

// Test with multiple frames
test('updates over time', async () => {
  const {lastFrame, frames} = render(<Counter />);
  expect(lastFrame()).toContain('0');

  // Wait for state update
  await delay(100);
  expect(lastFrame()).toContain('1');
});

// Simulating key presses
test('arrow key navigation', () => {
  const {lastFrame, stdin} = render(<Menu />);

  // Arrow down
  stdin.write('\u001B[B');
  expect(lastFrame()).toContain('> Item 2');

  // Enter
  stdin.write('\r');
  expect(lastFrame()).toContain('Selected: Item 2');
});
```

### Key escape codes for testing

```ts
const KEYS = {
  up: '\u001B[A',
  down: '\u001B[B',
  right: '\u001B[C',
  left: '\u001B[D',
  enter: '\r',
  escape: '\u001B',
  tab: '\t',
  backspace: '\x7F',
  delete: '\u001B[3~',
  space: ' ',
  ctrlC: '\x03',
};
```

---

## React DevTools

Debug Ink apps with React DevTools:

```bash
# Start your app with DEV=true
DEV=true node my-cli.js

# In another terminal
npx react-devtools
```

---

## Real-World CLI Structure

For larger CLIs, organize with a command pattern:

```
src/
├── cli.tsx          # Entry point, arg parsing
├── app.tsx          # Main app component (router)
├── commands/
│   ├── init.tsx
│   ├── build.tsx
│   └── deploy.tsx
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── Table.tsx
├── hooks/
│   ├── useApi.ts
│   └── useConfig.ts
└── utils/
    ├── config.ts
    └── api.ts
```

---

## Handling Process Exit

```tsx
import {useApp} from 'ink';

function App() {
  const {exit} = useApp();

  useEffect(() => {
    doWork()
      .then(result => exit())       // Exit successfully
      .catch(err => exit(err));      // Exit with error (sets process.exitCode = 1)
  }, []);

  return <Spinner label="Working..." />;
}

// In entry point
const instance = render(<App />);
try {
  await instance.waitUntilExit();
  console.log('Done!');
} catch (error) {
  console.error(error);
  process.exit(1);
}
```

---

## Non-Interactive / CI Mode

Ink detects CI environments and renders only the final frame. Override:

```bash
CI=false my-cli  # Force interactive mode in CI
```

For programmatic control:
```tsx
render(<App />, {
  interactive: false,  // Disable input handling
});
```

---

## Incremental Rendering

For large outputs, use incremental rendering to avoid flickering:

```tsx
render(<App />, {
  incrementalRendering: true,  // Only re-render changed portions
  maxFps: 30,                  // Limit frame rate
});
```
