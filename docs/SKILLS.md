# Skill library

18 Claude Code skills — playbooks Claude loads automatically when the task matches their description.

```bash
cplus skills library          # browse
cplus skills add token-diet    # install one (~/.claude/skills)
cplus skills add all           # install everything
```

## backend

| Skill | When Claude uses it |
|---|---|
| [`api-design`](../library/skills/backend/api-design/SKILL.md) | Design consistent HTTP/GraphQL APIs: resources, naming, errors, pagination, idempotency, versioning, auth. Use before adding or changing endpoints. |
| [`safe-migrations`](../library/skills/backend/safe-migrations/SKILL.md) | Ship database schema and data migrations without downtime or data loss (expand → migrate → contract). Use for any schema change on a live system. |

## cost-saver

| Skill | When Claude uses it |
|---|---|
| [`token-diet`](../library/skills/cost-saver/token-diet/SKILL.md) | Work in a token-efficient way: read in slices, search before reading, delegate bulk reading to cheap subagents and compact on time. Use on every long or expensive session, or when the user mentions cost, limits or tokens. |

## design

| Skill | When Claude uses it |
|---|---|
| [`design-system`](../library/skills/design/design-system/SKILL.md) | Create or extend a design system: tokens (color, type, spacing, radius, shadow, motion), components with variants and states, and docs. Use when a project has inconsistent UI or is starting its UI layer. |
| [`human-grade-ui`](../library/skills/design/human-grade-ui/SKILL.md) | Design interfaces that look crafted by an experienced product designer, not generated. Use whenever building or restyling UI, landing pages, dashboards or marketing pages. |
| [`landing-page`](../library/skills/design/landing-page/SKILL.md) | Write and build a high-converting landing page: headline, proof, features, social proof, CTA, FAQ. Use for product pages, launches and open-source READMEs. |
| [`motion-design`](../library/skills/design/motion-design/SKILL.md) | Add tasteful, performant UI animation: entrances, state transitions, number counters, chart reveals, micro-interactions. Use when the user asks for "wow" effects or the UI feels static. |

## docs

| Skill | When Claude uses it |
|---|---|
| [`readme-that-sells`](../library/skills/docs/readme-that-sells/SKILL.md) | Write a README that makes people try the project in 60 seconds: pitch, screenshot, quick start, features, FAQ. Use before publishing or when the README is weak. |

## quality

| Skill | When Claude uses it |
|---|---|
| [`code-review`](../library/skills/quality/code-review/SKILL.md) | Review code changes for correctness, security, performance and maintainability with a severity-ranked report. Use before merging or when asked to review. |
| [`debugging-playbook`](../library/skills/quality/debugging-playbook/SKILL.md) | Systematic debugging: reproduce, bisect, form hypotheses, prove the root cause, fix, verify. Use for any bug whose cause is not obvious. |
| [`performance-profiling`](../library/skills/quality/performance-profiling/SKILL.md) | Measure-first performance work: baseline, profile, fix the top hotspot, re-measure. Use when something is slow or before scaling. |
| [`refactor-safely`](../library/skills/quality/refactor-safely/SKILL.md) | Behavior-preserving refactoring in small verified steps with characterization tests. Use when code works but is hard to change. |
| [`security-checklist`](../library/skills/quality/security-checklist/SKILL.md) | A practical security pass for web apps and APIs (OWASP-style). Use before releases or when touching auth, payments, file uploads or user input. |
| [`test-strategy`](../library/skills/quality/test-strategy/SKILL.md) | Decide what to test and how: unit vs integration vs e2e, fixtures, mocking boundaries, flaky-test hygiene. Use when adding tests to a codebase or when tests are slow or flaky. |

## workflow

| Skill | When Claude uses it |
|---|---|
| [`git-workflow`](../library/skills/workflow/git-workflow/SKILL.md) | Clean git practice: small focused commits, conventional messages, safe branching, readable PRs. Use when committing, branching or preparing a PR. |
| [`postmortem`](../library/skills/workflow/postmortem/SKILL.md) | Write a blameless incident postmortem: impact, timeline, root cause, contributing factors, action items. Use after outages or serious bugs. |
| [`release-checklist`](../library/skills/workflow/release-checklist/SKILL.md) | Prepare and ship a release safely: version, changelog, migrations, smoke tests, rollback plan, announcement. Use when cutting a version. |
| [`spec-driven-dev`](../library/skills/workflow/spec-driven-dev/SKILL.md) | Turn a feature request into SPEC → PLAN → IMPLEMENT → VERIFY with written artifacts. Use for any feature that touches more than two files or when requirements are fuzzy. |
