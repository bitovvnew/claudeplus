// Generates library/skills/<id>/SKILL.md (Claude Code skills) from the specs below.
// Usage: node scripts/build-skills.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'library', 'skills');
const force = process.argv.includes('--force');

// [id, category, description, intro, sections: [title, bullets[]][]]
const S = [
  ['token-diet', 'cost-saver', 'Work in a token-efficient way: read in slices, search before reading, delegate bulk reading to cheap subagents and compact on time. Use on every long or expensive session, or when the user mentions cost, limits or tokens.',
    'Every token in context is paid for again on every turn. Keep the context small and the expensive model focused on decisions.',
    [['Reading', ['Grep or Glob first; Read only the lines you need with offset/limit.', 'Never re-read a file you already have unless it changed.', 'Prefer `git diff --stat` / `| head -50` over full dumps of logs, lockfiles or diffs.']],
     ['Delegation', ['Send broad searches, log digging and doc lookups to a Haiku subagent (scout, cheap-researcher, log-analyst) and keep only its summary.', 'Never give a read-only subagent an Opus/Fable model.']],
     ['Context hygiene', ['Around 150k tokens of context, suggest /compact.', 'Before a long break, write a HANDOFF.md (context-keeper) and /clear — a cold cache after 5 min/1 h re-bills the whole context.', 'One task per session; start unrelated work in a new session.']],
     ['Effort', ['Routine edits → low/medium effort. Save high effort for design, debugging and hard reasoning.']]]],
  ['spec-driven-dev', 'workflow', 'Turn a feature request into SPEC → PLAN → IMPLEMENT → VERIFY with written artifacts. Use for any feature that touches more than two files or when requirements are fuzzy.',
    'Code written against a clear spec needs fewer rewrites — the cheapest token is the one you never spend redoing work.',
    [['1 · Spec (docs/specs/<feature>.md)', ['Problem, users, goals, explicit non-goals.', 'Acceptance criteria as testable statements.', 'Open questions — ask the user before building if any block the design.']],
     ['2 · Plan', ['Files to change and why, in order.', 'Risks and how each is verified.', 'Keep steps small enough that the system works after each one.']],
     ['3 · Implement', ['Follow the plan; update it when reality differs.', 'Write or update tests alongside the code.']],
     ['4 · Verify', ['Run tests/build; walk through every acceptance criterion and mark it ✓ or ✗.', 'Report what is not verified.']]]],
  ['human-grade-ui', 'design', 'Design interfaces that look crafted by an experienced product designer, not generated. Use whenever building or restyling UI, landing pages, dashboards or marketing pages.',
    'Generated-looking UI has tells: purple-blue gradients everywhere, emoji in headings, glowing blobs, identical cards, vague copy. Avoid them on purpose.',
    [['Foundations', ['Pick one neutral base (paper, ink or stone) and ONE accent; use color for meaning and data, not decoration.', 'A real type scale (e.g. 12/14/16/20/28/40) with tight letter-spacing on large text; one or two families max.', 'An 4/8-px spacing scale; align everything to it; generous whitespace.']],
     ['Composition', ['Clear hierarchy: one primary action per view; secondary actions look secondary.', 'Vary rhythm — not every section is a grid of three cards.', 'Use real content and real numbers, never lorem ipsum or "Feature 1".']],
     ['Details that read as human', ['Hairline borders and subtle shadows instead of heavy glows.', 'Purposeful motion: 150–300 ms, ease-out, for state changes only; respect prefers-reduced-motion.', 'Specific microcopy ("Saved 3 min ago") over generic ("Success!").', 'Every state designed: empty, loading (skeletons), error, success, disabled.']],
     ['Avoid', ['Gradient text on everything, rainbow palettes, emoji bullets, stock 3D blobs, centered walls of text, fake testimonials.']]]],
  ['design-system', 'design', 'Create or extend a design system: tokens (color, type, spacing, radius, shadow, motion), components with variants and states, and docs. Use when a project has inconsistent UI or is starting its UI layer.',
    'A design system is a small set of decisions applied everywhere.',
    [['Tokens', ['Define semantic tokens (--surface, --ink, --accent, --danger) on top of raw palette values; support light and dark.', 'Type, spacing, radius, shadow and motion scales as tokens.']],
     ['Components', ['Start with Button, Input, Select, Card, Dialog, Toast, Table, Tabs.', 'Each: variants, sizes, all interactive states, keyboard support, ARIA.', 'Document usage with one example per variant.']],
     ['Adoption', ['Replace hard-coded values in the codebase gradually; add a lint rule or grep check for raw hex colors.']]]],
  ['motion-design', 'design', 'Add tasteful, performant UI animation: entrances, state transitions, number counters, chart reveals, micro-interactions. Use when the user asks for "wow" effects or the UI feels static.',
    'Good motion explains change; bad motion decorates it.',
    [['Principles', ['Animate opacity and transform only (GPU-friendly); avoid animating layout properties.', 'Durations 120–400 ms; ease-out for entrances, ease-in-out for moves; stagger lists by 30–50 ms.', 'Every animation must survive prefers-reduced-motion (disable or shorten).']],
     ['Patterns', ['Count-up numbers on load, bars that grow from the baseline, lines that draw in (stroke-dashoffset), skeleton shimmer while loading.', 'A sliding indicator for tabs; subtle lift on hover for cards.', 'Command palette and toasts that fade + rise 4–8 px.']],
     ['Don\'t', ['Replay heavy animations on background refreshes; loop decorative animations; animate on scroll for no reason.']]]],
  ['landing-page', 'design', 'Write and build a high-converting landing page: headline, proof, features, social proof, CTA, FAQ. Use for product pages, launches and open-source READMEs.',
    'People decide in five seconds. Lead with the outcome, prove it, then explain.',
    [['Structure', ['Hero: outcome-focused headline (≤ 10 words), one-line subhead, one primary CTA, a real screenshot.', 'Proof: numbers, logos or a short demo.', 'Features as benefits with visuals; then how it works; FAQ; final CTA.']],
     ['Copy', ['Concrete over clever; numbers over adjectives; the reader\'s words, not internal jargon.', 'No hype words ("revolutionary", "next-gen"); show it instead.']]]],
  ['code-review', 'quality', 'Review code changes for correctness, security, performance and maintainability with a severity-ranked report. Use before merging or when asked to review.',
    'Find what will break in production; skip taste.',
    [['Checklist', ['Logic errors and unhandled edge cases (empty, null, huge, concurrent, unicode, time zones).', 'Security: injection, authz gaps, secrets, unsafe deserialization, SSRF, path traversal.', 'Performance: N+1, unbounded loops/queries, sync I/O on hot paths.', 'API/contract changes that break callers; missing migrations; missing tests for new behavior.']],
     ['Report', ['Ranked list: severity, `path:line`, failing scenario, minimal fix.', 'If nothing blocks: say so and list at most three optional improvements.']]]],
  ['debugging-playbook', 'quality', 'Systematic debugging: reproduce, bisect, form hypotheses, prove the root cause, fix, verify. Use for any bug whose cause is not obvious.',
    'Guessing is expensive. Narrow the search space with evidence.',
    [['Steps', ['Reproduce with the smallest input; write it down as a test if possible.', 'Read the full error and stack; find the first frame in our code.', 'Bisect: git bisect, comment out halves, binary-search inputs.', 'Change one thing at a time; keep notes of what was ruled out.', 'Fix the cause, not the symptom; add a regression test; verify the original repro.']]]],
  ['test-strategy', 'quality', 'Decide what to test and how: unit vs integration vs e2e, fixtures, mocking boundaries, flaky-test hygiene. Use when adding tests to a codebase or when tests are slow or flaky.',
    'Test behavior at the cheapest level that can catch the bug.',
    [['Guidelines', ['Pure logic → unit tests; I/O boundaries → integration tests with real dependencies where cheap; critical user flows → a few e2e tests.', 'Mock only what you do not own or what is slow/non-deterministic.', 'One reason to fail per test; descriptive names; no sleeps — wait on conditions.', 'Flaky test → fix or quarantine with an issue link the same day.']]]],
  ['git-workflow', 'workflow', 'Clean git practice: small focused commits, conventional messages, safe branching, readable PRs. Use when committing, branching or preparing a PR.',
    'History is documentation.',
    [['Rules', ['One logical change per commit; message `type(scope): imperative summary` + why.', 'Never commit secrets, build output or huge binaries; check `git diff --staged` first.', 'Rebase or merge per the repo\'s convention; never force-push shared branches.', 'PR description: what, why, how to test, screenshots for UI.']]]],
  ['api-design', 'backend', 'Design consistent HTTP/GraphQL APIs: resources, naming, errors, pagination, idempotency, versioning, auth. Use before adding or changing endpoints.',
    'An API is a promise; make it predictable.',
    [['Conventions', ['Plural nouns for resources, verbs only for true actions.', 'One error shape everywhere: code, message, details, request id.', 'Cursor pagination for large lists; filtering and sorting via query params.', 'Idempotency keys for create/payment endpoints; version in the path or header.', 'Validate input at the edge; never trust client-sent IDs for authorization.']]]],
  ['safe-migrations', 'backend', 'Ship database schema and data migrations without downtime or data loss (expand → migrate → contract). Use for any schema change on a live system.',
    'Every migration must be reversible or at least recoverable.',
    [['Expand / contract', ['Add new columns/tables nullable or with defaults; deploy code that writes both.', 'Backfill in batches with progress logging.', 'Switch reads; then remove the old path in a later release.', 'Never rename/drop in the same deploy that stops using a column.', 'Take a backup or snapshot before destructive steps; test on a copy of production data size.']]]],
  ['performance-profiling', 'quality', 'Measure-first performance work: baseline, profile, fix the top hotspot, re-measure. Use when something is slow or before scaling.',
    'Optimize what the profiler shows, not what you suspect.',
    [['Loop', ['Define the metric (p95 latency, FPS, memory, bundle size) and a baseline.', 'Profile (flame graph, EXPLAIN ANALYZE, Lighthouse, perf).', 'Fix the single biggest cost; re-measure; stop when the target is met.', 'Record before/after numbers in the PR.']]]],
  ['security-checklist', 'quality', 'A practical security pass for web apps and APIs (OWASP-style). Use before releases or when touching auth, payments, file uploads or user input.',
    'Assume every input is hostile.',
    [['Check', ['AuthN/AuthZ on every route; object-level permission checks (no IDOR).', 'Parameterized queries; output encoding; CSP for web UIs.', 'Secrets only from env/secret store; rotate anything that was ever committed.', 'File uploads: type/size limits, stored outside web root, scanned if public.', 'Rate limiting and lockouts on auth; secure cookies (HttpOnly, Secure, SameSite).', 'Dependency audit; least-privilege tokens in CI.']]]],
  ['release-checklist', 'workflow', 'Prepare and ship a release safely: version, changelog, migrations, smoke tests, rollback plan, announcement. Use when cutting a version.',
    'Releases should be boring.',
    [['Before', ['Tests and build green; changelog and version bumped; migrations reviewed.', 'Rollback plan written (previous tag, feature flags).']],
     ['After', ['Smoke-test the critical paths in production; watch errors and latency for 30 minutes.', 'Publish release notes focused on user-visible changes.']]]],
  ['readme-that-sells', 'docs', 'Write a README that makes people try the project in 60 seconds: pitch, screenshot, quick start, features, FAQ. Use before publishing or when the README is weak.',
    'The README is your landing page.',
    [['Order', ['Name + one-line outcome; a real screenshot or GIF.', 'Copy-paste quick start that works on a clean machine.', 'Features as outcomes with visuals; measured numbers if you have them.', 'How it works (short), FAQ, contributing, license.']],
     ['Tone', ['Plain and specific; few emoji; no hype words; show real output.']]]],
  ['refactor-safely', 'quality', 'Behavior-preserving refactoring in small verified steps with characterization tests. Use when code works but is hard to change.',
    'Never refactor and change behavior in the same step.',
    [['Steps', ['Pin current behavior with characterization tests if coverage is weak.', 'Find all callers before moving or renaming.', 'Small steps, each followed by build + tests; commit after each green step.', 'Stop when the code is easy to change for the task at hand — not perfect.']]]],
  ['postmortem', 'workflow', 'Write a blameless incident postmortem: impact, timeline, root cause, contributing factors, action items. Use after outages or serious bugs.',
    'Fix the system, not the person.',
    [['Template', ['Summary and customer impact (who, how long, how bad).', 'Timeline with timestamps from detection to resolution.', 'Root cause and contributing factors (5 whys).', 'What went well / what went poorly.', 'Action items with owners and due dates — prefer prevention over detection over mitigation.']]]],
];

let written = 0, kept = 0;
for (const [id, category, description, intro, sections] of S) {
  const dir = path.join(OUT, category, id);
  const file = path.join(dir, 'SKILL.md');
  if (fs.existsSync(file) && !force) { kept++; continue; }
  fs.mkdirSync(dir, { recursive: true });
  const body = `---
name: ${id}
description: ${JSON.stringify(description)}
---

# ${id.split('-').map((w) => ({ ui: 'UI', api: 'API', readme: 'README' }[w] || w[0].toUpperCase() + w.slice(1))).join(' ')}

${intro}

${sections.map(([title, items]) => `## ${title}\n${items.map((x) => `- ${x}`).join('\n')}`).join('\n\n')}
`;
  fs.writeFileSync(file, body);
  written++;
}
console.log(`skills: ${written} written, ${kept} kept`);
