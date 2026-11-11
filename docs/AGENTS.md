# Agent library

62 ready-made Claude Code subagents in 10 categories, plus 10 packs.

Models are picked for cost: 🟢 **haiku** for reading, searching and mechanical work, 🔵 **sonnet** for everyday engineering, 🟠 **opus** for design and planning.

```bash
cplus agents library            # browse
cplus agents add scout           # one agent
cplus agents pack cost-saver     # a whole pack
```

## Packs

| Pack | Agents | What it is for |
|---|---|---|
| `essentials` | 6 | The core crew every project wants: cheap scout, reviewer, debugger, test runner, planner. |
| `cost-saver` | 7 | Cheap Haiku agents that keep expensive context clean: research, bulk edits, diff and log summaries, handoffs. |
| `frontend` | 9 | React/Next/Vue/Svelte experts, CSS and Tailwind fixers, a UI designer and an accessibility auditor. |
| `backend` | 9 | API design, Node/Python/Go/Rust specialists, databases, SQL tuning, GraphQL and auth. |
| `devops` | 7 | Docker, Kubernetes, CI, Terraform, releases, logs and incident response. |
| `quality` | 8 | Tests, e2e, security, performance, dependencies, lint and type errors. |
| `data-ai` | 5 | Analysis, ML engineering, prompt engineering, LLM features and notebook cleanup. |
| `docs` | 6 | READMEs, API docs, changelogs, commit messages and translations. |
| `mobile` | 4 | React Native, Flutter, Swift and Kotlin specialists. |
| `product` | 4 | Specs, UX copy, SEO and migration planning. |

## core

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `code-reviewer` | 🔵 sonnet | Read, Grep, Glob, Bash | Reviews a diff or set of files for real bugs, security problems and risky changes. Use after finishing a feature or before committing. |
| `debugger` | 🔵 sonnet | Read, Grep, Glob, Bash, Edit | Root-cause specialist for errors, crashes, failing tests and "it doesn't work" reports. Use when the cause of a bug is not obvious after a first look. |
| `planner` | 🟠 opus | Read, Grep, Glob | Turns a vague or large request into a concrete, ordered implementation plan with file-level steps and risks. Use before starting multi-file features or migrations. |
| `refactorer` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Performs behavior-preserving refactors (extract/rename/split modules, remove duplication, simplify control flow). Use when code works but is hard to change. |
| `scout` | 🟢 haiku | Read, Grep, Glob | Fast, cheap codebase explorer. Use PROACTIVELY whenever you need to find where something is defined or used, map an unfamiliar area, or answer "where/how is X done" across many files — instead of reading many files in the main conversation. |
| `test-runner` | 🟢 haiku | Read, Grep, Glob, Bash | Runs the project's tests/linters/type-checks and reports only the failures with their root cause. Use after code changes so test output never floods the main context. |

## cost-saver

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `bulk-editor` | 🟢 haiku | Read, Grep, Glob, Edit, Write, Bash | Applies the same mechanical change across many files (renames, import updates, API migrations) on a cheap model. Use for repetitive edits. |
| `cheap-researcher` | 🟢 haiku | Read, Grep, Glob, WebSearch, WebFetch | Low-cost web researcher for docs, changelogs, error messages and API references. Use PROACTIVELY instead of browsing in the main (expensive) conversation. |
| `context-keeper` | 🟢 haiku | Read, Grep, Glob, Write | Writes a compact HANDOFF.md of the current task (goal, decisions, files, next steps) so you can /clear and resume cheaply. Use before long breaks or when context is huge. |
| `diff-summarizer` | 🟢 haiku | Read, Grep, Glob, Bash | Summarizes large diffs, PRs or branches into a short overview so the main conversation does not have to read them. Use before reviewing big changes. |
| `repo-mapper` | 🟢 haiku | Read, Grep, Glob | Builds a compact map of an unfamiliar repository (structure, entry points, key modules, conventions) and saves it for reuse. Use at the start of work in a new codebase. |

## quality

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `accessibility-auditor` | 🔵 sonnet | Read, Grep, Glob | Audits UI code for accessibility problems (WCAG 2.2): semantics, keyboard access, focus, contrast, ARIA misuse, alt text, forms. Use before shipping UI. |
| `dependency-auditor` | 🟢 haiku | Read, Grep, Glob, Bash | Reviews dependencies for known vulnerabilities, abandoned packages, duplicate libraries and heavy installs. Use before releases or when the lockfile grows. |
| `e2e-tester` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Creates and repairs end-to-end tests (Playwright, Cypress) for critical user flows. Use for login, checkout, onboarding or any flow that must never break. |
| `lint-fixer` | 🟢 haiku | Read, Grep, Glob, Edit, Write, Bash | Runs linters/formatters and fixes the reported problems without changing behaviour. Use when CI fails on lint or before committing. |
| `perf-optimizer` | 🔵 sonnet | Read, Grep, Glob, Bash, Edit | Finds and fixes performance bottlenecks (slow queries, N+1, heavy renders, blocking I/O, memory bloat, big bundles). Use when something is slow or before scaling. |
| `security-auditor` | 🔵 sonnet | Read, Grep, Glob | Audits code for security vulnerabilities (injection, auth bypass, secrets in code, unsafe deserialization, SSRF, path traversal, XSS, weak crypto). Use before releases or when handling user input, auth or payments. |
| `test-writer` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Writes focused unit and integration tests for new or untested code, matching the project's test framework and style. Use after implementing a feature or when coverage is missing. |
| `type-fixer` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Fixes TypeScript / mypy / Pyright type errors properly instead of silencing them. Use when the type-checker fails. |

## frontend

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `component-builder` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Builds reusable, typed, accessible UI components with variants and docs/stories. Use when adding to a design system. |
| `css-stylist` | 🟢 haiku | Read, Grep, Glob, Edit, Write, Bash | Fixes layout and styling bugs (flex/grid, overflow, responsive breakpoints, dark mode) with minimal CSS. Use for visual glitches. |
| `nextjs-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Next.js App Router expert: server/client components, routing, data fetching, caching, metadata, edge/runtime config. Use for Next.js features or migrations. |
| `react-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | React specialist for components, hooks, state, rendering performance and React 19 features. Use for any non-trivial React work. |
| `svelte-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Svelte 5 / SvelteKit specialist (runes, load functions, form actions). Use for Svelte work. |
| `tailwind-expert` | 🟢 haiku | Read, Grep, Glob, Edit, Write, Bash | Tailwind CSS specialist: utility composition, design tokens, responsive and dark variants, cleaning up class soup. Use for Tailwind styling. |
| `ui-designer` | 🟠 opus | Read, Grep, Glob, Edit, Write, Bash | Designs and implements polished UI: layout, typography, spacing, color, states and micro-interactions. Use when something must look great, not just work. |
| `vue-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Vue 3 / Nuxt specialist: Composition API, Pinia, routing, SSR. Use for Vue or Nuxt work. |

## backend

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `api-designer` | 🟠 opus | Read, Grep, Glob | Designs REST/GraphQL APIs: resources, endpoints, errors, pagination, versioning, auth. Use before building or changing an API. |
| `auth-expert` | 🟠 opus | Read, Grep, Glob | Reviews and designs authentication and authorization: sessions, JWT, OAuth/OIDC, password storage, RBAC, multi-tenant isolation. Use for anything touching login or permissions. |
| `db-architect` | 🟠 opus | Read, Grep, Glob | Designs database schemas, indexes, constraints and migrations for correctness and scale. Use before adding tables or changing data models. |
| `go-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Go specialist: idiomatic packages, error handling, concurrency, context, testing. Use for Go code. |
| `graphql-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | GraphQL specialist: schema design, resolvers, DataLoader batching, pagination, auth. Use for GraphQL APIs. |
| `node-backend` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Node.js/TypeScript backend specialist (Express, Fastify, Nest, Hono): routes, validation, errors, background jobs. Use for Node server work. |
| `python-backend` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Python backend specialist (FastAPI, Django, Flask): models, endpoints, async I/O, migrations, typing. Use for Python services. |
| `rust-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Rust specialist: ownership, lifetimes, error types, async (tokio), performance, unsafe review. Use for Rust code and compiler fights. |
| `sql-optimizer` | 🔵 sonnet | Read, Grep, Glob, Bash | Finds and fixes slow SQL: N+1 queries, missing indexes, bad joins, full scans. Use when pages or jobs are slow because of the database. |

## devops

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `ci-engineer` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Builds and speeds up CI pipelines (GitHub Actions, GitLab CI): caching, matrices, parallelism, flaky-test isolation. Use when CI is slow, broken or missing. |
| `docker-expert` | 🟢 haiku | Read, Grep, Glob, Edit, Write, Bash | Writes and optimizes Dockerfiles and compose files: small images, layer caching, multi-stage builds, non-root users. Use for containerization. |
| `incident-responder` | 🟠 opus | Read, Grep, Glob, Bash | Leads production incident triage: impact, timeline, mitigation, root cause and follow-ups. Use when something is broken in production. |
| `k8s-operator` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Kubernetes specialist: manifests, Helm, probes, resources, autoscaling, debugging failing pods. Use for k8s deployments and incidents. |
| `log-analyst` | 🟢 haiku | Read, Grep, Glob, Bash | Digs through large logs and stack traces to find the first real error and its pattern. Use instead of pasting logs into the main conversation. |
| `release-manager` | 🟢 haiku | Read, Grep, Glob, Bash | Prepares releases: version bump, changelog, tags, release notes, pre-release checklist. Use when shipping a version. |
| `terraform-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Terraform / IaC specialist: modules, state, plans, drift, least-privilege IAM. Use for infrastructure changes. |

## data-ai

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `data-analyst` | 🔵 sonnet | Read, Grep, Glob, Bash | Answers questions from data (CSV, SQL, logs) with reproducible scripts and clear numbers. Use for metrics, reports and ad-hoc analysis. |
| `llm-app-builder` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Builds LLM-powered features with the official SDKs: tool use, streaming, structured output, prompt caching, evals. Use when adding AI features to an app. |
| `ml-engineer` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Machine-learning engineer: training pipelines, evaluation, feature engineering, experiment tracking, model serving. Use for ML code. |
| `notebook-cleaner` | 🟢 haiku | Read, Grep, Glob, Edit, Write, Bash | Turns messy Jupyter notebooks into clean, runnable scripts or modules. Use when exploration code needs to become production code. |
| `prompt-engineer` | 🟠 opus | Read, Grep, Glob, Edit, Write | Improves prompts, system prompts, CLAUDE.md files and agent descriptions for clarity and reliability. Use when an LLM feature behaves inconsistently. |

## docs

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `api-doc-writer` | 🟢 haiku | Read, Grep, Glob, Edit, Write | Generates API reference docs from code: endpoints or functions, parameters, return types, errors, examples. Use when APIs lack docs. |
| `changelog-writer` | 🟢 haiku | Read, Grep, Glob, Bash | Writes user-facing changelog entries from commits and diffs (Keep a Changelog style). Use before a release. |
| `commit-writer` | 🟢 haiku | Bash, Read | Writes clear conventional commit messages and PR descriptions from the staged diff. Use when the user asks to commit or open a PR. |
| `doc-writer` | 🟢 haiku | Read, Grep, Glob, Edit, Write | Writes and updates READMEs, API docs, changelogs and code comments from the actual code. Use after features land or when docs are stale. |
| `readme-polisher` | 🔵 sonnet | Read, Grep, Glob, Edit, Write | Rewrites READMEs to be scannable and convincing: pitch, quick start, features, examples, FAQ. Use before publishing a project. |
| `translator` | 🟢 haiku | Read, Grep, Glob, Edit, Write | Translates UI strings, docs and locale files while preserving placeholders, markup and tone. Use for i18n work. |

## mobile

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `android-kotlin` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Android specialist in Kotlin/Jetpack Compose: UI, coroutines, Room, lifecycle. Use for native Android work. |
| `flutter-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | Flutter/Dart specialist: widgets, state management, platform channels, performance. Use for Flutter apps. |
| `ios-swift` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | iOS specialist in Swift/SwiftUI: views, concurrency, data flow, App Store requirements. Use for native iOS work. |
| `react-native-expert` | 🔵 sonnet | Read, Grep, Glob, Edit, Write, Bash | React Native / Expo specialist: navigation, native modules, performance, platform differences. Use for mobile app work in RN. |

## product

| Agent | Model | Tools | When Claude uses it |
|---|---|---|---|
| `migration-planner` | 🟠 opus | Read, Grep, Glob | Plans large migrations (framework upgrades, monolith splits, database moves) into safe incremental steps. Use before any big rewrite. |
| `seo-optimizer` | 🟢 haiku | Read, Grep, Glob, Edit, Write, Bash | Improves technical SEO: metadata, Open Graph, sitemaps, structured data, Core Web Vitals hints. Use for public websites. |
| `spec-writer` | 🟠 opus | Read, Grep, Glob | Turns a rough idea into a crisp product spec: problem, users, scope, non-goals, acceptance criteria. Use before building a feature. |
| `ux-copywriter` | 🟢 haiku | Read, Grep, Glob, Edit | Writes and fixes UI copy: buttons, empty states, errors, onboarding, tooltips. Use when text in the product feels off. |
