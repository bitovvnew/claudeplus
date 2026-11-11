# Changelog

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
