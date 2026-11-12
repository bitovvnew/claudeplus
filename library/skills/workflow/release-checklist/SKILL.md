---
name: release-checklist
description: "Prepare and ship a release safely: version, changelog, migrations, smoke tests, rollback plan, announcement. Use when cutting a version."
---

# Release Checklist

Releases should be boring.

## Before
- Tests and build green; changelog and version bumped; migrations reviewed.
- Rollback plan written (previous tag, feature flags).

## After
- Smoke-test the critical paths in production; watch errors and latency for 30 minutes.
- Publish release notes focused on user-visible changes.
