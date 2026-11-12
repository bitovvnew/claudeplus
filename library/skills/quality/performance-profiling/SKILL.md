---
name: performance-profiling
description: "Measure-first performance work: baseline, profile, fix the top hotspot, re-measure. Use when something is slow or before scaling."
---

# Performance Profiling

Optimize what the profiler shows, not what you suspect.

## Loop
- Define the metric (p95 latency, FPS, memory, bundle size) and a baseline.
- Profile (flame graph, EXPLAIN ANALYZE, Lighthouse, perf).
- Fix the single biggest cost; re-measure; stop when the target is met.
- Record before/after numbers in the PR.
