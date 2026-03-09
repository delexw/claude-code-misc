# Ink Hooks

## `useInput(handler, options?)`

Handles keyboard input. The handler receives the raw character and a key metadata object.

### Signature

```tsx
useInput(
  (input: string, key: Key) => void,
  options?: { isActive?: boolean }
)
```

### Key Object

```ts
interface Key {
  leftArrow: boolean;
  rightArrow: boolean;
  upArrow: boolean;
  downArrow: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  pageDown: boolean;
  pageUp: boolean;
  home: boolean;
  end: boolean;
  meta: boolean;
  // Kitty keyboard protocol:
  super: boolean;
  hyper: boolean;
  capsLock: boolean;
  numLock: boolean;
  eventType?: "press" | "repeat" | "release";
}
```

### Examples

```tsx
import {useInput, useApp} from 'ink';

function App() {
  const {exit} = useApp();

  useInput((input, key) => {
    // Character input
    if (input === 'q') exit();

    // Arrow keys
    if (key.upArrow) moveUp();
    if (key.downArrow) moveDown();

    // Ctrl combinations
    if (key.ctrl && input === 'c') exit();

    // Enter key
    if (key.return) submit();

    // Escape
    if (key.escape) cancel();

    // Tab navigation
    if (key.tab && !key.shift) focusNext();
    if (key.tab && key.shift) focusPrevious();
  });

  return <Text>Interactive app</Text>;
}

// Conditionally active (e.g., during a specific mode)
function Modal({isOpen, onClose}) {
  useInput((input, key) => {
    if (key.escape) onClose();
  }, {isActive: isOpen});

  if (!isOpen) return null;
  return <Box borderStyle="round"><Text>Modal content</Text></Box>;
}
```

---

## `usePaste(handler, options?)`

Listens for paste events from the terminal.

### Signature

```tsx
usePaste(
  (text: string) => void,
  options?: { isActive?: boolean }
)
```

### Example

```tsx
import {usePaste} from 'ink';

function PasteArea() {
  const [pasted, setPasted] = useState('');

  usePaste(text => {
    setPasted(text);
  });

  return <Text>Pasted: {pasted || 'nothing yet'}</Text>;
}
```

---

## `useApp()`

Access app lifecycle methods.

### Returns

```ts
{
  exit: (errorOrResult?: Error | unknown) => void;
  waitUntilRenderFlush: () => Promise<void>;
}
```

### Examples

```tsx
import {useApp} from 'ink';

function App() {
  const {exit} = useApp();

  // Exit successfully
  const handleDone = () => exit();

  // Exit with error
  const handleError = (err) => exit(err);

  // Wait for render to flush before doing something
  const {waitUntilRenderFlush} = useApp();
  useEffect(() => {
    async function run() {
      await waitUntilRenderFlush();
      // Output is now visible in terminal
    }
    run();
  }, []);

  return <Text>Working...</Text>;
}
```

---

## `useStdin()`

Access stdin stream and raw mode control.

### Returns

```ts
{
  stdin: stream.Readable;
  isRawModeSupported: boolean;
  setRawMode: (enabled: boolean) => void;
}
```

### Example

```tsx
import {useStdin} from 'ink';

function App() {
  const {stdin, isRawModeSupported, setRawMode} = useStdin();

  useEffect(() => {
    if (isRawModeSupported) {
      setRawMode(true);
    }
    return () => {
      if (isRawModeSupported) {
        setRawMode(false);
      }
    };
  }, []);

  return <Text>Raw mode: {isRawModeSupported ? 'yes' : 'no'}</Text>;
}
```

---

## `useStdout()`

Access stdout stream and write directly to it.

### Returns

```ts
{
  stdout: stream.Writable;
  write: (data: string) => void;
}
```

### Example

```tsx
import {useStdout} from 'ink';

function App() {
  const {write} = useStdout();

  // Write directly to stdout (outside of React rendering)
  useEffect(() => {
    write('\x1b[?25l'); // Hide cursor
    return () => write('\x1b[?25h'); // Show cursor on unmount
  }, []);

  return <Text>App content</Text>;
}
```

---

## `useStderr()`

Access stderr stream and write to it.

### Returns

```ts
{
  stderr: stream.Writable;
  write: (data: string) => void;
}
```

### Example

```tsx
import {useStderr} from 'ink';

function App() {
  const {write} = useStderr();

  const logError = (msg: string) => write(`Error: ${msg}\n`);

  return <Text>App</Text>;
}
```

---

## `useWindowSize()`

Returns current terminal dimensions. Updates on resize.

### Returns

```ts
{
  columns: number;
  rows: number;
}
```

### Example

```tsx
import {useWindowSize} from 'ink';

function App() {
  const {columns, rows} = useWindowSize();

  return (
    <Box flexDirection="column">
      <Text>Terminal: {columns}x{rows}</Text>
      <Box width={columns} height={rows - 2}>
        <Text>Fullscreen content area</Text>
      </Box>
    </Box>
  );
}
```

---

## `useBoxMetrics(ref)`

Returns layout metrics (position and size) for a Box component.

### Returns

```ts
{
  width: number;
  height: number;
  left: number;
  top: number;
  hasMeasured: boolean;
}
```

### Example

```tsx
import {useRef} from 'react';
import {Box, Text, useBoxMetrics} from 'ink';

function App() {
  const ref = useRef(null);
  const {width, height, hasMeasured} = useBoxMetrics(ref);

  return (
    <Box ref={ref} borderStyle="round" padding={1}>
      <Text>
        {hasMeasured ? `Size: ${width}x${height}` : 'Measuring...'}
      </Text>
    </Box>
  );
}
```

---

## `useFocus(options?)`

Manage focus for the current component. Components become focusable and users can cycle through them with Tab/Shift+Tab.

### Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoFocus` | `boolean` | `false` | Auto-focus on mount |
| `isActive` | `boolean` | `true` | Whether this component is focusable |
| `id` | `string` | — | Unique focus ID for programmatic focus |

### Returns

```ts
{
  isFocused: boolean;
}
```

### Example

```tsx
import {Box, Text, useFocus} from 'ink';

function FocusableItem({label}) {
  const {isFocused} = useFocus();

  return (
    <Box>
      <Text color={isFocused ? 'green' : undefined}>
        {isFocused ? '>' : ' '} {label}
      </Text>
    </Box>
  );
}

function App() {
  return (
    <Box flexDirection="column">
      <Text dimColor>Use Tab to navigate:</Text>
      <FocusableItem label="Option A" />
      <FocusableItem label="Option B" />
      <FocusableItem label="Option C" />
    </Box>
  );
}
```

---

## `useFocusManager()`

Programmatically manage focus across all focusable components.

### Returns

```ts
{
  enableFocus: () => void;
  disableFocus: () => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focus: (id: string) => void;
  activeId: string | undefined;
}
```

### Example

```tsx
import {useFocusManager, useInput} from 'ink';

function App() {
  const {focusNext, focusPrevious, focus} = useFocusManager();

  useInput((input, key) => {
    if (key.tab && key.shift) {
      focusPrevious();
    } else if (key.tab) {
      focusNext();
    }

    // Jump to specific component
    if (input === '1') focus('input-name');
    if (input === '2') focus('input-email');
  });

  return (
    <Box flexDirection="column">
      <FocusableInput id="input-name" label="Name" />
      <FocusableInput id="input-email" label="Email" />
    </Box>
  );
}
```

---

## `useCursor()`

Control terminal cursor position (useful for text editors or cursor-based UIs).

### Returns

```ts
{
  setCursorPosition: (position?: {x: number, y: number}) => void;
}
```

### Example

```tsx
import {useCursor} from 'ink';

function TextEditor() {
  const {setCursorPosition} = useCursor();
  const [cursorX, setCursorX] = useState(0);

  useEffect(() => {
    setCursorPosition({x: cursorX, y: 0});
  }, [cursorX]);

  return <Text>Edit: {'_'.repeat(20)}</Text>;
}
```

---

## `useIsScreenReaderEnabled()`

Check if screen reader support is active.

### Returns

`boolean`

### Example

```tsx
import {useIsScreenReaderEnabled} from 'ink';

function App() {
  const isScreenReader = useIsScreenReaderEnabled();

  return (
    <Box>
      {isScreenReader ? (
        <Text aria-label="Status: complete">Done</Text>
      ) : (
        <Text color="green">✔ Done</Text>
      )}
    </Box>
  );
}
```

---

## `measureElement(ref)`

Standalone function (not a hook) to measure a Box element's dimensions.

### Signature

```tsx
measureElement(ref: React.RefObject): { width: number; height: number }
```

### Example

```tsx
import {useRef, useEffect, useState} from 'react';
import {Box, Text, measureElement} from 'ink';

function App() {
  const ref = useRef(null);
  const [size, setSize] = useState({width: 0, height: 0});

  useEffect(() => {
    if (ref.current) {
      setSize(measureElement(ref.current));
    }
  }, []);

  return (
    <Box ref={ref} borderStyle="single">
      <Text>Size: {size.width}x{size.height}</Text>
    </Box>
  );
}
```
