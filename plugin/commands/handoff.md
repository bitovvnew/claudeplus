---
description: Save the current task to HANDOFF.md so you can /clear and resume cheaply later
---

Write `HANDOFF.md` in the project root (overwrite if it exists), max ~60 lines:

- **Goal** — one sentence
- **Done so far** — bullets with file paths
- **Decisions** — and why (so they are not re-litigated)
- **Next steps** — exact, ordered, small
- **Gotchas** — things that cost time
- **How to verify** — commands

Then tell the user: "Saved. Run /clear, and in the new session say: continue from HANDOFF.md". Long idle sessions re-cache the whole context; a handoff + /clear is usually much cheaper.
