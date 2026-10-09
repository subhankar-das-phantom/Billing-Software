---
name: implementation-planner
description: >-
  Use this skill whenever drafting, reviewing, or iterating on an implementation plan
  for the Bharat Enterprise platform. Enforces a multi-iteration review loop, architectural audits
  (zero N+1, zero CLS, universal debouncing), and prevents code generation until the user explicitly commands "code" or "proceed".
---

# Implementation Planner Skill

This skill guides the agent through requirements analysis, architectural impact assessment, multi-iteration planning, and explicit user gatekeeping.

---

## Workflow Steps

### Step 1: Research & Discovery (Strictly Read-Only)
- Inspect the codebase using `view_file`, `grep_search`, and `list_dir`.
- Identify affected layers: database models, controllers, services, API routes, frontend components, and hooks.
- **Architectural Bottleneck Checklist**:
  - **Check for N+1 Queries**: Are any database lookups executed inside loops or `Array.map`?
  - **Check for CLS / Layout Reflow Risks**: Do banners or alerts use `height: 'auto'` spring animations or unseeded asynchronous states?
  - **Check Search Debouncing**: Do search inputs lack debounce protection (keystroke network spam)?
  - **Check Date Boundary Traps**: Do transaction lookups default to today's date boundary without an all-time search override?
  - **Check for Skeleton Flicker & Anti-Stale Caching**: Do pages trigger blank skeleton sweeps on repeat visits instead of frame-0 pre-seeded `useSWR` reads? Do mutations trigger cross-tab cache invalidations?
  - **Check for Concurrency & Read-Modify-Write**: Are entity balances modified via in-memory math and overwritten, risking lost updates? Are atomic `$inc` operators and `session.withTransaction` auto-retrying write conflicts used?
  - **Check for Single-vs-List Query Parity**: Does a single entity detail lookup (`getCustomer`) compute balances dynamically from live unpaid invoices/ledgers with zero-overhead background self-healing, matching collection endpoints (`getCustomers`) and ledgers?
  - **Check for Currency Precision & Decimal Truncation**: Are financial counters and KPI cards using `decimals={2}` with `'en-IN'` locale formatting, or is `Math.round()` / `decimals={0}` truncating paise?
  - **Check for Dropdown / Popover Flicker & Trigger Flashing**: Do dropdowns, popovers, or floating menus use spring physics or unanchored scale animations? Do they lack `transformOrigin`, `will-change-[transform,opacity]`, or locked active trigger button styling when open? Do child elements inside trigger buttons lack `pointer-events-none`?
  - **Check Table Column Defensive Shapes & Method Safety**: Do table renderers call `.toFixed()`, `.slice()`, or `.charAt()` directly on potentially flat, undefined, or unpopulated fields without nullish coalescing `??` fallbacks?
  - **Check Mock Data Parity & Isolation**: Do mock handlers synchronize both root `entity.*` and `summary.*` fields to avoid split KPI counts on detail pages? Are mock collections isolated per entity ID, and do they supply relationship IDs (`invoiceId`, `invoice: { _id, invoiceNumber }`) for deep-links?
  - **Check for Identifier & Import Integrity**: Are all JSX components (e.g. `RefreshIndicator`) and external helpers explicitly imported with zero duplicate `useState` holdovers?
  - **Check for List/Detail Navigation & Filter Persistence**: Does navigating to detail views discard filter/search parameters upon returning? Do collection cards pass `state={{ from: currentPath }}`, do detail pages route explicit back buttons to `location.state?.from || fallback`, and do search inputs prevent cursor jumping and focus loss via `lastSyncedSearchRef` guards?
  - **Check for Public Serializer & Financial Parity**: Do public DTO serializers, printable views, and PDF stream adapters compute canonical `finalTotal`, `roundOff`, and `dueAmount` with 100% mathematical parity against internal billing views? Are public serializers backed by automated regression tests?
  - **Check for Mobile Card Density & Action Squishing**: Do mobile cards squish multi-action button rows horizontally instead of converting to a structured 2x2 grid (`grid grid-cols-2 gap-2 sm:flex`) with `min-h-[44px]` touch targets and compact padding?
  - **Check Workspace Layout Spacing**: Does the page container waste vertical screen space with sparse `space-y-12` margins instead of dense, high-clarity `space-y-6` spacing?
- **DO NOT** execute file edits, write code, or execute mutating scripts during this stage.

### Step 2: Formulate the Implementation Plan Artifact
Draft `implementation_plan.md` in the active artifact directory containing:
1. **Goal & Problem Analysis**: Background, symptom, and technical root cause.
2. **User Review Required**: Critical architectural decisions, permission boundaries, and schema impacts highlighted with GitHub alerts (`[!IMPORTANT]`, `[!WARNING]`).
3. **Open Questions**: Explicit ambiguities requiring clarification.
4. **Proposed Changes**: File-by-file breakdown (`[MODIFY]`, `[NEW]`, `[DELETE]`) with exact function signatures, logic flow, indexing strategies, and component structures.
5. **Verification Plan**: Automated tests (`npx tsc --noEmit`, `npm run build`), DB queries/validations, and manual UI verification steps.

### Step 3: The Iterative Review Loop
- Present the plan to the user.
- Allow the user to challenge assumptions, suggest refinements, or request alternative approaches.
- Update `implementation_plan.md` across iterations until 100% alignment is achieved.

### Step 4: The Execution Gate & Environment Safety
- **HALT and WAIT**: Do not touch source code while discussing or refining the plan.
- Only begin executing file modifications when the user explicitly provides the instruction:
  - `"code"`
  - `"proceed"`
  - `"implement the plan"`
- **Non-Prod Environment Gate for Stress & Mutating Tests**:
  > [!CAUTION]
  > When testing concurrency stress scripts, mass recalculations, data migrations, or simulation scripts, **NEVER** run them against a production database.
  > Always check `backend/.env` / database connection URI. If pointed to production, pause and explicitly instruct the user to switch to a staging or non-prod database before running any mutating test script.
