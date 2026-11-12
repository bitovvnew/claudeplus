---
description: Turn an idea into a written spec (docs/specs/<name>.md) before any code is written
argument-hint: "<what you want to build>"
---

Write a product/engineering spec for: **$ARGUMENTS**

1. Explore only what you need (Grep/Glob first; delegate wide searches to a cheap subagent such as `scout` if it exists).
2. Create `docs/specs/<kebab-name>.md` with these sections:
   - **Problem** — who has it and why it matters (3–5 lines)
   - **Goals** and **Non-goals**
   - **User flow** — numbered steps
   - **Acceptance criteria** — testable statements, each starting with "Given/When/Then" or a checkbox
   - **Technical approach** — files/modules touched, data changes, risks
   - **Open questions**
3. Do not write implementation code. End by listing the open questions that block implementation, if any.
