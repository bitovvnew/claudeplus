---
name: refactor-safely
description: "Behavior-preserving refactoring in small verified steps with characterization tests. Use when code works but is hard to change."
---

# Refactor Safely

Never refactor and change behavior in the same step.

## Steps
- Pin current behavior with characterization tests if coverage is weak.
- Find all callers before moving or renaming.
- Small steps, each followed by build + tests; commit after each green step.
- Stop when the code is easy to change for the task at hand — not perfect.
