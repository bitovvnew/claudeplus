# Changelog

## 0.1.1 — 2026-11-11

### Added
- **One-step connection:** double-click `auto-connect.bat` on Windows, or run `cplus connect`. A warning and explicit confirmation precede setup; existing settings are backed up before Guard and the statusline are installed and the local dashboard opens with your own statistics.
- **18 skills** for Claude Code (`~/.claude/skills`): token-diet, spec-driven-dev, human-grade-ui, design-system, motion-design, landing-page, code-review, debugging-playbook, test-strategy, git-workflow, api-design, safe-migrations, performance-profiling, security-checklist, release-checklist, readme-that-sells, refactor-safely, postmortem. Manage them with `cplus skills` and from the dashboard.
- **32 new agents (94 in total) and 2 new packs.** The Design Studio pack adds design-critic, brand-designer, motion-designer, typography-expert, landing-page-builder, dashboard-designer, svg-illustrator and email-template-builder. The Bots & Automation pack adds Telegram and Discord bots, scrapers, automation, shell and regex agents. Other new agents cover Astro, Angular, Three.js, Electron/Tauri, browser extensions, Unity/Godot, Java/Spring, .NET, Laravel, Rails, Stripe, Supabase/Firebase, RAG, SQL analysis, i18n, privacy, onboarding and cost-auditor.
- **`cplus optimize [--apply]`** turns the leak report into one-command fixes: install Guard and the statusline, move read-only agents to Haiku, install the Cost Saver pack, and set a budget from your own history.
- **Spec-driven slash commands:** `/claudeplus:spec`, `plan`, `review`, `handoff`, `ship` and `optimize`.
- **Kazakh (Қазақша)**, the 17th language.
- **Dashboard:** a command palette (Ctrl/⌘+K) that can jump to any session, keyboard shortcuts, number count-ups, charts that draw in, staggered entrances, a sliding tab indicator and skeleton loading. All motion respects `prefers-reduced-motion`.
- **Plusbot,** the new pixel mascot and logo.

### Changed
- Calmer visual design: paper-and-ink surfaces with color reserved for data, and no decorative gradients.
- README rewritten in a plainer voice, and a new banner.

### Fixed
- CI on Node 22: `node --test test/` resolved to a module, so tests now run with an explicit file list.
- Reinstalling disabled agents or skills preserves their disabled state; pack installs keep existing customizations.
- Skills respect `--user`, optimization commands identify the target scope, and failed optimization actions return a nonzero exit code.
- Moving project agents and skills to trash works across drives, preserving the original if copying fails.
- Leak totals leave their loading state correctly. The command palette is translated, keeps keyboard focus, and remains usable on small screens.
- Background refreshes keep charts still, and number animations never start below zero.

## 0.1.0 — 2026-11-11

The first public release.

### Added
- **16 UI languages** for the dashboard and leak report. The language is detected from the system and can be changed with `cplus lang <code>` or the dashboard header.
- **Demo mode** (`cplus demo [command]`). It runs every screen on deterministic synthetic data without touching your own history.
- **5-hour usage blocks** (`cplus blocks`, a dashboard chart and an active-block tile) with time left and projected spend.
- **Burn rate** in $ per hour over the last 60 minutes.
- **Live monitor** (`cplus watch`).
- **Statusline themes**: classic, capsule, powerline, emoji, minimal. `cplus statusline --preview` shows them all. There is a new `burn` segment.
- **Agent library expanded to 62 agents** in 10 categories, plus **10 packs** (`cplus agents packs`, `cplus agents pack <id>`). The dashboard has category filters and one-click pack installs.
- `docs/AGENTS.md` catalog, `npm run bench`, `npm run screenshots`, and a CI matrix covering 3 operating systems × Node 18/20/22.

### Changed
- Leak findings are returned as i18n keys with parameters, so the CLI and dashboard render them in any language.
- Agent descriptions are written as quoted YAML, so descriptions that contain `: ` stay valid.

## 0.0.1 — internal

- Local cost tracking, leak report, dashboard, statusline, Guard hook, agent manager with 10 agents, slash-command plugin.
