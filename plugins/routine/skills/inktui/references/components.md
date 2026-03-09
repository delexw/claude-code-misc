# Ink Core Components

## `<Text>`

Renders styled text. All string content must be inside `<Text>`.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | `string` | — | Text color (name, hex `#ff0000`, or `rgb(255,0,0)`) |
| `backgroundColor` | `string` | — | Background color |
| `dimColor` | `boolean` | `false` | Dim the color |
| `bold` | `boolean` | `false` | Bold text |
| `italic` | `boolean` | `false` | Italic text |
| `underline` | `boolean` | `false` | Underline text |
| `strikethrough` | `boolean` | `false` | Strikethrough text |
| `inverse` | `boolean` | `false` | Swap foreground/background |
| `wrap` | `"wrap" \| "end" \| "middle" \| "truncate" \| "truncate-start" \| "truncate-middle" \| "truncate-end"` | `"wrap"` | Text wrapping behavior |

### Examples

```tsx
// Basic styling
<Text bold color="green">Success!</Text>

// Nested inline styles
<Text>
  Hello <Text bold>World</Text>, welcome to <Text color="cyan" underline>Ink</Text>
</Text>

// Truncation
<Box width={20}>
  <Text wrap="truncate-end">This very long text will be truncated...</Text>
</Box>

// Dim secondary text
<Text dimColor>Last updated: 5 minutes ago</Text>

// Inverse for highlighted items
<Text inverse> SELECTED </Text>
```

### ARIA Props (on both `<Text>` and `<Box>`)

| Prop | Type | Description |
|------|------|-------------|
| `aria-label` | `string` | Accessible label |
| `aria-hidden` | `boolean` | Hide from screen readers |
| `aria-role` | `string` | ARIA role (`"button"`, `"checkbox"`, `"combobox"`, `"list"`, `"listbox"`, `"listitem"`, `"menu"`, `"menuitem"`, `"option"`, `"progressbar"`, `"radio"`, `"radiogroup"`, `"tab"`, `"tablist"`, `"textbox"`, `"timer"`, `"toolbar"`, `"table"`) |
| `aria-state` | `object` | `{busy?, checked?, disabled?, expanded?, multiline?, multiselectable?, readonly?, required?, selected?}` |

Enable screen reader support:
```tsx
render(<App />, {isScreenReaderEnabled: true});
// Or via env: INK_SCREEN_READER=true
```

---

## `<Box>`

Flexbox container for layout. Every element in Ink is a flex container.

### Dimension Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number \| string` | — | Width (number = columns, string = percentage like `"50%"`) |
| `height` | `number \| string` | — | Height |
| `minWidth` | `number \| string` | — | Minimum width |
| `minHeight` | `number \| string` | — | Minimum height |
| `maxWidth` | `number \| string` | — | Maximum width |
| `maxHeight` | `number \| string` | — | Maximum height |
| `aspectRatio` | `number` | — | Aspect ratio |

### Padding Props

| Prop | Type | Default |
|------|------|---------|
| `padding` | `number` | — |
| `paddingX` | `number` | — |
| `paddingY` | `number` | — |
| `paddingTop` | `number` | — |
| `paddingBottom` | `number` | — |
| `paddingLeft` | `number` | — |
| `paddingRight` | `number` | — |

### Margin Props

| Prop | Type | Default |
|------|------|---------|
| `margin` | `number` | — |
| `marginX` | `number` | — |
| `marginY` | `number` | — |
| `marginTop` | `number` | — |
| `marginBottom` | `number` | — |
| `marginLeft` | `number` | — |
| `marginRight` | `number` | — |

### Gap Props

| Prop | Type | Default |
|------|------|---------|
| `gap` | `number` | — |
| `columnGap` | `number` | — |
| `rowGap` | `number` | — |

### Flex Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `flexDirection` | `"row" \| "row-reverse" \| "column" \| "column-reverse"` | `"row"` | Main axis direction |
| `flexWrap` | `"nowrap" \| "wrap" \| "wrap-reverse"` | `"nowrap"` | Wrapping behavior |
| `flexGrow` | `number` | `0` | Grow factor |
| `flexShrink` | `number` | `1` | Shrink factor |
| `flexBasis` | `number \| string` | — | Initial size |
| `alignItems` | `"flex-start" \| "center" \| "flex-end" \| "stretch" \| "baseline"` | `"stretch"` | Cross-axis alignment |
| `alignSelf` | `"auto" \| "flex-start" \| "center" \| "flex-end" \| "stretch" \| "baseline"` | `"auto"` | Self cross-axis alignment |
| `alignContent` | `"flex-start" \| "flex-end" \| "center" \| "stretch" \| "space-between" \| "space-around" \| "space-evenly"` | `"flex-start"` | Multi-line alignment |
| `justifyContent` | `"flex-start" \| "center" \| "flex-end" \| "space-between" \| "space-around" \| "space-evenly"` | `"flex-start"` | Main-axis alignment |

### Position Props

| Prop | Type | Default |
|------|------|---------|
| `position` | `"relative" \| "absolute" \| "static"` | `"relative"` |
| `top` | `number \| string` | — |
| `right` | `number \| string` | — |
| `bottom` | `number \| string` | — |
| `left` | `number \| string` | — |

### Display & Overflow

| Prop | Type | Default |
|------|------|---------|
| `display` | `"flex" \| "none"` | `"flex"` |
| `overflow` | `"visible" \| "hidden"` | `"visible"` |
| `overflowX` | `"visible" \| "hidden"` | — |
| `overflowY` | `"visible" \| "hidden"` | — |

### Border Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `borderStyle` | `"single" \| "double" \| "round" \| "bold" \| "singleDouble" \| "doubleSingle" \| "classic" \| custom` | — | Border line style |
| `borderColor` | `string` | — | Border color |
| `borderTopColor` | `string` | — | Per-side color |
| `borderRightColor` | `string` | — | Per-side color |
| `borderBottomColor` | `string` | — | Per-side color |
| `borderLeftColor` | `string` | — | Per-side color |
| `borderDimColor` | `boolean` | `false` | Dim all borders |
| `borderTopDimColor` | `boolean` | `false` | Dim top border |
| `borderRightDimColor` | `boolean` | `false` | Dim right border |
| `borderBottomDimColor` | `boolean` | `false` | Dim bottom border |
| `borderLeftDimColor` | `boolean` | `false` | Dim left border |
| `borderTop` | `boolean` | `true` | Show top border |
| `borderRight` | `boolean` | `true` | Show right border |
| `borderBottom` | `boolean` | `true` | Show bottom border |
| `borderLeft` | `boolean` | `true` | Show left border |

### Background

| Prop | Type | Default |
|------|------|---------|
| `backgroundColor` | `string` | — |

### Examples

```tsx
// Column layout with gap
<Box flexDirection="column" gap={1}>
  <Text>Line 1</Text>
  <Text>Line 2</Text>
</Box>

// Horizontal layout with spacing
<Box justifyContent="space-between" width="100%">
  <Text>Left</Text>
  <Text>Right</Text>
</Box>

// Centered content
<Box alignItems="center" justifyContent="center" height={10}>
  <Text>Centered</Text>
</Box>

// Bordered box with padding
<Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
  <Text bold>Title</Text>
  <Text>Content goes here</Text>
</Box>

// Percentage widths
<Box width="100%">
  <Box width="30%"><Text>Sidebar</Text></Box>
  <Box width="70%"><Text>Main</Text></Box>
</Box>

// Absolute positioning (overlay)
<Box width={40} height={10}>
  <Text>Background</Text>
  <Box position="absolute" top={0} right={0}>
    <Text color="red">Badge</Text>
  </Box>
</Box>

// Hidden overflow for scrollable areas
<Box height={5} overflow="hidden" flexDirection="column">
  {items.map((item, i) => <Text key={i}>{item}</Text>)}
</Box>

// Custom border style
<Box borderStyle={{
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  top: '─',
  bottom: '─',
  left: '│',
  right: '│',
}}>
  <Text>Custom borders</Text>
</Box>
```

---

## `<Newline>`

Inserts newline character(s). Only valid inside `<Text>`.

### Props

| Prop | Type | Default |
|------|------|---------|
| `count` | `number` | `1` |

### Example

```tsx
<Text>
  Line 1<Newline />Line 2<Newline count={2} />Line 4
</Text>
```

---

## `<Spacer>`

Flexible space that expands along the main axis. Like `flex: 1` in CSS.

### Example

```tsx
// Push items to edges
<Box>
  <Text>Left</Text>
  <Spacer />
  <Text>Right</Text>
</Box>

// Equal spacing
<Box>
  <Text>A</Text>
  <Spacer />
  <Text>B</Text>
  <Spacer />
  <Text>C</Text>
</Box>
```

---

## `<Static>`

Permanently renders output above the interactive area. Content is written once and never re-rendered — ideal for logs, completed task output, or build results.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `items` | `Array<T>` | Items to render |
| `style` | `BoxProps` | Container styling |
| `children` | `(item: T, index: number) => ReactNode` | Render function |

### Examples

```tsx
// Build log with completed steps above, current step below
function Build() {
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState('Building...');

  return (
    <>
      <Static items={completedSteps}>
        {(step, i) => (
          <Box key={i}>
            <Text color="green">✔</Text>
            <Text> {step}</Text>
          </Box>
        )}
      </Static>
      <Box>
        <Spinner />
        <Text> {currentStep}</Text>
      </Box>
    </>
  );
}
```

Items must have stable keys. New items appended to the array are rendered once — existing items are never updated.

---

## `<Transform>`

Transforms the string output of child components before rendering.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `transform` | `(line: string, index: number) => string` | Transform function called for each output line |

### Examples

```tsx
// Add line numbers
<Transform transform={(line, index) => `${index + 1}: ${line}`}>
  <Text>First line</Text>
  <Text>Second line</Text>
</Transform>

// Uppercase everything
<Transform transform={line => line.toUpperCase()}>
  <Text>hello world</Text>
</Transform>

// Indent all output
<Transform transform={line => `  ${line}`}>
  <Box flexDirection="column">
    <Text>Line A</Text>
    <Text>Line B</Text>
  </Box>
</Transform>
```
