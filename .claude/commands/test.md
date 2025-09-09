---
description: Run MCP+Playwright journey tests to verify core/secondary features, all UI buttons, UX friction, and non-regression of user progress.
argument-hint: [journey or scope, e.g. "checkout", "apps/web"]
# 필요 시 도구 허용(예시): allowed-tools: Bash(npx:*), Bash(pnpm:*), Bash(yarn:*), Editor
---

## Objective
Use **MCP + Playwright** to execute **user journey** scenarios that verify:
1) **Core features** and **secondary features** function as intended  
2) **All actionable UI controls (buttons/links/toggles)** operate without dead-ends  
3) **UX friction is minimized** (no confusing flows, excessive steps, unclear states)  
4) **No regression of user progress** (work never “goes backwards”: inputs, state, draft, cart, or wizard steps are never lost unexpectedly)

## Pass Criteria
A run **passes only if all are true**:
- No unhandled errors in UI/console/network  
- No broken or non-responsive buttons/links on scoped screens  
- No **critical UX friction** (e.g., hidden blockers, ambiguous CTAs, dead-end navigation, unexpected resets)  
- **Non-regression**: at any checkpoint, user progress/state is preserved after navigation, refresh, and common retries  
- Core + secondary features in scope behave per spec; degraded states provide clear recovery (toasts, inline errors)

## Scope & Inputs
- Scope: `$ARGUMENTS` (e.g., a journey name like “onboarding”, or a path like `apps/web`)  
- Journeys: derive from STARTWORK/PRD or the repository’s canonical user flows (login→task→submit, browse→detail→purchase, etc.)  
- Include **happy paths + key edge cases** (validation errors, network latencies, auth timeouts)

## Test Plan (Auto-Generate & Execute)
1) **Discover** screens & routes within scope; map navigation graph (primary + secondary flows)  
2) **Enumerate controls** per screen; queue clickability checks (visible, enabled, actionable)  
3) **Define journeys**:  
   - Core: end-to-end paths delivering main value  
   - Secondary: supportive tasks (filters, share, save-draft, settings)  
4) **MCP/Playwright Run**:  
   - Launch in headed/CI mode with tracing, video, console, network capture  
   - For each journey step: assert visible state, click targets, URL/route, content, ARIA roles  
   - Insert **progress checkpoints** (draft saved, cart count, step index) and verify persistence after:  
     - soft reload, route change, back/forward, temporary offline (if applicable)  
5) **UX Friction Heuristics** (flag as warn/error based on severity):  
   - Unclear CTAs/labels; missing success/failure feedback  
   - More than N (>2) redundant steps without rationale  
   - Unexpected scroll jumps or focus loss on form submit  
   - Non-destructive actions lacking undo/cancel; destructive actions lacking confirm  
   - Loading states without progress indication beyond T seconds  
6) **Report & Gate**  
   - Summarize failures by category: Functional / Clickability / UX / Non-regression  
   - Provide minimal repro steps, screenshots, traces, suggested fix  
   - **Block release** if any critical items fail; otherwise output next actions

## Coverage Targets
- **Buttons/links/toggles** on in-scope pages: ≥ 100% clickability verified  
- **Core journeys**: 100% pass required  
- **Secondary journeys**: ≥ 90% pass; remaining documented with mitigations  
- **Regression checkpoints**: All preserved (drafts, step index, selected options)

## Output
- `journey-report.md`: summary table (journey × step × status), friction findings, regression checkpoints  
- `artifacts/` (per run): Playwright HTML report, videos, traces, screenshots  
- “Next actions” backlog: prioritized fixes with owners and ETA

## Run Guidance (examples)
- Quick run (auto-discover scope):  
  - `npx playwright test --project=chromium --reporter=html`
- Focus journey (tagged with @checkout):  
  - `npx playwright test -g "@checkout"`
- CI stable with retries & trace on failure:  
  - `npx playwright test --retries=2 --trace=on-first-retry`

## Notes
- Prefer data-testids for stability; fall back to ARIA roles + text with tolerance  
- Use test users/fixtures; isolate state; clean up after runs  
- Record console, request/response; assert **no 4xx/5xx** except mocked error tests
