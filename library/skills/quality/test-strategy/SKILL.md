---
name: test-strategy
description: "Decide what to test and how: unit vs integration vs e2e, fixtures, mocking boundaries, flaky-test hygiene. Use when adding tests to a codebase or when tests are slow or flaky."
---

# Test Strategy

Test behavior at the cheapest level that can catch the bug.

## Guidelines
- Pure logic → unit tests; I/O boundaries → integration tests with real dependencies where cheap; critical user flows → a few e2e tests.
- Mock only what you do not own or what is slow/non-deterministic.
- One reason to fail per test; descriptive names; no sleeps — wait on conditions.
- Flaky test → fix or quarantine with an issue link the same day.
