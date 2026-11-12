---
name: git-workflow
description: "Clean git practice: small focused commits, conventional messages, safe branching, readable PRs. Use when committing, branching or preparing a PR."
---

# Git Workflow

History is documentation.

## Rules
- One logical change per commit; message `type(scope): imperative summary` + why.
- Never commit secrets, build output or huge binaries; check `git diff --staged` first.
- Rebase or merge per the repo's convention; never force-push shared branches.
- PR description: what, why, how to test, screenshots for UI.
