---
name: implementation-planner
description: >-
  Use this skill whenever drafting, reviewing, or iterating on an implementation plan
  for the Bharat Enterprise platform. Enforces a multi-iteration review loop and prevents
  code generation until the user explicitly commands "code" or "proceed".
---

# Implementation Planner Skill

This skill guides the agent through requirements analysis, multi-iteration architectural planning, and explicit user gatekeeping.

---

## Workflow Steps

### Step 1: Research & Discovery (Strictly Read-Only)
- Inspect the codebase using `view_file`, `grep_search`, and `list_dir`.
- Identify affected layers: database models, controllers, services, API routes, frontend components, and hooks.
- **DO NOT** execute file edits, write code, or execute mutating scripts during this stage.

### Step 2: Formulate the Implementation Plan Artifact
Draft `implementation_plan.md` in the active artifact directory containing:
1. **Goal & Problem Analysis**: Background, symptom, and root cause.
2. **User Review Required**: Critical architectural decisions, permission boundaries, and schema impacts highlighted with GitHub alerts (`[!IMPORTANT]`, `[!WARNING]`).
3. **Open Questions**: Explicit ambiguities requiring clarification.
4. **Proposed Changes**: File-by-file breakdown (`[MODIFY]`, `[NEW]`, `[DELETE]`) with exact function signatures and logic flow.
5. **Verification Plan**: Automated tests (`tsc`, `npm run build`), DB test scripts, and manual UI verification steps.

### Step 3: The Iterative Review Loop
- Present the plan to the user.
- Allow the user to challenge assumptions, suggest refinements, or request alternative approaches.
- Update `implementation_plan.md` across iterations until 100% alignment is achieved.

### Step 4: The Execution Gate
- **HALT and WAIT**: Do not touch source code while discussing the plan.
- Only begin executing file modifications when the user explicitly provides the instruction:
  - `"code"`
  - `"proceed"`
  - `"implement the plan"`
