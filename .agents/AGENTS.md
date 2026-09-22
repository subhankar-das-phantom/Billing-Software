# Bharat Enterprise Billing System — Workspace Engineering Contract

This document governs all agent operations, architectural decisions, coding patterns, and release procedures for the **Bharat Enterprise Billing System** repository.

---

## 🏛️ Core Operational Protocols

### 1. Planning First & Iteration Protocol
- **Never jump straight into coding** for architectural changes, multi-file features, or significant bug fixes.
- **Produce an Implementation Plan** with problem analysis, root causes, proposed file-by-file changes, and a verification plan.
- **Architectural Bottleneck Checklist**: In every plan, explicitly audit for N+1 queries, CLS/layout reflow hazards (e.g. spring-animated banner heights), unseeded asynchronous pop-in states, repetitive skeleton loader flashes on returning visits, missing search debouncing, unimported/duplicate identifiers, financial read-modify-write overwrite risks, single-vs-list query parity drift, and decimal/paise truncation.
- **Environment Protection Gate**: Concurrency stress tests, race simulations, data migrations, and mutating scripts must NEVER execute against a production database. Always verify the active MongoDB connection URI in `backend/.env` and pause to instruct the user to switch to a non-prod database before executing mutating test scripts.
- **Multiple Review Iterations**: Refine the plan based on feedback, edge cases, and architectural constraints.
- **Proceed Only on Explicit Command**: Do NOT modify source code or run modifying commands until the user explicitly says **"code"**, **"proceed"**, or gives unambiguous approval.

### 2. Enterprise UI Excellence (Anti-"Vibecoding")
- **High-Density, High-Clarity SaaS Layouts**: No generic AI tropes, no oversaturated neon gradients, no floating unaligned cards, and no superficial "vibecoded" fluff.
- **Color Discipline**: Deep Slate / Pro Obsidian (`slate-950`/`slate-900`/`slate-800`), crisp muted borders (`border-slate-800/80`), purposeful status colors (Emerald for positive/verified, Amber for warnings/buffers, Rose for critical stock/deadlines, Sky/Blue for informational actions).
- **Financial Counter Precision & Currency Integrity**:
  - Never truncate paise using `Math.round()` or hardcoded `decimals={0}` on financial KPI cards, summary counters, or debt totals. Truncating paise creates false discrepancies between header summary cards and underlying ledgers.
  - Pass `decimals={2}` to animated counters (`<AnimatedCounter target={value} decimals={2} />`) and format all monetary figures using the Indian numbering standard (`'en-IN'`, e.g. `₹1,23,456.78`).
  - Maintain 100% visual parity down to the exact paisa between entity profile summary counters, table rows, and ledger statements.
- **Zero-CLS Layout Stability & Anti-Lag**:
  - **Forbid `height: 'auto'` Spring Physics**: Never animate `height: 'auto'` with spring physics on sticky top banners (e.g. subscription alerts). It triggers 60 frames of continuous layout recalculations (CLS thrashing) across Recharts SVG graphs and cards below. Use GPU-accelerated opacity & subtle Y-translation (`duration: 0.15s, ease: [0.16, 1, 0.3, 1]`) with `will-change: transform, opacity`.
  - **Instant Frame-0 Pre-Seeding**: Pre-seed global banner states synchronously from `localStorage` (`cached_subscription`) on mount to eliminate delayed 300ms pop-in layout shifts. Persist dismissals in `sessionStorage`.
  - **Modal Opening & Closing Performance**: Avoid heavy fullscreen backdrop blurs (`backdrop-blur-md`) that stutter on mobile/integrated GPUs. Keep exit transitions snappy (`duration: 0.15s`).
- **Universal Search Debouncing & Ergonomics**:
  - Every search input throughout the application (Collections, Customer lookups, Employee directories, Manual Entries, Logs, Analytics) must be debounced (250–300ms).
  - Every search bar must render an instant clear (`X`) button when non-empty.
  - Empty search states must provide contextual 1-click fallback actions (e.g. *"Search All Dates"*).
- **Mobile-First & Touch-Aware**: Responsive breakpoints (`sm:`, `md:`, `lg:`), minimum 44px touch targets on mobile, edge-swipe gestures, full-width modal/banner buttons on small screens.
- **Mobile Modal Navigation & Back-Trap Elimination**: Never trap mobile users in modal dialogs. Modals must include a sticky mobile header with `<ArrowLeft>` back button, sticky bottom dismiss bar, backdrop tap dismissal, and `Escape` keyboard shortcuts.
- **Horizontal Scroll Capsule Affordance**: Hidden scrollbars on pill/capsule strips must incorporate `ScrollAffordanceContainer` with visual edge gradient fades, dynamic overflow detection via `ResizeObserver`, and clickable left/right slide chevrons.
- **Export Period Scope Inheritance**: Export dialogs must inherit active page filters (`defaultPreset`, `initialDateRange`), compute date ranges with timezone-immune UTC arithmetic anchored to IST (`Asia/Kolkata`), and provide live scope feedback.
- **Defensive Client Engineering & Race Condition Immunity**: Eliminate all race conditions before coding. Abort out-of-order network responses (`AbortController` / TanStack Query), prevent double-trigger event races (`onMouseDown` vs `onClick`), lock rapid double-submits synchronously with `useRef`, and anchor asynchronous background updates (FIFO/batch allocation) to immutable unique IDs (`_rowId`) rather than transient array indexes. Memoize sorted lists with `useMemo`.
- **Scale, Virtualization & Anti-Stale Caching**:
  - Implement DOM virtualization (`@tanstack/react-virtual`, `VirtualizedList`/`InfiniteVirtualizedList`) for long collections (> 50 items).
  - Implement numbered pagination for dense administrative audits and infinite scroll / lazy loading for interactive lookups and mobile views.
  - **Operational Table Caching (`useSWR`)**: Tables (Employees, Inventory Ledger, Manual Entries, Referrals) must use `useSWR` with 30s TTL, Frame-0 `localStorage` pre-seeding to eliminate blank skeleton flashes, non-intrusive `<RefreshIndicator isRefreshing={isValidating} size="sm" showText />` in page headers, and automatic multi-tab cache invalidation (`BroadcastChannel`) across all mutation methods.
  - **Multi-Tab Analytics Caching (TanStack Query)**: Multi-tab analytics suites (Sales Analytics, Inventory Intelligence) must use `@tanstack/react-query` with `staleTime: 60000` to prevent tab-switching skeleton re-renders while allowing manual or filter-driven refetches.
- **Browser Subagent Restriction**: Never open Chrome or launch browser subagents to test frontend changes unless explicitly requested by the user.

### 3. Senior Backend Standards & Database Performance
- **Zero N+1 Queries**: Never query the database inside loops or `Array.map`. Always batch lookups using `$in` (e.g. `Session.find({ user: { $in: ids } })`) and resolve in-memory with $O(1)$ `Set` or `Map` lookups.
- **Atomic Concurrency & Zero Read-Modify-Write**:
  - Strictly forbid in-memory balance arithmetic and overwrite (`Customer.findOneAndUpdate({ outstandingBalance: newBalance })`). Concurrent requests will cause lost updates.
  - Always execute atomic mutations directly on the database engine using native atomic operators (`$inc: { outstandingBalance: -normalizedAmount }` or delta adjustments).
- **Auto-Retrying ACID Transactions**:
  - Multi-document operations spanning multiple collections (Payments, Invoices, Batches, StockMovements, Ledgers) must execute inside MongoDB ACID transactions using `session.withTransaction(async () => { ... })`.
  - Prefer `session.withTransaction` over manual transaction control: it automatically catches and retries `TransientTransactionError` and `WriteConflict` under concurrent access until commitment succeeds.
- **Dynamic Query Parity & Asynchronous Self-Healing**:
  - Single-entity lookups (`getCustomer`) MUST calculate live balances dynamically from active unpaid invoices, manual entries, and credit notes to guarantee 100% parity with collection lists (`getCustomers`) and the Ledger (`getCustomerLedger`).
  - If a single-entity lookup detects that stored summary fields have drifted from the real-time calculated total (`|stored - liveDue| > 0.01`), trigger an asynchronous background update (`Customer.updateOne(...).exec().catch(...)`) to self-heal the database document on read with 0ms latency added to the HTTP response.
- **Operational Search & Numeric Parsing**:
  - Use bounded substring contains matching (`containsPattern`) for human entities (customers, phones, notes, UTRs) guarded strictly with `tenantId` and `.limit(100)`.
  - Auto-detect numeric queries (`!isNaN(Number(query))`) to match exact numeric fields (`amount: Number(query)`).
  - Support date ceiling overrides (`isAllTime=true` / "All Dates") so live search can locate historical records outside the single-day default.
  - Maintain 100% parity between UI query logic and Export engines (`*ExportController.ts`).
- **User Preference Persistence**: Store UI preferences (`themeMode: ['dark', 'light', 'system']`) on `Admin` and `Employee` models and synchronize on authentication.
- **Thin Controllers & Scalable Services**: Keep controllers strictly as thin HTTP request/response handlers (< 80-100 lines). Encapsulate calculations, batch allocations, third-party integrations, and DB mutations in domain services (`*Service.ts`). Ensure 100% statelessness for horizontal clustering.
- **High-Performance MongoDB Aggregations**:
  - Always place `$match` (with `tenantId`) first to utilize B-Tree compound indexes.
  - Filter and sort in pipeline or in memory with strict mathematical tie-breakers before slicing. Never rely on MongoDB's natural storage order from `.find().lean()`.
- **Compound B-Tree Indexing**: Order compound indexes by **Equality → Sort → Range** (ESR rule): `{ tenantId: 1, isActive: 1, createdAt: -1 }`. Add indexes for high-throughput activity audits (`{ user: 1, userModel: 1, isActive: 1, lastActivityAt: -1 }`) and transactional searches (`{ tenantId: 1, referenceNumber: 1 }`).
- **Export Engine Formatting & Safeguards**: Format integer count metrics with zero decimals (`format: 'integer'`), auto-detect `Number.isInteger(num)` for `'number'` formats, enforce 404 guards when matching zero records, and bound all-time queries within the 365-day safety ceiling.

### 4. Strict Release & Versioning Lifecycle
- **Step 1 — Changelog First & Version Discipline**: Document changes under `## [vX.Y.Z](url)` in `CHANGELOG.md` with release date, categorized highlights, and specific file modifications. During an active development milestone on `dev`, do NOT invent new version headers (`v2.6.1`, `v2.6.2`) for intermediate fixes or sub-tasks before a production merge has occurred; group ongoing work under the milestone version. Maintain a strict **1:1 invariant between changelog headers and git tags** (zero untagged releases).
- **Step 2 — Update Documentation**: Update the version badge in `README.md`.
- **Step 3 — Legal & Policy Review**: Audit `PrivacyPolicyPage.jsx`, `TermsPage.jsx`, and SaaS subscription tiers whenever changes touch authentication, telemetry, data storage, or billing.
- **Step 4 — Build Verification**: Validate that both `npx tsc --noEmit` (backend) and `npm run build` (frontend) pass with 0 errors.
- **Step 5 — Git Flow & Production Merge Gate**:
  - **Dev Only by Default**: Split into multiple granular commits as needed per purpose (`fix(...)`, `feat(...)`, `docs(...)`, `chore(...)`) on `dev` and push **strictly to `dev`** (`git push origin dev`). In PowerShell, escape `$` or use single quotes `'...'` to avoid variable evaluation issues.
  - **Production Merge Gate (`master` is Production)**: NEVER merge into `master`, NEVER create version tags, and NEVER push `master` unless the user explicitly commands **"merge"** (or gives unambiguous approval to merge to production). Without the explicit "merge" command, stop after pushing to `dev`.
  - **Upon Explicit "merge" Command Only**:
    - Multi-Version Parity Audit: Check `git tag -l` against all unreleased versions in `CHANGELOG.md`. If multiple versions were added, every single version must be tagged at its corresponding commit.
    - Merge into `master`: `git checkout master && git pull origin master && git merge dev -m "..."` (Mandatory rich, multi-line message detailing problem, root cause, changes, new component rationale, and verification; no generic one-liners)
    - Signed tag(s): `git tag -s vX.Y.Z -m "Release vX.Y.Z - ..."` (plus tags for any untagged historical commits)
    - Push production to remote: `git push origin master; git push origin --tags`
    - Return to `dev`: `git checkout dev`
- **Step 6 — In-Chat Copy-Paste-Ready Release Notes**: When `master` is merged, tagged, and pushed, **output the complete, unabridged GitHub Release Notes directly inside a fenced markdown codeblock in the chat response** (never just link to an artifact file). Include the direct pre-filled GitHub release URL above the block. If multiple versions were merged, provide a dedicated link and codeblock for each version so the user can copy and paste with 1 click.
