---
description: Pre-ship checklist — tests, build, changelog, version, commit message — without pushing
allowed-tools: Bash(git:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Read, Grep, Glob, Edit
---

Prepare this change for shipping:

1. Run the project's tests and build (detect the toolchain); fix failures.
2. Update CHANGELOG.md (user-facing wording) and bump the version if this is a release.
3. Show `git diff --stat` and propose a conventional commit message (`type(scope): summary` + why).
4. Stop before committing or pushing — ask the user to confirm.
