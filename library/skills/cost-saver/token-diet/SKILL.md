---
name: token-diet
description: "Work in a token-efficient way: read in slices, search before reading, delegate bulk reading to cheap subagents and compact on time. Use on every long or expensive session, or when the user mentions cost, limits or tokens."
---

# Token Diet

Every token in context is paid for again on every turn. Keep the context small and the expensive model focused on decisions.

## Reading
- Grep or Glob first; Read only the lines you need with offset/limit.
- Never re-read a file you already have unless it changed.
- Prefer `git diff --stat` / `| head -50` over full dumps of logs, lockfiles or diffs.

## Delegation
- Send broad searches, log digging and doc lookups to a Haiku subagent (scout, cheap-researcher, log-analyst) and keep only its summary.
- Never give a read-only subagent an Opus/Fable model.

## Context hygiene
- Around 150k tokens of context, suggest /compact.
- Before a long break, write a HANDOFF.md (context-keeper) and /clear — a cold cache after 5 min/1 h re-bills the whole context.
- One task per session; start unrelated work in a new session.

## Effort
- Routine edits → low/medium effort. Save high effort for design, debugging and hard reasoning.
