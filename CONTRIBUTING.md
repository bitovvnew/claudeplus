# Contributing to ClaudePlus

Thanks for helping! A few ground rules keep the project fast and trustworthy.

## Principles
1. **Zero runtime dependencies.** Node's standard library only. Dev scripts may use system tools such as Chrome for screenshots, but nothing in `bin/`, `src/` or `dashboard/` may require `npm install`.
2. **Local and private.** No network calls and no telemetry. Never commit real transcripts, screenshots of real data, or personal paths. Use `cplus demo` data.
3. **Never break Claude Code.** Hook and statusline code must swallow its own errors and stay fast (aim for under 60 ms per call).

## Setup
```bash
git clone https://github.com/bitovvnew/claudeplus.git && cd claudeplus
npm link
npm test
npm run demo
```

## Adding…
- **An agent:** add a spec to `scripts/build-library.mjs` (or a hand-written `.md` in `library/agents/<category>/`), add it to a pack in `library/packs.json` if it fits, then run `npm run library`. Pick the cheapest model that does the job well.
- **A translation:** copy `locales/en.json` to `locales/<code>.json`, translate the values, keep every `{placeholder}`, and add the code to `LANGS` in `src/i18n.js`. The test suite checks for completeness.
- **A leak detector:** extend `src/waste.js` and return `{ id, severity, savings, params, examples }`, then add `leak.<id>.title|detail|advice` to the locales.
- **A statusline theme:** extend `render()` in `src/statusline.js` and `THEMES`.

## Before opening a PR
- `npm test` passes
- `npm run screenshots` if the UI changed
- Update `CHANGELOG.md`
