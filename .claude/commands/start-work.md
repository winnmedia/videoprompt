name: /load-context-and-standby
description: Establishes full operational readiness by determining locality (CWD/FSD mapping), loading hierarchical guidelines (CLAUDE.md) and root history (MEMORY.md), analyzing trajectory and proactive risks, verifying the environment, checking overrides (STARTWORK.md), and efficiently synthesizing the context.
argument-hint: N/A

execution-steps:
  1. Determine Operational Locality:
     - Identify the Current Working Directory (CWD).
     - Map the CWD to the FSD architecture (Identify Layer and Slice).

  2. Load Guidelines (CLAUDE.md - Hierarchical):
     - Perform a hierarchical search (bottom-up) starting from the CWD for `CLAUDE.md`. Load the closest file.
     - If not found: Abort and notify the user that essential guidelines are missing.
     - Internalize core pillars (FSD, TDD, Stack Duality, AI Guardrails).
     - CRITICAL: Identify the "Active Ruleset" based on the loaded file's location (e.g., Standard vs. Legacy mode).

  3. Load and Analyze History (MEMORY.md - Root):
     - Locate and load `MEMORY.md` (typically at the Project Root).
     - If not found: Abort and notify the user that essential history is missing.
     - Analyze recent entries (last 3-5) to synthesize the current project trajectory and proactively identify current risks or technical debt.

  4. Environment and Tooling Verification:
     - Verify the current execution environment against requirements defined in `CLAUDE.md` (Part 0).
     - Check essential tools (PNPM) and core dependencies (TypeScript 5.7). Report any discrepancies.

  5. Load Immediate Context Overrides (STARTWORK.md):
     - Check for the existence of `STARTWORK.md` in the immediate context.
     - If it exists: Read its content as high-priority constraints that OVERRIDE all other contexts.

  6. Synthesis and Confirmation (Context Optimization):
     - Synthesize the combined context (Locality + Guidelines + History + Environment + Overrides).
     - CRITICAL: Optimize for context window efficiency by summarizing principles and history rather than embedding large volumes of raw text.
     - Output a comprehensive "Context Acknowledgment Report".
     - Confirm readiness.