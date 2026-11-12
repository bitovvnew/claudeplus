---
name: design-system
description: "Create or extend a design system: tokens (color, type, spacing, radius, shadow, motion), components with variants and states, and docs. Use when a project has inconsistent UI or is starting its UI layer."
---

# Design System

A design system is a small set of decisions applied everywhere.

## Tokens
- Define semantic tokens (--surface, --ink, --accent, --danger) on top of raw palette values; support light and dark.
- Type, spacing, radius, shadow and motion scales as tokens.

## Components
- Start with Button, Input, Select, Card, Dialog, Toast, Table, Tabs.
- Each: variants, sizes, all interactive states, keyboard support, ARIA.
- Document usage with one example per variant.

## Adoption
- Replace hard-coded values in the codebase gradually; add a lint rule or grep check for raw hex colors.
