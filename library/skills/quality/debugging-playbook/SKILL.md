---
name: debugging-playbook
description: "Systematic debugging: reproduce, bisect, form hypotheses, prove the root cause, fix, verify. Use for any bug whose cause is not obvious."
---

# Debugging Playbook

Guessing is expensive. Narrow the search space with evidence.

## Steps
- Reproduce with the smallest input; write it down as a test if possible.
- Read the full error and stack; find the first frame in our code.
- Bisect: git bisect, comment out halves, binary-search inputs.
- Change one thing at a time; keep notes of what was ruled out.
- Fix the cause, not the symptom; add a regression test; verify the original repro.
