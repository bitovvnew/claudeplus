---
name: safe-migrations
description: "Ship database schema and data migrations without downtime or data loss (expand → migrate → contract). Use for any schema change on a live system."
---

# Safe Migrations

Every migration must be reversible or at least recoverable.

## Expand / contract
- Add new columns/tables nullable or with defaults; deploy code that writes both.
- Backfill in batches with progress logging.
- Switch reads; then remove the old path in a later release.
- Never rename/drop in the same deploy that stops using a column.
- Take a backup or snapshot before destructive steps; test on a copy of production data size.
