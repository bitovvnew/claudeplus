---
name: spec-driven-dev
description: "Turn a feature request into SPEC → PLAN → IMPLEMENT → VERIFY with written artifacts. Use for any feature that touches more than two files or when requirements are fuzzy."
---

# Spec Driven Dev

Code written against a clear spec needs fewer rewrites — the cheapest token is the one you never spend redoing work.

## 1 · Spec (docs/specs/<feature>.md)
- Problem, users, goals, explicit non-goals.
- Acceptance criteria as testable statements.
- Open questions — ask the user before building if any block the design.

## 2 · Plan
- Files to change and why, in order.
- Risks and how each is verified.
- Keep steps small enough that the system works after each one.

## 3 · Implement
- Follow the plan; update it when reality differs.
- Write or update tests alongside the code.

## 4 · Verify
- Run tests/build; walk through every acceptance criterion and mark it ✓ or ✗.
- Report what is not verified.
