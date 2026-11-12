---
description: Severity-ranked review of the current changes (bugs, security, performance, missing tests)
allowed-tools: Bash(git diff:*), Bash(git status:*), Read, Grep, Glob
---

!`git status --short && git diff --stat`

Review the current changes (staged and unstaged). Read only the changed hunks and the code needed to verify suspicions.

Report a ranked list — most severe first. For each finding: `path:line`, the defect in one sentence, a concrete failing scenario, and the minimal fix. Only report issues you verified. If nothing blocks shipping, say so and list at most three optional improvements.
