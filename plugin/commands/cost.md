---
description: Show what Claude Code has cost you (ClaudePlus). Optional period - today, 7d, 30d, month, all
allowed-tools: Bash(cplus:*)
argument-hint: "[today|7d|30d|month|all]"
---

!`cplus overview --since "$ARGUMENTS" 2>&1`

Above is the user's ClaudePlus spend report. Reply in the user's language with at most 5 short bullet points:
the total, the biggest cost driver (model / project / session), and one concrete tip to spend less.
Do not repeat the whole table.
