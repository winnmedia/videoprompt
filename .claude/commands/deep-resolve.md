# deep-resolve Rule Addendum: FSD–TDD Strategy Emphasis and Seven-Agent Parallelism

This addendum preserves parallel analysis while preventing excessive output on small tasks via budgeted selection, lead assignment, and escalation controls. The screen-first definition of done, FSD boundaries, and TDD gates remain unchanged. This addendum complements the main “deep-resolve Rule Addendum: FSD–TDD Strategy Emphasis and Seven-Agent Parallelism,” including its Output format section.

1) Objectives and Design Principles

Maintain parallelism, but cap active agents and output according to task complexity and risk.

Appoint exactly one accountable lead per task; the lead selects agents and sets output ceilings before execution.

Apply cache and incremental rules to suppress redundant output while keeping traceability.

2) Orchestration Layer and Lead Assignment

The orchestrator produces no standalone deliverables and only:
a) scores complexity and risk, b) selects active agents and per-note length limits, c) allocates output budget and blocks overruns, d) applies cache reuse and incremental mode.
Lead assignment priority: product scope → Product; structural boundaries → Architecture; data contract/performance/error model → Backend; behavioral screen → UX Design; visual system/tokens → UI Design; test/release gate → QA; schema/instrumentation → Data.

3) Tiering Model and Agent Selection

Score Complexity (files changed, layer impact, external interfaces, concurrency/state) and Risk (user visibility, release proximity, regression likelihood, regulatory/security). Each 0–3; sum defines tier.

Micro (0–2): up to 2 agents — Lead + QA.

Small (3–4): up to 3 — Lead, QA, and one domain agent (Architecture/Backend/UX or UI).

Medium (5–6): up to 5 — Lead, QA, Architecture, one domain agent; Data optional.

Large/Critical (7–12): all seven agents.
Tasks with user-visible screens must include UX or UI at minimum. Tasks changing domain models or public APIs must include Architecture.

4) Output Ceilings and Incremental Rules

Each active-agent note is one line, ≤160 characters.

Action Plan has 3–7 steps.

For the same commit hash and file set within 24 hours, reuse cached summaries and output only deltas.

On repeated runs of the same step, print only differences from the previous note.

Micro tier fast path: a single combined note from Lead may replace individual notes to minimize output, provided QA signs off.

5) Escalation Triggers and Auto-Augmentation

Escalate one tier and add required agents upon detecting:

FSD boundary violation or direct internal-file import, 2) new external dependency, 3) breaking public API/schema change, 4) security/privacy sensitivity, 5) minimum accessibility failure.

6) FSD and TDD Strategy (Immutable)

Enforce one-way layer dependencies and the public-API import rule.

Do not begin implementation without a failing test.

Prioritize user-behavior and accessibility-focused tests.

Perform DTO→ViewModel transformation only in the API layer with mandatory runtime validation.

Test entities/shared in Node and features/widgets/pages/app in JSDOM.

Fix or mock time, randomness, network, and WebSocket.

Completion is defined by the user-visible screen, not by code merge or isolated test passing.

7) Dev–QA Mutual Checks (Mandatory Gate)

No merge to main or release without QA approval.

QA holds veto over test specifications, regression thresholds, and release gates.

Upon escaped defects, Development and QA document joint root-cause analysis and preventive actions.

8) Conflict-Resolution Priority (Retained)

Follow the established sequence across Architecture → Product → Backend → UX Design → UI Design → QA → Data. When user-facing screen requirements conflict with structural constraints, prioritize the screen and require Architecture to propose structural alternatives.

9) Preflight, Screen Contract, and Compliance

Run preflight checks defined in the main addendum (FSD boundaries, import hygiene, style duplication, design tokens, accessibility basics, test-environment split, dependency additions).

For any user-visible work, produce or reference a screen contract and verify the screen-first DoD against it.

Keep an audit log for each task: tier, selected agents, reasons for inclusion/exclusion, cache usage, fast-path application, and any suppressed notes.