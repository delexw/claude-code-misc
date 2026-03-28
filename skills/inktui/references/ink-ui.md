# @inkjs/ui — Pre-built UI Components for Ink

```bash
npm install @inkjs/ui
```

Requires `ink` and `react` as peer dependencies.

---

## TextInput

Single-line text entry with optional autocomplete suggestions.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | `false` | Ignore user input when disabled |
| `placeholder` | `string` | — | Text shown when input is empty |
| `defaultValue` | `string` | — | Initial value |
| `suggestions` | `string[]` | — | Autocomplete suggestions (case-sensitive, first match wins) |
| `onChange` | `(value: string) => void` | — | Called on every keystroke |
| `onSubmit` | `(value: string) => void` | — | Called when Enter is pressed |

### Examples

```tsx
import {TextInput} from '@inkjs/ui';

// Basic text input
<TextInput placeholder="Enter your name..." onSubmit={name => console.log(name)} />

// With real-time tracking
function NameInput() {
  const [value, setValue] = useState('');
  return (
    <Box flexDirection="column">
      <TextInput placeholder="Type here..." onChange={setValue} />
      <Text>Current value: {value}</Text>
    </Box>
  );
}

// With autocomplete suggestions
<TextInput
  placeholder="Enter a fruit..."
  suggestions={['apple', 'apricot', 'banana', 'blueberry', 'cherry']}
  onSubmit={fruit => console.log(fruit)}
/>

// With default value
<TextInput defaultValue="John Doe" onSubmit={name => console.log(name)} />
```

---

## EmailInput

Email entry with automatic domain autocomplete after typing `@`.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | `false` | Ignore user input when disabled |
| `placeholder` | `string` | — | Placeholder text |
| `defaultValue` | `string` | — | Initial value |
| `domains` | `string[]` | `["aol.com", "gmail.com", "yahoo.com", "hotmail.com", "live.com", "outlook.com", "icloud.com", "hey.com"]` | Domain autocomplete list |
| `onChange` | `(value: string) => void` | — | Called on every keystroke |
| `onSubmit` | `(email: string) => void` | — | Called when Enter is pressed |

### Example

```tsx
import {EmailInput} from '@inkjs/ui';

<EmailInput
  placeholder="Enter your email..."
  onSubmit={email => console.log(`Email: ${email}`)}
/>
```

---

## PasswordInput

Masked text entry (displays asterisks).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | `false` | Ignore user input when disabled |
| `placeholder` | `string` | — | Placeholder text |
| `onChange` | `(value: string) => void` | — | Called on every keystroke |
| `onSubmit` | `(password: string) => void` | — | Called when Enter is pressed |

### Example

```tsx
import {PasswordInput} from '@inkjs/ui';

<PasswordInput
  placeholder="Enter password..."
  onSubmit={password => authenticate(password)}
/>
```

---

## ConfirmInput

Yes/no confirmation prompt (Y/n). Press Y to confirm, N to cancel. Enter submits the default choice.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | `false` | Ignore user input when disabled |
| `defaultChoice` | `"confirm" \| "cancel"` | `"confirm"` | Default selection when Enter is pressed |
| `submitOnEnter` | `boolean` | `true` | Auto-submit default choice on Enter |
| `onConfirm` | `() => void` | — | Called when user confirms (Y) |
| `onCancel` | `() => void` | — | Called when user cancels (N) |

### Example

```tsx
import {ConfirmInput} from '@inkjs/ui';

function DeleteConfirm() {
  const [result, setResult] = useState(null);

  if (result !== null) {
    return <Text>{result ? 'Deleted!' : 'Cancelled.'}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text>Are you sure you want to delete?</Text>
      <ConfirmInput
        onConfirm={() => setResult(true)}
        onCancel={() => setResult(false)}
      />
    </Box>
  );
}
```

---

## Select

Scrollable single-selection list. Uncontrolled component.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | `false` | Ignore user input |
| `visibleOptionCount` | `number` | `5` | Number of visible options |
| `highlightText` | `string` | — | Text to highlight in labels |
| `options` | `Array<{label: string, value: string}>` | — | Options to display |
| `defaultValue` | `string` | — | Initially selected value |
| `onChange` | `(value: string) => void` | — | Called when selection changes |

### Examples

```tsx
import {Select} from '@inkjs/ui';

// Basic select
function ColorPicker() {
  const [color, setColor] = useState('');

  return (
    <Box flexDirection="column">
      <Text>Pick a color:</Text>
      <Select
        options={[
          {label: 'Red', value: 'red'},
          {label: 'Green', value: 'green'},
          {label: 'Blue', value: 'blue'},
          {label: 'Yellow', value: 'yellow'},
          {label: 'Magenta', value: 'magenta'},
          {label: 'Cyan', value: 'cyan'},
        ]}
        onChange={setColor}
      />
      {color && <Text>Selected: {color}</Text>}
    </Box>
  );
}

// With default value
<Select
  defaultValue="green"
  options={[
    {label: 'Red', value: 'red'},
    {label: 'Green', value: 'green'},
    {label: 'Blue', value: 'blue'},
  ]}
  onChange={setColor}
/>

// Multiple selects (only one active at a time)
function StepByStep() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  return (
    <Box flexDirection="column">
      <Text>Step 1: Choose size</Text>
      <Select
        isDisabled={step !== 0}
        options={[
          {label: 'Small', value: 'sm'},
          {label: 'Medium', value: 'md'},
          {label: 'Large', value: 'lg'},
        ]}
        onChange={v => {
          setAnswers(a => ({...a, size: v}));
          setStep(1);
        }}
      />
      {step >= 1 && (
        <>
          <Text>Step 2: Choose color</Text>
          <Select
            isDisabled={step !== 1}
            options={[
              {label: 'Red', value: 'red'},
              {label: 'Blue', value: 'blue'},
            ]}
            onChange={v => {
              setAnswers(a => ({...a, color: v}));
              setStep(2);
            }}
          />
        </>
      )}
    </Box>
  );
}
```

---

## MultiSelect

Multiple-selection list. Uncontrolled component. Use Space to toggle, Enter to submit.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | `false` | Ignore user input |
| `visibleOptionCount` | `number` | `5` | Number of visible options |
| `highlightText` | `string` | — | Text to highlight in labels |
| `options` | `Array<{label: string, value: string}>` | — | Options to display |
| `defaultValue` | `string[]` | — | Initially selected values |
| `onChange` | `(values: string[]) => void` | — | Called when selection changes |
| `onSubmit` | `(values: string[]) => void` | — | Called when Enter is pressed |

### Examples

```tsx
import {MultiSelect} from '@inkjs/ui';

// Track changes in real-time
function TagSelector() {
  const [tags, setTags] = useState([]);

  return (
    <Box flexDirection="column">
      <Text>Select tags (Space to toggle, Enter to confirm):</Text>
      <MultiSelect
        options={[
          {label: 'Bug', value: 'bug'},
          {label: 'Feature', value: 'feature'},
          {label: 'Docs', value: 'docs'},
          {label: 'Testing', value: 'testing'},
          {label: 'Performance', value: 'performance'},
        ]}
        onChange={setTags}
      />
      <Text>Selected: {tags.join(', ') || 'none'}</Text>
    </Box>
  );
}

// Submit on Enter
<MultiSelect
  options={toppings}
  defaultValue={['cheese']}
  onSubmit={selected => console.log('Final:', selected)}
/>
```

---

## Spinner

Animated loading indicator.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Text to display next to spinner |

### Example

```tsx
import {Spinner} from '@inkjs/ui';

// Basic spinner
<Spinner label="Loading..." />

// Conditional spinner
function FetchData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner label="Fetching data..." />;
  return <Text>Got {data.length} items</Text>;
}
```

---

## ProgressBar

Displays a progress percentage as a visual bar.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `number` | Progress value (0–100) |

### Example

```tsx
import {ProgressBar} from '@inkjs/ui';

function Download() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => Math.min(100, p + 10));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Downloading...</Text>
      <ProgressBar value={progress} />
      <Text>{progress}%</Text>
    </Box>
  );
}
```

---

## Badge

Inline status indicator with color.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `color` | `string` | Color: `"green"`, `"red"`, `"yellow"`, `"blue"` |
| `children` | `ReactNode` | Badge text |

### Example

```tsx
import {Badge} from '@inkjs/ui';

function TestResults({results}) {
  return (
    <Box flexDirection="column" gap={1}>
      {results.map((r, i) => (
        <Box key={i} gap={1}>
          <Badge color={r.passed ? 'green' : 'red'}>
            {r.passed ? 'PASS' : 'FAIL'}
          </Badge>
          <Text>{r.name}</Text>
        </Box>
      ))}
    </Box>
  );
}
```

---

## StatusMessage

Status line with icon and message. Variants: `success`, `error`, `warning`, `info`.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `variant` | `"success" \| "error" \| "warning" \| "info"` | Status type |
| `children` | `ReactNode` | Message content |

### Example

```tsx
import {StatusMessage} from '@inkjs/ui';

<StatusMessage variant="success">Deployed to production</StatusMessage>
<StatusMessage variant="error">Build failed: missing dependency</StatusMessage>
<StatusMessage variant="warning">Disk usage at 85%</StatusMessage>
<StatusMessage variant="info">Next deployment scheduled for 3pm</StatusMessage>
```

---

## Alert

Bordered alert box for important messages. Same variants as StatusMessage.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `variant` | `"success" \| "error" \| "warning" \| "info"` | Alert type |
| `title` | `string` | Optional title displayed above the message |
| `children` | `ReactNode` | Alert content |

### Example

```tsx
import {Alert} from '@inkjs/ui';

<Alert variant="success">
  New version v2.1.0 deployed successfully
</Alert>

<Alert variant="error">
  Your API key has expired. Run `myapp auth` to re-authenticate.
</Alert>

<Alert variant="warning">
  This version of the CLI is deprecated. Please upgrade.
</Alert>

<Alert variant="info">
  Scheduled maintenance window: Saturday 2am-4am UTC
</Alert>
```

---

## UnorderedList

Bulleted list with nesting support.

### Example

```tsx
import {UnorderedList} from '@inkjs/ui';

<UnorderedList>
  <UnorderedList.Item>
    <Text>Dependencies</Text>
    <UnorderedList>
      <UnorderedList.Item><Text>ink 5.0.0</Text></UnorderedList.Item>
      <UnorderedList.Item><Text>react 18.0.0</Text></UnorderedList.Item>
    </UnorderedList>
  </UnorderedList.Item>
  <UnorderedList.Item>
    <Text>Dev Dependencies</Text>
    <UnorderedList>
      <UnorderedList.Item><Text>typescript 5.0.0</Text></UnorderedList.Item>
    </UnorderedList>
  </UnorderedList.Item>
</UnorderedList>
```

---

## OrderedList

Numbered list with nesting support.

### Example

```tsx
import {OrderedList} from '@inkjs/ui';

<OrderedList>
  <OrderedList.Item>
    <Text>Install dependencies</Text>
  </OrderedList.Item>
  <OrderedList.Item>
    <Text>Configure settings</Text>
    <OrderedList>
      <OrderedList.Item><Text>Set API key</Text></OrderedList.Item>
      <OrderedList.Item><Text>Choose region</Text></OrderedList.Item>
    </OrderedList>
  </OrderedList.Item>
  <OrderedList.Item>
    <Text>Deploy</Text>
  </OrderedList.Item>
</OrderedList>
```

---

## Theming

All ink-ui components support theming via React context.

### Extending the Default Theme

```tsx
import {render, type TextProps, type BoxProps} from 'ink';
import {
  ThemeProvider,
  extendTheme,
  defaultTheme,
  type ComponentTheme,
} from '@inkjs/ui';

const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        container: (): BoxProps => ({gap: 2}),
        frame: (): TextProps => ({color: 'magenta'}),
        label: (): TextProps => ({bold: true}),
      },
    },
    StatusMessage: {
      styles: {
        icon: ({variant}): TextProps => ({
          color: {
            success: 'green',
            error: 'red',
            warning: 'yellow',
            info: 'cyan',
          }[variant],
        }),
      },
    },
    UnorderedList: {
      config: () => ({
        marker: '→',  // Change bullet character
      }),
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={customTheme}>
      <Spinner label="Loading..." />
      <StatusMessage variant="success">Done!</StatusMessage>
    </ThemeProvider>
  );
}

render(<App />);
```

### Creating Themed Custom Components

```tsx
import {Text, type TextProps} from 'ink';
import {
  useComponentTheme,
  extendTheme,
  defaultTheme,
  ThemeProvider,
  type ComponentTheme,
} from '@inkjs/ui';

// 1. Define the theme shape
const myButtonTheme = {
  styles: {
    label: ({isActive}: {isActive: boolean}): TextProps => ({
      bold: isActive,
      color: isActive ? 'green' : 'gray',
    }),
  },
} satisfies ComponentTheme;

type MyButtonTheme = typeof myButtonTheme;

// 2. Register in theme
const theme = extendTheme(defaultTheme, {
  components: {
    MyButton: myButtonTheme,
  },
});

// 3. Use in component
function MyButton({label, isActive}: {label: string; isActive: boolean}) {
  const {styles} = useComponentTheme<MyButtonTheme>('MyButton');
  return <Text {...styles.label({isActive})}>{label}</Text>;
}

// 4. Wrap app
function App() {
  return (
    <ThemeProvider theme={theme}>
      <MyButton label="Click me" isActive={true} />
    </ThemeProvider>
  );
}
```

### Theme API

- `defaultTheme` — Base theme with all component defaults
- `extendTheme(base, overrides)` — Create a new theme by merging overrides into a base theme
- `ThemeProvider` — React context provider; wrap your app with it
- `useComponentTheme<T>(name)` — Access `{styles, config}` for a named component inside the theme
