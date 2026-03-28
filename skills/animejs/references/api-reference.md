# Anime.js v4 API Reference

Complete parameter and method reference for all anime.js v4 modules.

## Table of Contents

1. [animate()](#animate)
2. [createTimeline()](#createtimeline)
3. [createTimer()](#createtimer)
4. [createDraggable()](#createdraggable)
5. [createAnimatable()](#createanimatable)
6. [createScope()](#createscope)
7. [createLayout()](#createlayout)
8. [SVG Utilities](#svg-utilities)
9. [Text Utilities](#text-utilities)
10. [Scroll Events](#scroll-events)
11. [WAAPI](#waapi)
12. [Utilities & Helpers](#utilities--helpers)
13. [Engine Configuration](#engine-configuration)

---

## animate()

```js
import { animate } from 'animejs';
const animation = animate(targets, parameters);
```

### Targets

| Type | Example |
|------|---------|
| CSS selector | `'.box'`, `'#hero'`, `'div.card'` |
| DOM element | `document.querySelector('.box')` |
| NodeList | `document.querySelectorAll('.box')` |
| JS object | `{ x: 0, y: 0 }` |
| Array | `[el1, el2, '.box']` |

### Animatable Properties

**CSS Properties** (camelCase): `opacity`, `width`, `height`, `backgroundColor`, `borderRadius`, `padding`, `margin`, `fontSize`, `color`, `boxShadow`, etc.

**CSS Transforms** (individual): `translateX`, `translateY`, `translateZ`, `rotate`, `rotateX`, `rotateY`, `rotateZ`, `scale`, `scaleX`, `scaleY`, `skew`, `skewX`, `skewY`, `perspective`.

**CSS Variables**: `'--custom-prop': value`

**SVG Attributes**: `cx`, `cy`, `r`, `rx`, `ry`, `x1`, `y1`, `x2`, `y2`, `points`, `viewBox`, `strokeDashoffset`, `d` (via `svg.morphTo`).

**HTML Attributes**: `value`, `data-*`, `width`, `height` (on `<img>`, `<canvas>`, etc.).

**JS Object Properties**: Any numeric property on a plain JS object.

### Value Types

```js
// Number (default unit: px for position/size, deg for rotation)
translateX: 250

// String with unit
translateX: '10rem'
width: '50%'
rotate: '1turn'

// Relative values
translateX: '+=100'     // add to current
translateX: '-=50px'    // subtract from current
translateX: '*=2'       // multiply current

// Array [from, to]
opacity: [0, 1]

// Object from/to
scale: { from: 0.5, to: 1.5 }

// Colors (hex, rgb, hsl)
backgroundColor: '#FF0000'
color: 'rgb(255, 0, 0)'
color: 'hsl(0, 100%, 50%)'

// Function-based (per element)
translateX: (el, i, total) => i * 50
delay: (el, i, total) => i * 100
```

### Per-Property Keyframes

```js
animate(el, {
  y: [
    { to: -100, ease: 'outExpo', duration: 600 },
    { to: 0, ease: 'outBounce', duration: 800, delay: 100 },
  ],
  x: [
    { to: 200, duration: 1000 },
    { to: 0, duration: 500 },
  ],
});
```

Each keyframe object can have: `to`, `from`, `ease`, `duration`, `delay`, `composition`.

### Playback Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `duration` | number | 1000 | Animation duration in ms |
| `delay` | number/fn | 0 | Delay before start in ms |
| `loopDelay` | number | 0 | Delay between loops |
| `loop` | number/boolean | 0 | Number of repetitions (true = infinite) |
| `alternate` | boolean | false | Reverse direction each loop |
| `reversed` | boolean | false | Play in reverse |
| `autoplay` | boolean/ScrollObserver | true | Auto-start or scroll trigger |
| `playbackRate` | number | 1 | Speed multiplier |
| `frameRate` | number | null | FPS cap |
| `playbackEase` | string/fn | null | Easing applied to overall progress |
| `composition` | string | 'replace' | `'replace'`, `'add'`, or `'none'` |
| `modifier` | function | null | Transform numeric values before applying |

### Callbacks

| Callback | When |
|----------|------|
| `onBegin(anim)` | After delay, when animation starts rendering |
| `onUpdate(anim)` | Every tick/frame |
| `onRender(anim)` | When values are committed to DOM |
| `onLoop(anim)` | At each loop boundary |
| `onPause(anim)` | When paused |
| `onComplete(anim)` | When fully finished |
| `onBeforeUpdate(anim)` | Before each update |

### Methods on JSAnimation

| Method | Description |
|--------|-------------|
| `play()` | Play forward from current position |
| `pause()` | Pause at current position |
| `resume()` | Continue in previous direction |
| `reverse()` | Play backward |
| `alternate()` | Toggle direction |
| `restart()` | Reset and play from start |
| `seek(time)` | Jump to time in ms |
| `complete()` | Jump to end |
| `cancel()` | Stop and reset to initial |
| `reset()` | Reset to initial state |
| `revert()` | Remove all inline styles set by animation |
| `stretch(newDuration)` | Change total duration |
| `refresh()` | Recalculate values (after DOM changes) |
| `.then(fn)` | Promise-based completion |

### Properties on JSAnimation

| Property | Type | Description |
|----------|------|-------------|
| `currentTime` | number | Current time in ms |
| `progress` | number | 0-1 progress |
| `duration` | number | Total duration |
| `paused` | boolean | Whether paused |
| `began` | boolean | Whether began |
| `completed` | boolean | Whether completed |
| `reversed` | boolean | Whether reversed |
| `iterationCount` | number | Current loop iteration |

---

## createTimeline()

```js
import { createTimeline } from 'animejs';
const tl = createTimeline(parameters);
```

### Parameters

Same playback settings and callbacks as `animate()`, plus:

| Parameter | Type | Description |
|-----------|------|-------------|
| `defaults` | object | Default params inherited by child animations |

### Methods

```js
// Add animation
tl.add(targets, animationParams, position?)

// Add timer
tl.add(timerParams, position?)

// Add label
tl.label(name, position?)

// Call function at position
tl.call(fn, position?)

// Sync another timeline or WAAPI animation
tl.sync(otherTimeline, position?)
```

### Position Values

| Syntax | Meaning |
|--------|---------|
| `500` | Absolute: at 500ms |
| `'+=100'` | 100ms after previous end |
| `'-=300'` | 300ms before previous end |
| `'<'` | Same start as previous animation |
| `'<+=200'` | 200ms after previous start |
| `'<-=100'` | 100ms before previous start |
| `'labelName'` | At the named label |
| `'labelName+=200'` | 200ms after label |

---

## createTimer()

```js
import { createTimer } from 'animejs';
const timer = createTimer(parameters);
```

Same playback settings, callbacks, methods, and properties as `animate()`, but without targets or animatable properties. Use for scheduling callbacks, delays, and loops.

```js
createTimer({
  duration: 2000,
  loop: true,
  onUpdate: (timer) => {
    // timer.progress = 0-1
    console.log(timer.progress);
  },
});
```

---

## createDraggable()

```js
import { createDraggable } from 'animejs';
const drag = createDraggable(targets, parameters);
```

### Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `container` | selector/element | null | Bounding container |
| `containerPadding` | number/array | 0 | Padding inside container |
| `trigger` | selector/element | target | Element that starts the drag |
| `releaseEase` | string/spring | null | Easing for release momentum |
| `dragSpeed` | number | 1 | Drag sensitivity multiplier |
| `dragThreshold` | number | 0 | Min px before drag starts |
| `scrollThreshold` | number | 30 | Scroll detection threshold |
| `scrollSpeed` | number | 1.5 | Auto-scroll speed |
| `cursor` | object | auto | `{ onHover, onGrab }` cursor styles |

### Axes Parameters

| Parameter | Description |
|-----------|-------------|
| `x` | Horizontal constraint/config |
| `y` | Vertical constraint/config |
| `snap` | Grid snap `{ x: 50, y: 50 }` |
| `modifier` | Transform function for drag values |
| `mapTo` | Redirect drag to different properties |

### Physics Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `containerFriction` | number | Friction at container edges |
| `releaseContainerFriction` | number | Post-release edge friction |
| `releaseMass` | number | Mass for spring physics |
| `releaseStiffness` | number | Spring stiffness on release |
| `releaseDamping` | number | Spring damping on release |
| `velocityMultiplier` | number | Velocity scaling |
| `minVelocity` | number | Minimum velocity threshold |
| `maxVelocity` | number | Maximum velocity cap |

### Callbacks

| Callback | When |
|----------|------|
| `onGrab(d)` | Element grabbed |
| `onDrag(d)` | During drag movement |
| `onUpdate(d)` | Position update |
| `onRelease(d)` | Mouse/touch released |
| `onSnap(d)` | Snapped to position |
| `onSettle(d)` | Motion finished |
| `onResize(d)` | Container resized |
| `onAfterResize(d)` | Post-resize |

### Methods

| Method | Description |
|--------|-------------|
| `disable()` | Disable dragging |
| `enable()` | Re-enable dragging |
| `setX(value)` | Set X position programmatically |
| `setY(value)` | Set Y position |
| `stop()` | Stop current drag |
| `reset()` | Reset to initial position |
| `revert()` | Remove all draggable behavior |
| `refresh()` | Recalculate bounds |

---

## createAnimatable()

```js
import { createAnimatable } from 'animejs';
const anim = createAnimatable(targets, parameters);
```

Parameters object keys = property names, values = animation duration for that property:

```js
const a = createAnimatable('.box', {
  x: 300,         // x animates over 300ms
  y: 500,         // y animates over 500ms
  rotate: 200,    // rotate over 200ms
  ease: 'out(3)', // shared easing
});

// Set values (triggers smooth transition)
a.x(100);
a.y(-50);
a.rotate(45);

// Get current value
const currentX = a.x();
```

Only `Number` or `Array<Number>` can be passed to property functions.

---

## createScope()

```js
import { createScope } from 'animejs';
const scope = createScope(parameters);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `root` | element | Root element for scoped selectors |
| `defaults` | object | Default animation parameters |
| `mediaQueries` | object | Named media queries |

### Usage

```js
const scope = createScope({ root: containerEl })
  .add((self) => {
    // All CSS selectors scoped to root
    animate('.item', { opacity: [0, 1] });

    // Access media query matches
    const { isSmall } = self.matches;
  });

// Cleanup: reverts all animations created in scope
scope.revert();
```

### Media Queries

```js
createScope({
  mediaQueries: {
    isSmall: '(max-width: 640px)',
    reduceMotion: '(prefers-reduced-motion)',
  },
}).add((self) => {
  if (self.matches.reduceMotion) return;
  animate('.hero', { scale: [0.9, 1] });
});
```

### Methods

| Method | Description |
|--------|-------------|
| `add(fn)` | Register constructor function |
| `addOnce(fn)` | Register function that runs once |
| `revert()` | Revert all animations in scope |
| `refresh()` | Re-run constructors |

---

## createLayout()

```js
import { createLayout } from 'animejs';
const layout = createLayout(root, parameters);
```

Automatically animates CSS layout changes (display, flex, grid, DOM order).

### Methods

```js
// Record → modify → animate approach
layout.record();
element.classList.toggle('grid');
layout.animate(animParams);

// Shorthand with callback
layout.update(({ root }) => {
  root.dataset.layout = 'grid';
}, {
  duration: 800,
  delay: stagger(50),
  ease: 'outExpo',
});
```

| Method | Description |
|--------|-------------|
| `record()` | Snapshot current layout positions |
| `animate(params)` | Animate from recorded to current positions |
| `update(fn, params)` | Record, modify, animate in one call |
| `revert()` | Remove layout animation behavior |

---

## SVG Utilities

```js
import { svg } from 'animejs';
// or individually:
import { morphTo, createDrawable, createMotionPath } from 'animejs';
```

### morphTo(target, precision?)

Morph between SVG paths or polygons:

```js
animate('path#from', {
  d: svg.morphTo('path#to'),
  duration: 1000,
  ease: 'inOutQuad',
});

// With precision (higher = smoother, more points)
animate('path#a', {
  d: svg.morphTo('path#b', 100),
});

// Polygon morphing
animate('polygon#shape', {
  points: svg.morphTo('polygon#target'),
});
```

### createDrawable(target)

Line drawing animation:

```js
const drawable = svg.createDrawable('path.stroke');

animate(drawable, {
  draw: '0 1',        // draw from 0% to 100%
  duration: 2000,
  ease: 'inOutQuad',
});

// Partial draw
animate(drawable, { draw: '0.2 0.8' }); // draw middle 60%
```

### createMotionPath(pathSelector)

Animate elements along an SVG path:

```js
const path = svg.createMotionPath('path#curve');

animate('.element', {
  ...path,  // spreads translateX, translateY, rotate
  duration: 3000,
  ease: 'linear',
  loop: true,
});
```

Returns object with `translateX`, `translateY`, and `rotate` tween parameters.

---

## Text Utilities

```js
import { splitText } from 'animejs';
```

### splitText(target, parameters)

```js
const { chars, words, lines } = splitText('h1.title', {
  chars: true,       // split into characters
  words: true,       // split into words
  lines: true,       // split into lines
  includeSpaces: false,
  accessible: true,  // preserve screen reader text
  debug: false,
});

// Returns DOM element arrays
animate(chars, { opacity: [0, 1], delay: stagger(20) });
animate(words, { translateY: [20, 0], delay: stagger(50) });
```

### Split Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chars` | boolean | false | Split into character spans |
| `words` | boolean | true | Split into word spans |
| `lines` | boolean | false | Split into line wrappers |
| `includeSpaces` | boolean | false | Create elements for spaces |
| `accessible` | boolean | true | Keep original text for screen readers |
| `debug` | boolean | false | Visualize split elements |
| `class` | string | null | CSS class for split elements |
| `wrap` | string | null | HTML wrapper tag |

### Methods

| Method | Description |
|--------|-------------|
| `addEffect(fn)` | Apply animation effect to split |
| `revert()` | Restore original DOM text |
| `refresh()` | Re-split (after content changes) |

---

## Scroll Events

```js
import { onScroll } from 'animejs';
```

### onScroll(parameters)

Returns a `ScrollObserver` instance. Used with `autoplay`:

```js
animate('.el', {
  translateY: [50, 0],
  opacity: [0, 1],
  autoplay: onScroll({ target: '.el' }),
});
```

### Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `target` | selector/element | animation targets | Element to observe |
| `container` | selector/element | window | Scroll container |
| `axis` | string | 'y' | `'x'` or `'y'` |
| `debug` | boolean | false | Visual debug overlay |
| `repeat` | boolean | true | Re-trigger on re-enter |

### Threshold Parameters

Enter/leave positions for the observed element:

```js
onScroll({
  enter: 'bottom',           // viewport bottom edge
  leave: 'top',              // viewport top edge
  enter: '80%',              // 80% from top
  enter: 'bottom -=100px',   // 100px above bottom
})
```

### Sync Modes

```js
// Link animation progress to scroll position
onScroll({ sync: 'playback' })

// Smooth interpolated sync
onScroll({ sync: 'smooth' })

// Eased sync
onScroll({ sync: 'ease' })
```

### Callbacks

| Callback | When |
|----------|------|
| `onEnter(observer)` | Element enters threshold |
| `onEnterForward(observer)` | Enters scrolling down |
| `onEnterBackward(observer)` | Enters scrolling up |
| `onLeave(observer)` | Element leaves threshold |
| `onLeaveForward(observer)` | Leaves scrolling down |
| `onLeaveBackward(observer)` | Leaves scrolling up |
| `onUpdate(observer)` | Each scroll frame |
| `onSyncComplete(observer)` | Sync finished |
| `onResize(observer)` | Container resize |

### Methods

| Method | Description |
|--------|-------------|
| `link(animation)` | Link observer to animation |
| `refresh()` | Recalculate thresholds |
| `revert()` | Remove observer |

---

## WAAPI

Lightweight 3KB wrapper over native Web Animation API:

```js
import { waapi } from 'animejs';
const anim = waapi.animate(targets, parameters);
```

Same API shape as `animate()` but uses browser's native animation engine. Benefits: hardware-accelerated `transform` and `opacity`, smaller bundle. Limitations: no JS object animation, no modifier functions, limited easing control.

### Spring Easings in WAAPI

```js
import { waapi, spring } from 'animejs';

waapi.animate('.el', {
  translateX: 200,
  ease: spring({ bounce: 0.35 }),
  duration: 1000,
});
```

---

## Utilities & Helpers

```js
import { utils, stagger } from 'animejs';
```

### stagger(value, options?)

```js
stagger(100)                              // 0, 100, 200, 300...
stagger(100, { start: 500 })              // 500, 600, 700...
stagger(100, { from: 'center' })          // center outward
stagger(100, { from: 'last' })            // from last
stagger(100, { from: 'first' })           // from first (default)
stagger(100, { from: 5 })                 // from index 5
stagger(100, { reversed: true })          // reversed order
stagger([0, 500])                         // distribute range
stagger(100, { ease: 'inQuad' })          // eased stagger
stagger(100, { grid: [cols, rows] })      // 2D grid
stagger(100, { grid: [14, 5], from: 'center', axis: 'x' })
```

### DOM Utilities

```js
utils.$('.selector')              // querySelectorAll wrapper
utils.get(el, 'translateX')       // get computed/animated value
utils.set(el, { opacity: 0.5 })  // set without animation
utils.set('.items', { y: i => i * 20 })  // function-based set
utils.remove(target)              // remove from running animations
utils.cleanInlineStyles(el)       // remove anime-set inline styles
utils.sync(animation)             // sync to another animation
```

### Math Utilities

```js
utils.random(min, max)            // random float in range
utils.random(min, max, decimals)  // rounded random
utils.clamp(value, min, max)      // clamp to range
utils.snap(value, increment)      // snap to nearest increment
utils.wrap(value, min, max)       // wrap around range
utils.lerp(start, end, amount)    // linear interpolation
utils.damp(start, end, amount, dt) // damped interpolation
utils.mapRange(inLow, inHigh, outLow, outHigh, value)
utils.round(value, decimals)      // round to decimal places
utils.roundPad(value, decimals)   // round with zero padding
utils.degToRad(degrees)
utils.radToDeg(radians)
```

### Other

```js
utils.padStart(str, length, char)
utils.padEnd(str, length, char)
```

---

## Engine Configuration

```js
import { engine } from 'animejs';

engine.timeUnit = 'ms';              // 'ms' or 's'
engine.playbackRate = 1;             // global speed
engine.precision = 4;                // decimal precision
engine.pauseOnDocumentHidden = true; // pause when tab hidden
engine.useDefaultMainLoop = true;    // set false for custom loop

// Custom render loop (e.g., Three.js)
engine.useDefaultMainLoop = false;
function render() {
  engine.update();
  requestAnimationFrame(render);
}
render();
```
