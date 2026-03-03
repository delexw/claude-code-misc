---
name: animejs
description: "Write correct anime.js v4 animations with the right imports, API patterns, easing, timelines, and advanced features. Use this skill whenever the user asks to animate DOM elements, create CSS/SVG animations, build scroll-linked effects, add drag interactions, choreograph timeline sequences, or write any JavaScript animation code — even if they don't mention 'anime.js' by name. Also triggers when the user mentions 'animejs', 'anime.js', 'createTimeline', 'createDraggable', 'stagger', 'spring easing', or imports from the 'animejs' package. If the user wants smooth, performant web animations and isn't already using GSAP or Framer Motion, this skill applies."
---

# Anime.js v4 Animation Skill

Anime.js v4 is a modular JavaScript animation engine (10KB full / 3KB WAAPI-only). This skill ensures you write correct v4 syntax — the API changed significantly from v3.

## Installation

```bash
npm install animejs
```

CDN (ESM):
```html
<script type="module">
  import { animate } from 'https://cdn.jsdelivr.net/npm/animejs/+esm';
</script>
```

## Core Concept: Named Imports

v4 uses named exports, not a default `anime` object. Import only what you need:

```js
import { animate, stagger, createTimeline, utils } from 'animejs';
```

Subpath imports for smaller bundles:
```js
import { animate } from 'animejs/animation';
import { createTimeline } from 'animejs/timeline';
import { createDraggable } from 'animejs/draggable';
import { onScroll } from 'animejs/events';
import { stagger, utils } from 'animejs/utils';
import { waapi } from 'animejs/waapi';
```

## Quick Reference: `animate()`

```js
animate(targets, parameters);
```

**Targets**: CSS selectors, DOM elements, NodeLists, JS objects, or arrays of these.

**Parameters** combine animatable properties + playback settings + callbacks:

```js
animate('.box', {
  translateX: 250,           // CSS transform
  opacity: [0, 1],           // [from, to]
  scale: { from: 0.5, to: 1 },
  backgroundColor: '#FF0000', // color animation
  duration: 800,
  delay: stagger(100),       // stagger per element
  ease: 'outExpo',           // easing function
  loop: 2,                   // repeat 2 times (3 total plays)
  alternate: true,           // ping-pong
  onComplete: () => console.log('done'),
});
```

### Animatable Properties

| Category | Examples |
|----------|---------|
| CSS | `opacity`, `width`, `height`, `backgroundColor`, `borderRadius` |
| Transforms | `translateX`, `translateY`, `rotate`, `scale`, `skewX` |
| CSS Variables | `'--my-var': 100` |
| SVG Attributes | `cx`, `r`, `points`, `d` (via morphTo) |
| HTML Attributes | `value`, `data-count` |
| JS Object Props | Any numeric property on a plain object |

### Value Formats

```js
translateX: 250,              // unitless (px for transforms)
translateX: '10rem',          // with unit
translateX: '+=100',          // relative (add 100)
translateX: '-=50px',         // relative subtract
opacity: [0, 1],             // [from, to] shorthand
scale: { from: 0.5, to: 1.5 },  // explicit from/to
rotate: '1turn',             // CSS units work
```

### Function-Based Values

```js
animate('.item', {
  translateX: (el, i, total) => i * 50, // per-element
  delay: (el, i) => i * 100,
});
```

### Keyframes (Per-Property)

```js
animate('.ball', {
  y: [
    { to: '-2.75rem', ease: 'outExpo', duration: 600 },
    { to: 0, ease: 'outBounce', duration: 800, delay: 100 },
  ],
});
```

## Playback Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `duration` | 1000 | ms |
| `delay` | 0 | ms before start |
| `loop` | 0 | repetitions (0 = play once, `true` = infinite) |
| `loopDelay` | 0 | ms between loops |
| `alternate` | false | reverse on each loop |
| `reversed` | false | play backward |
| `autoplay` | true | start immediately |
| `playbackRate` | 1 | speed multiplier |
| `frameRate` | null | cap FPS |

## Callbacks

```js
animate(el, {
  translateX: 200,
  onBegin: (anim) => {},     // after delay, when animation starts
  onUpdate: (anim) => {},    // every frame
  onRender: (anim) => {},    // when properties are applied to DOM
  onLoop: (anim) => {},      // at each loop boundary
  onPause: (anim) => {},     // when paused
  onComplete: (anim) => {},  // when fully done
});

// Promise-based
animate(el, { x: 100 }).then(() => console.log('done'));
```

## Playback Methods

```js
const anim = animate(el, { x: 200 });
anim.play();       // play forward
anim.pause();
anim.resume();     // continue current direction
anim.reverse();    // play backward
anim.restart();
anim.seek(500);    // jump to 500ms
anim.complete();   // skip to end
anim.cancel();     // stop and reset
anim.revert();     // remove all changes
```

## Easing

v4 uses `ease` (not `easing`). Names are shortened (no `ease` prefix):

```js
ease: 'outQuad'       // was easeOutQuad in v3
ease: 'inOutExpo'     // was easeInOutExpo
ease: 'linear'
ease: 'out(3)'        // parametric: power of 3
ease: 'inOut(2)'      // parametric in-out
```

**All built-in easings**: `linear`, `in`, `out`, `inOut`, `outIn`, `inQuad`, `outQuad`, `inOutQuad`, `inCubic`, `outCubic`, `inOutCubic`, `inQuart`, `outQuart`, `inOutQuart`, `inQuint`, `outQuint`, `inOutQuint`, `inSine`, `outSine`, `inOutSine`, `inCirc`, `outCirc`, `inOutCirc`, `inExpo`, `outExpo`, `inOutExpo`, `inBounce`, `outBounce`, `inOutBounce`, `inBack`, `outBack`, `inOutBack`, `inElastic`, `outElastic`, `inOutElastic`.

### Cubic Bezier

```js
import { cubicBezier } from 'animejs';
ease: cubicBezier(0.7, 0.1, 0.5, 0.9)
```

### Spring Physics

```js
import { createSpring } from 'animejs';
ease: createSpring({ mass: 1, stiffness: 100, damping: 10, velocity: 0 })
```

Presets: `spring()` (default), `spring({ stiffness: 200, damping: 8 })` (snappy), `spring({ stiffness: 80, damping: 5 })` (bouncy).

### Steps

```js
ease: 'steps(5)'  // 5 discrete steps
```

### Custom Easing Function

```js
ease: t => 1 - Math.sqrt(1 - t * t)  // direct function, no wrapper
```

## Stagger

```js
import { stagger } from 'animejs';

delay: stagger(100)                        // 0, 100, 200, 300...
delay: stagger(100, { start: 500 })        // 500, 600, 700...
delay: stagger(100, { from: 'center' })    // from center outward
delay: stagger(100, { from: 'last' })      // from last element
delay: stagger(100, { reversed: true })    // reverse order
delay: stagger([0, 200])                   // distribute 0-200 across elements
delay: stagger(100, { grid: [14, 5] })     // 2D grid stagger
delay: stagger(100, { grid: [14, 5], from: 'center', ease: 'inQuad' })
```

## Timeline

```js
import { createTimeline } from 'animejs';

const tl = createTimeline({
  defaults: { duration: 600, ease: 'outExpo' },
  loop: true,
  alternate: true,
});

tl.add('.box-1', { translateX: 250 })           // starts at 0
  .add('.box-2', { translateX: 250 }, 200)       // starts at 200ms
  .add('.box-3', { translateX: 250 }, '+=100')   // 100ms after previous ends
  .add('.box-4', { translateX: 250 }, '-=300')   // 300ms before previous ends
  .add('.box-5', { translateX: 250 }, '<')        // same start as previous
  .add('.box-6', { translateX: 250 }, '<+=200');  // 200ms after previous starts
```

### Labels

```js
tl.label('intro')
  .add('.title', { opacity: [0, 1] })
  .label('content', '+=500')
  .add('.body', { opacity: [0, 1] }, 'content');
```

### Timeline Callbacks

```js
tl.call(() => console.log('midpoint'), 1500);  // at 1500ms
```

## Scroll-Linked Animations

```js
import { animate, onScroll } from 'animejs';

// Trigger on scroll into view
animate('.card', {
  opacity: [0, 1],
  translateY: [50, 0],
  autoplay: onScroll({
    target: '.card',     // element to observe
    enter: 'bottom',     // trigger when entering viewport bottom
    leave: 'top',        // stop when leaving viewport top
  }),
});

// Sync animation progress to scroll position
animate('.progress-bar', {
  scaleX: [0, 1],
  autoplay: onScroll({
    target: '.section',
    sync: 'playback',     // link progress to scroll %
  }),
});
```

## SVG Utilities

```js
import { animate, svg } from 'animejs';

// Line drawing
const drawable = svg.createDrawable('path.line');
animate(drawable, { draw: '0 1', duration: 1500 });

// SVG morphing
animate('path#shape', {
  d: svg.morphTo('path#target-shape'),
  duration: 1000,
});

// Motion path
const path = svg.createMotionPath('path#track');
animate('.mover', {
  ...path,   // spreads translateX, translateY, rotate
  duration: 2000,
});
```

## Draggable

```js
import { createDraggable } from 'animejs';

const drag = createDraggable('.card', {
  container: '.bounds',
  releaseEase: createSpring({ stiffness: 100, damping: 15 }),
  cursor: { onHover: 'grab', onGrab: 'grabbing' },
  snap: { x: 50, y: 50 },
  onDrag: (draggable) => {},
  onRelease: (draggable) => {},
  onSettle: (draggable) => {},
});
```

## Animatable (High-Frequency Updates)

For values that change every frame (mouse tracking, game loops), use `createAnimatable` instead of calling `animate()` repeatedly:

```js
import { createAnimatable, utils } from 'animejs';

const box = createAnimatable('.box', {
  x: 500,   // duration for x transitions
  y: 500,
  ease: 'out(3)',
});

window.addEventListener('mousemove', (e) => {
  box.x(utils.clamp(e.clientX - cx, -limit, limit));
  box.y(utils.clamp(e.clientY - cy, -limit, limit));
});
```

## Text Animation

```js
import { animate, splitText, stagger } from 'animejs';

const { chars, words, lines } = splitText('h1', {
  chars: true,
  words: true,
  lines: true,
});

animate(chars, {
  opacity: [0, 1],
  translateY: ['1em', 0],
  delay: stagger(30),
  ease: 'outExpo',
});
```

## Layout Animations

```js
import { createLayout, stagger } from 'animejs';

const layout = createLayout('.grid-container');

layout.update(({ root }) => {
  root.classList.toggle('column-layout');
}, {
  duration: 800,
  delay: stagger(50),
  ease: 'outExpo',
});
```

## WAAPI (Lightweight 3KB Alternative)

For simpler animations that don't need JS engine features, use the WAAPI wrapper for hardware-accelerated performance:

```js
import { waapi, stagger, splitText } from 'animejs';

waapi.animate('.box', {
  translate: '0 -2rem',
  opacity: [0, 1],
  delay: stagger(100),
  duration: 600,
  ease: 'inOut(2)',
});
```

## Utilities

```js
import { utils } from 'animejs';

utils.get(el, 'translateX');        // get current value
utils.set(el, { opacity: 0.5 });   // set without animation
utils.remove(el);                   // remove from running animations
utils.random(50, 100);             // random number in range
utils.clamp(val, min, max);
utils.lerp(start, end, amount);
utils.mapRange(inLow, inHigh, outLow, outHigh, val);
utils.snap(val, increment);
utils.round(val, decimals);
utils.wrap(val, min, max);
```

## React Integration

```jsx
import { useRef, useEffect } from 'react';
import { createScope, animate, stagger } from 'animejs';

function AnimatedList({ items }) {
  const root = useRef(null);
  const scope = useRef(null);

  useEffect(() => {
    scope.current = createScope({ root: root.current })
      .add(() => {
        animate('.item', {
          opacity: [0, 1],
          translateY: [20, 0],
          delay: stagger(50),
          ease: 'outExpo',
        });
      });
    return () => scope.current.revert();
  }, []);

  return (
    <ul ref={root}>
      {items.map(item => <li key={item.id} className="item">{item.name}</li>)}
    </ul>
  );
}
```

`createScope` scopes CSS selectors to the root element and provides batch `revert()` on cleanup — essential for React's strict mode and unmount lifecycle.

## Animation Composition

v4 handles overlapping animations on the same property:

```js
// Default: 'replace' — new animation cuts the old one
animate(el, { x: 100 });
animate(el, { x: 200 }); // first is replaced

// Additive: values stack
animate(el, { x: 100, composition: 'add' });
animate(el, { x: 50, composition: 'add' }); // total: 150

// None: v3 behavior, animations overlap
animate(el, { x: 100, composition: 'none' });
```

## Common Pitfalls

1. **`ease` not `easing`** — v4 renamed it
2. **`loop: 1` means repeat once** (2 total plays), not "play once" like v3
3. **No default `anime` object** — use named imports
4. **`direction` is gone** — use `alternate: true` and `reversed: true`
5. **Easing names dropped `ease` prefix** — `outQuad` not `easeOutQuad`
6. **Spring syntax changed** — use `createSpring({...})` not `'spring(1,80,10,0)'`
7. **SVG helpers moved** — `svg.createMotionPath()` not `anime.path()`
8. **`onRender` replaces `change`**, `onLoop` replaces `loopBegin`/`loopComplete`
9. **`play()` always goes forward** — use `resume()` to continue previous direction

## Reference Files

For detailed API signatures and parameters, read `references/api-reference.md`.
For common animation recipes and patterns, read `references/examples.md`.
