# Security

ClaudePlus runs locally. It reads Claude Code transcripts, edits `~/.claude/settings.json` only when you run `cplus install`/`uninstall` (with a backup), and serves a dashboard bound to `127.0.0.1`.

Dashboard protections:
- It refuses requests whose `Host` header isn't `127.0.0.1:<port>` or `localhost:<port>`, which blocks DNS rebinding.
- Every non-GET request must carry an `X-CPlus: 1` header. Browsers can't add that header cross-site without a CORS preflight, and the server never allows one.
- Static files are served only from the `dashboard/` folder (path-traversal checked).

If you find a vulnerability, please open a GitHub security advisory (Security → Report a vulnerability) instead of a public issue.
