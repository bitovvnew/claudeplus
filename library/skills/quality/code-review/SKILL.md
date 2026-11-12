---
name: code-review
description: "Review code changes for correctness, security, performance and maintainability with a severity-ranked report. Use before merging or when asked to review."
---

# Code Review

Find what will break in production; skip taste.

## Checklist
- Logic errors and unhandled edge cases (empty, null, huge, concurrent, unicode, time zones).
- Security: injection, authz gaps, secrets, unsafe deserialization, SSRF, path traversal.
- Performance: N+1, unbounded loops/queries, sync I/O on hot paths.
- API/contract changes that break callers; missing migrations; missing tests for new behavior.

## Report
- Ranked list: severity, `path:line`, failing scenario, minimal fix.
- If nothing blocks: say so and list at most three optional improvements.
