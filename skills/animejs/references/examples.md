# Anime.js v4 Animation Recipes

Practical patterns for common animation tasks.

## Table of Contents

1. [Fade & Slide In](#fade--slide-in)
2. [Staggered List Entrance](#staggered-list-entrance)
3. [Card Hover Effect](#card-hover-effect)
4. [Loading Spinner](#loading-spinner)
5. [Scroll-Reveal Sections](#scroll-reveal-sections)
6. [Scroll-Linked Progress Bar](#scroll-linked-progress-bar)
7. [Text Character Reveal](#text-character-reveal)
8. [Typewriter Effect](#typewriter-effect)
9. [SVG Line Drawing](#svg-line-drawing)
10. [SVG Morphing](#svg-morphing)
11. [Motion Path](#motion-path)
12. [Draggable Card Stack](#draggable-card-stack)
13. [Spring Button Press](#spring-button-press)
14. [Timeline: Page Load Sequence](#timeline-page-load-sequence)
15. [Mouse-Following Element](#mouse-following-element)
16. [Infinite Marquee](#infinite-marquee)
17. [Counter / Number Animation](#counter--number-animation)
18. [Grid Layout Toggle](#grid-layout-toggle)
19. [Particles / Fireworks](#particles--fireworks)
20. [React Component Animation](#react-component-animation)

---

## Fade & Slide In

```js
import { animate } from 'animejs';

animate('.fade-in', {
  opacity: [0, 1],
  translateY: [30, 0],
  duration: 800,
  ease: 'outExpo',
});
```

Slide from left:
```js
animate('.slide-left', {
  opacity: [0, 1],
  translateX: [-50, 0],
  duration: 600,
  ease: 'outQuart',
});
```

---

## Staggered List Entrance

```js
import { animate, stagger } from 'animejs';

animate('.list-item', {
  opacity: [0, 1],
  translateY: [20, 0],
  delay: stagger(80),
  duration: 500,
  ease: 'outExpo',
});
```

From center outward:
```js
animate('.grid-item', {
  scale: [0, 1],
  opacity: [0, 1],
  delay: stagger(50, { grid: [4, 4], from: 'center' }),
  duration: 600,
  ease: 'outElastic',
});
```

---

## Card Hover Effect

```js
import { createAnimatable, createSpring } from 'animejs';

document.querySelectorAll('.card').forEach(card => {
  const a = createAnimatable(card, {
    scale: 300,
    translateY: 300,
    ease: createSpring({ stiffness: 200, damping: 15 }),
  });

  card.addEventListener('mouseenter', () => {
    a.scale(1.05);
    a.translateY(-5);
  });

  card.addEventListener('mouseleave', () => {
    a.scale(1);
    a.translateY(0);
  });
});
```

---

## Loading Spinner

```js
import { animate, stagger } from 'animejs';

animate('.dot', {
  scale: [1, 1.4, 1],
  opacity: [1, 0.5, 1],
  delay: stagger(150),
  duration: 800,
  loop: true,
  ease: 'inOutSine',
});
```

Rotating spinner:
```js
animate('.spinner', {
  rotate: '1turn',
  duration: 1000,
  loop: true,
  ease: 'linear',
});
```

---

## Scroll-Reveal Sections

```js
import { animate, stagger, onScroll } from 'animejs';

animate('.section', {
  opacity: [0, 1],
  translateY: [60, 0],
  duration: 800,
  delay: stagger(100),
  ease: 'outExpo',
  autoplay: onScroll({
    target: '.section',
    enter: 'bottom -=100px',
    repeat: false,         // only once
  }),
});
```

---

## Scroll-Linked Progress Bar

```js
import { animate, onScroll } from 'animejs';

animate('.progress-bar', {
  scaleX: [0, 1],
  duration: 1000,
  ease: 'linear',
  autoplay: onScroll({
    container: window,
    sync: 'playback',   // progress = scroll %
  }),
});
```

CSS for progress bar:
```css
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: #6366f1;
  transform-origin: left;
}
```

---

## Text Character Reveal

```js
import { animate, splitText, stagger } from 'animejs';

const { chars } = splitText('.hero-title', { chars: true });

animate(chars, {
  opacity: [0, 1],
  translateY: ['1em', 0],
  delay: stagger(25),
  duration: 600,
  ease: 'outExpo',
});
```

Word-by-word:
```js
const { words } = splitText('.subtitle', { words: true });

animate(words, {
  opacity: [0, 1],
  translateX: [-20, 0],
  delay: stagger(80),
  duration: 500,
  ease: 'outQuart',
});
```

---

## Typewriter Effect

```js
import { animate, splitText } from 'animejs';

const { chars } = splitText('.typewriter', { chars: true });

// Hide all characters initially
chars.forEach(c => c.style.opacity = '0');

animate(chars, {
  opacity: [0, 1],
  delay: (el, i) => i * 50,
  duration: 1,      // instant reveal
  ease: 'linear',
});
```

With blinking cursor:
```js
animate('.cursor', {
  opacity: [1, 0],
  duration: 500,
  loop: true,
  alternate: true,
  ease: 'steps(1)',
});
```

---

## SVG Line Drawing

```js
import { animate, svg } from 'animejs';

const drawable = svg.createDrawable('path.icon-stroke');

animate(drawable, {
  draw: '0 1',
  duration: 2000,
  ease: 'inOutQuart',
});
```

Sequential multi-path drawing:
```js
import { createTimeline, svg } from 'animejs';

const paths = document.querySelectorAll('svg path');
const tl = createTimeline({ defaults: { duration: 800, ease: 'inOutQuad' } });

paths.forEach((path, i) => {
  const d = svg.createDrawable(path);
  tl.add(d, { draw: '0 1' }, i * 400);
});
```

---

## SVG Morphing

```js
import { animate, svg } from 'animejs';

animate('path#shape-a', {
  d: svg.morphTo('path#shape-b'),
  duration: 1200,
  ease: 'inOutQuad',
  loop: true,
  alternate: true,
});
```

---

## Motion Path

```js
import { animate, svg } from 'animejs';

const motionPath = svg.createMotionPath('path#track');

animate('.traveler', {
  ...motionPath,
  duration: 4000,
  ease: 'linear',
  loop: true,
});
```

HTML setup:
```html
<svg viewBox="0 0 400 200" class="absolute">
  <path id="track" d="M10,100 C100,0 300,200 390,100" fill="none" />
</svg>
<div class="traveler">🚀</div>
```

---

## Draggable Card Stack

```js
import { createDraggable, createSpring } from 'animejs';

createDraggable('.card', {
  container: '.deck',
  releaseEase: createSpring({ stiffness: 120, damping: 14 }),
  snap: { x: 0, y: 0 },  // snap back to origin
  cursor: { onHover: 'grab', onGrab: 'grabbing' },
  onRelease: (d) => {
    // Detect swipe velocity for card discard
    if (Math.abs(d.velocityX) > 500) {
      // Handle swipe away
    }
  },
});
```

---

## Spring Button Press

```js
import { animate, createSpring } from 'animejs';

document.querySelector('.btn').addEventListener('mousedown', (e) => {
  animate(e.currentTarget, {
    scale: 0.95,
    duration: 100,
    ease: 'inQuad',
  });
});

document.querySelector('.btn').addEventListener('mouseup', (e) => {
  animate(e.currentTarget, {
    scale: 1,
    ease: createSpring({ stiffness: 300, damping: 10 }),
  });
});
```

---

## Timeline: Page Load Sequence

```js
import { createTimeline, stagger, splitText } from 'animejs';

const { words } = splitText('.hero h1', { words: true });

const tl = createTimeline({
  defaults: { ease: 'outExpo', duration: 800 },
});

tl.add('.hero-bg', {
    scaleY: [0, 1],
    transformOrigin: 'bottom',
  })
  .add(words, {
    opacity: [0, 1],
    translateY: ['1.5em', 0],
    delay: stagger(40),
  }, '-=400')
  .add('.hero-subtitle', {
    opacity: [0, 1],
    translateX: [-30, 0],
  }, '-=600')
  .add('.cta-button', {
    scale: [0, 1],
    opacity: [0, 1],
    ease: 'outBack',
  }, '-=400')
  .add('.nav-item', {
    opacity: [0, 1],
    translateY: [-10, 0],
    delay: stagger(50),
  }, '-=600');
```

---

## Mouse-Following Element

```js
import { createAnimatable, utils } from 'animejs';

const follower = createAnimatable('.cursor-follower', {
  x: 600,
  y: 600,
  scale: 200,
  ease: 'out(3)',
});

document.addEventListener('mousemove', (e) => {
  follower.x(e.clientX - 20);
  follower.y(e.clientY - 20);
});

// Scale up on interactive elements
document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => follower.scale(2));
  el.addEventListener('mouseleave', () => follower.scale(1));
});
```

---

## Infinite Marquee

```js
import { animate } from 'animejs';

animate('.marquee-track', {
  translateX: [0, '-50%'],
  duration: 20000,
  ease: 'linear',
  loop: true,
});
```

HTML (duplicate content for seamless loop):
```html
<div class="marquee overflow-hidden">
  <div class="marquee-track flex whitespace-nowrap">
    <span>Content here &nbsp;</span>
    <span>Content here &nbsp;</span> <!-- duplicate -->
  </div>
</div>
```

---

## Counter / Number Animation

```js
import { animate } from 'animejs';

const counter = { value: 0 };

animate(counter, {
  value: 9876,
  duration: 2000,
  ease: 'outExpo',
  modifier: (v) => Math.round(v),
  onUpdate: () => {
    document.querySelector('.counter').textContent =
      counter.value.toLocaleString();
  },
});
```

---

## Grid Layout Toggle

```js
import { createLayout, stagger } from 'animejs';

const layout = createLayout('.product-grid');

document.querySelector('.toggle-layout').addEventListener('click', () => {
  layout.update(({ root }) => {
    root.classList.toggle('list-view');
  }, {
    duration: 600,
    delay: stagger(30),
    ease: 'outExpo',
  });
});
```

---

## Particles / Fireworks

```js
import { animate, utils, stagger } from 'animejs';

function firework(x, y) {
  const particles = 20;
  const container = document.querySelector('.particles');

  for (let i = 0; i < particles; i++) {
    const dot = document.createElement('div');
    dot.className = 'particle';
    dot.style.cssText = `left:${x}px;top:${y}px;position:absolute;`;
    container.appendChild(dot);
  }

  const dots = container.querySelectorAll('.particle');

  animate(dots, {
    translateX: () => utils.random(-150, 150),
    translateY: () => utils.random(-150, 150),
    scale: [{ from: 1, to: 0 }],
    opacity: [1, 0],
    duration: () => utils.random(600, 1200),
    ease: 'outExpo',
    onComplete: () => dots.forEach(d => d.remove()),
  });
}
```

---

## React Component Animation

```jsx
import { useRef, useEffect } from 'react';
import { createScope, animate, stagger, createSpring } from 'animejs';

function AnimatedCard({ isVisible, items }) {
  const containerRef = useRef(null);
  const scopeRef = useRef(null);

  useEffect(() => {
    scopeRef.current = createScope({ root: containerRef.current });
    return () => scopeRef.current?.revert();
  }, []);

  useEffect(() => {
    if (!scopeRef.current) return;

    scopeRef.current.revert();
    scopeRef.current.add(() => {
      if (isVisible) {
        animate('.card-item', {
          opacity: [0, 1],
          translateY: [30, 0],
          delay: stagger(60),
          duration: 600,
          ease: 'outExpo',
        });
      } else {
        animate('.card-item', {
          opacity: [1, 0],
          translateY: [0, -20],
          delay: stagger(30),
          duration: 300,
          ease: 'inQuad',
        });
      }
    });
  }, [isVisible]);

  return (
    <div ref={containerRef}>
      {items.map(item => (
        <div key={item.id} className="card-item">
          {item.content}
        </div>
      ))}
    </div>
  );
}
```

### React Hook Pattern

```jsx
function useAnime(rootRef) {
  const scope = useRef(null);

  useEffect(() => {
    if (rootRef.current) {
      scope.current = createScope({ root: rootRef.current });
    }
    return () => scope.current?.revert();
  }, [rootRef]);

  return {
    add: (fn) => scope.current?.add(fn),
    revert: () => scope.current?.revert(),
  };
}

// Usage
function MyComponent() {
  const ref = useRef(null);
  const { add } = useAnime(ref);

  useEffect(() => {
    add(() => {
      animate('.item', { opacity: [0, 1], delay: stagger(50) });
    });
  }, []);

  return <div ref={ref}>...</div>;
}
```
