---
description: Make a small-step implementation plan from a spec, then implement it step by step with verification
argument-hint: "<path to spec or short description>"
---

Plan the implementation of: **$ARGUMENTS** (read the spec file if a path is given).

1. Produce an ordered plan where the system still works after every step. For each step: files, change, how it is verified.
2. Mark the riskiest step and how to roll it back.
3. Then implement the steps in order. After each step run the relevant tests/build; if something fails, fix it before moving on.
4. At the end, walk through every acceptance criterion and mark it ✓ or ✗, and list anything not verified.

Keep context lean: read files in slices, delegate log/test-output digging to `test-runner` or `log-analyst` if available.
