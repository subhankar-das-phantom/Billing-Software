# Bharat Enterprise Billing System — Workspace Engineering Contract

This document governs all agent operations, architectural decisions, coding patterns, and release procedures for the **Bharat Enterprise Billing System** repository.

---

## 🏛️ Core Operational Protocols

### 1. Planning First & Iteration Protocol
- **Never jump straight into coding** for architectural changes, multi-file features, or significant bug fixes.
- **Produce an Implementation Plan** with problem analysis, root causes, proposed file-by-file changes, and a verification plan.
- **Multiple Review Iterations**: Refine the plan based on feedback, edge cases, and architectural constraints.
- **Proceed Only on Explicit Command**: Do NOT modify source code or run modifying commands until the user explicitly says **"code"**, **"proceed"**, or gives unambiguous approval.

### 2. Enterprise UI Excellence (Anti-"Vibecoding")
- **High-Density, High-Clarity SaaS Layouts**: No generic AI tropes, no oversaturated neon gradients, no floating unaligned cards, and no superficial "vibecoded" fluff.
- **Color Discipline**: Deep Slate (`slate-950`/`slate-900`/`slate-800`), crisp muted borders (`border-slate-800/80`), purposeful status colors (Emerald for positive/verified, Amber for warnings/buffers, Rose for critical stock/deadlines, Sky/Blue for informational actions).
- **Mobile-First & Touch-Aware**: Responsive breakpoints (`sm:`, `md:`, `lg:`), minimum 44px touch targets on mobile, edge-swipe gestures, full-width modal/banner buttons on small screens.
- **Defensive Client Engineering**: Memoize sorted lists with `useMemo`, debounce searches (250-400ms), and prevent double-trigger event race conditions (`onMouseDown` vs `onClick`).
- **Scale, Virtualization & Query State**: Implement DOM virtualization (`@tanstack/react-virtual`, `VirtualizedList`/`InfiniteVirtualizedList`) for long collections (> 50 items). Implement numbered pagination for dense administrative audits and infinite scroll / lazy loading for interactive lookups and mobile views. Manage server cache and deduplication with `@tanstack/react-query` or SWR.

### 3. Senior Backend Standards & Database Performance
- **Zero N+1 Queries**: Never query the database inside loops or `Array.map`. Always batch using `$in`, aggregated `$lookup`, or single-pass in-memory Maps.
- **High-Performance MongoDB Aggregations**:
  - Always place `$match` (with `tenantId`) first to utilize B-Tree compound indexes.
  - Filter and sort in pipeline or in memory with strict mathematical tie-breakers before slicing. Never rely on MongoDB's natural storage order from `.find().lean()`.
- **Compound B-Tree Indexing**: Order compound indexes by **Equality → Sort → Range** (ESR rule): `{ tenantId: 1, isActive: 1, createdAt: -1 }`.
- **Search & Concurrency**: Debounced inputs, sanitized regex escaping, prefix-indexed searches (`^query`), and atomic concurrency guards (`$inc` and `stockVersion`).

### 4. Strict Release & Versioning Lifecycle
- **Step 1 — Changelog First**: Document changes under `## [vX.Y.Z]` in `CHANGELOG.md` with release date, categorized highlights, and specific file modifications.
- **Step 2 — Update Documentation**: Update the version badge in `README.md`.
- **Step 3 — Legal & Policy Review**: Audit `PrivacyPolicyPage.jsx`, `TermsPage.jsx`, and SaaS subscription tiers whenever changes touch authentication, telemetry, data storage, or billing.
- **Step 4 — Build Verification**: Validate that both `npx tsc --noEmit` (backend) and `npm run build` (frontend) pass with 0 errors.
- **Step 5 — Git Flow**:
  - Commit to `dev`: `git commit -m "<type>(<scope>): <description>"`
  - Merge into `master`: `git checkout master && git merge dev -m "..."`
  - Signed tag: `git tag -s vX.Y.Z -m "Release vX.Y.Z - ..."`
  - Push to remote: `git push origin dev; git push origin master; git push origin vX.Y.Z`
