---
name: motion-design
description: "Add tasteful, performant UI animation: entrances, state transitions, number counters, chart reveals, micro-interactions. Use when the user asks for \"wow\" effects or the UI feels static."
---

# Motion Design

Good motion explains change; bad motion decorates it.

## Principles
- Animate opacity and transform only (GPU-friendly); avoid animating layout properties.
- Durations 120–400 ms; ease-out for entrances, ease-in-out for moves; stagger lists by 30–50 ms.
- Every animation must survive prefers-reduced-motion (disable or shorten).

## Patterns
- Count-up numbers on load, bars that grow from the baseline, lines that draw in (stroke-dashoffset), skeleton shimmer while loading.
- A sliding indicator for tabs; subtle lift on hover for cards.
- Command palette and toasts that fade + rise 4–8 px.

## Don't
- Replay heavy animations on background refreshes; loop decorative animations; animate on scroll for no reason.
