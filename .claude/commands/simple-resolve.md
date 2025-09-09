---
description: Solve a task with lightweight parallel reasoning in a single command—produce a concise plan, implement, then smoke-test and check for hallucinations.
argument-hint: [Problem] | [Constraints] | [Output format]
---

Input:
$ARGUMENTS

Output format (must follow exactly):
- [Summary] one line
- [Immediate Plan] up to 3 short steps
- [Solution] final code/content only (no extra narration)
- [Smoke Test] 1–2 minimal usage/run examples
- [Hallucination Check] confirm no out-of-input assumptions, no “unknown source” facts, and constraints are reflected

Procedure:
1) Parse `$ARGUMENTS` into `Problem | Constraints | Output format` (empty if missing).
2) Brief “micro-parallel” exploration (A/B/C). If helpful, **invoke already-registered subagents by name** for 1–2 line recommendations; otherwise reason internally. Keep only **one** shortest path.
3) Implement the solution **with a TDD cycle (red → green → refactor)** and **preserve FSD boundaries & public APIs**:
   - Write a failing test first → make it pass with the smallest change → refactor while keeping tests green. :contentReference[oaicite:0]{index=0}
   - Keep domain logic in features/entities; put generic, reusable UI/utility in shared; import across slices/layers **only via each slice’s public API**. :contentReference[oaicite:1]{index=1}
4) Provide a tiny smoke test (sample input/output or command to run). Prefer **behavior-centric tests** (e.g., `getByRole`, `getByLabelText`) that mirror user interactions. :contentReference[oaicite:2]{index=2}
5) Hallucination check:
   - Do not invent APIs/versions/numbers not present in the input.
   - Exclude anything with unknown or unverifiable sources.
   - State in one line that constraints **and** the FSD/TDD guardrails are enforced in both solution & test.

Architecture & Testing Requirements (must follow):
- **FSD layers & boundaries:** Organize by FSD layers (e.g., app → processes → pages → widgets → features → entities → shared); cross-slice imports go **only through the slice’s Public API** (e.g., `index.ts` re-exports). This allows internal refactors without breaking external contracts. :contentReference[oaicite:3]{index=3}
- **TDD discipline:** Apply **red → green → refactor** in small increments; sequence tests so they quickly drive key design decisions; keep code well-structured via refactoring once tests are green. :contentReference[oaicite:4]{index=4}
- **Behavior-focused testing:** Prefer accessibility-aligned queries (`getByRole`, `getByLabelText`) over implementation details when writing examples or smoke tests. :contentReference[oaicite:5]{index=5}
