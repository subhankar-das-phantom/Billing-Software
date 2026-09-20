# Changelog

All notable changes to **Bharat Enterprise Billing System** are documented here.

For full release notes with implementation details, see [GitHub Releases](https://github.com/subhankar-das-phantom/Billing-Software/releases).

## [v2.5.4](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.5.4) — 2026-09-21 — Customer Balance Race Condition Elimination, MongoDB ACID Transaction Serialization, Dynamic Parity Self-Healing & Precision Formatting

### ⚡ Concurrency Safety, Parity & Audit Integrity
Version 2.5.4 eliminates lost-update race conditions on customer outstanding balances by migrating payment mutations to MongoDB multi-document ACID transactions with engine-level atomic decrements. It establishes 100% calculation parity between customer list, details, and ledger views via dynamic real-time aggregation and background self-healing, restores paise currency precision on customer detail cards, and introduces an administrative reconciliation CLI utility.

---

### 🛡️ Payment Mutation Concurrency & ACID Transactions (`paymentController.js`)
- **ACID Transaction Wrapping (`session.withTransaction`)** — Wrapped `createPayment`, `updatePayment`, and `deletePayment` in native MongoDB transaction sessions. Built-in `session.withTransaction` automatically catches and retries `TransientTransactionError` and `WriteConflict` under high concurrent load.
- **Database-Level Atomic `$inc` Decrements** — Eliminated the non-atomic in-memory read-modify-write pattern (`outstandingBalance: newBalance`). Balance reductions now execute via engine-level `$inc: { outstandingBalance: -normalizedAmount }` (and `$inc: { outstandingBalance: -delta }` for payment edits).
- **Atomic Invoice Paid Amount Updates** — Replaced absolute `Invoice.paidAmount` assignments with atomic `$inc: { paidAmount: normalizedAmount }`, preventing lost updates when split payments or multiple settlements hit the same invoice concurrently.
- **Concurrency Stress Tested** — Validated via a 10-simultaneous-payment simulation stress test on a multi-replica MongoDB cluster, achieving 10/10 successful operations with 0 lost updates.

---

### 🔄 Dynamic Query Parity & Background Self-Healing (`customerController.js`)
- **Real-Time Live Due Aggregation in `getCustomer`** — Upgraded `getCustomer` to calculate live due balances dynamically across open Credit invoices, manual opening balance entries, and credit notes, bringing the details view into 100% alignment with `getCustomers` and `getCustomerLedger`.
- **Asynchronous Document Self-Healing** — If `customer.outstandingBalance` stored in MongoDB drifts from real-time open invoices by more than ₹0.01, `getCustomer` triggers a non-blocking background update to heal the document.
- **Consistent Response Contract** — Standardized `customer.calculatedOutstanding`, `customer.outstandingBalance`, `summary.outstanding`, and `summary.balance` across all endpoints.

---

### 🎨 Financial Precision & Locale Formatting (`CustomerDetailsPage.jsx`)
- **Configurable Decimal Precision** — Upgraded `<AnimatedCounter />` to accept a `decimals` prop with Indian numbering locale formatting (`en-IN`).
- **Paise Precision on Stat Cards** — Configured `decimals={2}` on both Outstanding Balance and Total Purchases stat cards, preventing paise truncation (e.g. displaying ₹8,063.03 instead of ₹8,063).
- **Dynamic Field Fallback** — Bound the Outstanding header card to `summary.calculatedOutstanding ?? summary.balance ?? 0`.

---

### 🔧 Administrative Customer Balance Reconciliation CLI (`recalculateCustomerBalances.js`)
- **Idempotent Audit & Repair Script** — Created `backend/scripts/recalculateCustomerBalances.js` supporting `--dry-run`, `--fix`, and `--customerId=<id>` flags.
- **Reconciled Production Balance** — Resolved the historic +₹1,024.65 database drift for **SHRI DURGA MEDICAL** (`69525d923cbe2c10295198ff`), updating stored `outstandingBalance` from ₹7,038.38 to ₹8,063.03 with zero changes to underlying immutable invoices.

---

## [v2.5.3](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.5.3) — 2026-09-20 — Purchase Reports TanStack Caching, Activity Log Zero-Flicker & Employee Deep-Link Resolution, and Settings Instant Mount

### ⚡ Analytical Tab Caching & Operational Navigation Polish
Version 2.5.3 completes the multi-tab reporting and operational audit overhaul by establishing TanStack Query caching for the Purchase Reports suite, resolving the empty activity log state when deep-linking from employee profiles, introducing frame-0 SWR caching with 1-click time range fallbacks for the Activity Log, and removing artificial delay timers on the Settings page.

---

### 📊 Purchase Reports Tab Caching & Mutation Parity (`usePurchaseReportQueries.js`, `PurchaseReportsPage.jsx`, `purchaseService.js`)
- **TanStack Query Hooks** — Created dedicated query hooks (`usePurchaseSummaryQuery`, `useSupplierWisePurchasesQuery`, `useProductWisePurchasesQuery`) with `staleTime: 60000`, matching `salesAnalytics` and `inventoryAnalytics`.
- **Zero-Flicker Tab Switching** — Retains purchase report data in memory across tab navigation in the Reports & Intelligence Hub (`/reports`), displaying cached data on Frame 0 with zero skeleton flicker.
- **Header Refresh Indicator** — Integrated `<RefreshIndicator isRefreshing={isUpdating} size="sm" showText />` alongside a manual refresh button.
- **Reactive Cache Invalidation** — Configured `purchaseService.js` to automatically invalidate `['reports', 'purchases']`, `'purchases'`, and `'inventory-ledger'` caches across create, update, delete, complete, and cancel operations.

---

### 📋 Activity Log Zero-Flicker & Employee Deep-Link Resolution (`ActivityLogPage.jsx`, `employeeActivityService.ts`)
- **Eliminate Skeleton Reload on Revisit** — Migrated `ActivityLogPage.jsx` to `useSWR` with 30s TTL and frame-0 `localStorage` pre-seeding, ending repetitive skeleton sweeps on navigation.
- **Smart Employee Deep-Link Handling** — When navigating from an employee profile (`/activity-log?employee=<id>`), the page automatically targets the employee on the first network request (eliminating the double-fetch) and defaults `timeRange` to `'30d'` instead of strictly `'today'`, resolving the empty activity state when work occurred earlier in the month.
- **Contextual 1-Click Fallback Actions** — Empty activity states now provide 1-click fallback buttons: *`[Search Last 30 Days]`*, *`[Search All Time]`*, and *`[Clear Employee Filter]`*.
- **Backend All-Time Range Support** — Expanded `parseActivityTimeRange` in `employeeActivityService.ts` to support `'all'` / `'alltime'` / `'90d'` with a safe 90-day ceiling.

---

### ⚙️ Settings Page Zero-Delay Instant Rendering (`SettingsPage.jsx`)
- **Eliminate Artificial 400ms Delay** — Removed the legacy `setTimeout` delay in `SettingsPage.jsx` that artificially displayed `<SettingsPageSkeleton />` for 400ms on every mount.
- **Instant Frame-0 Mount** — Initialized loading state to `!user`, rendering settings immediately in 0ms when authentication state is already resolved in `AuthContext`.

---

## [v2.5.2](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.5.2) — 2026-09-20 — Operational Cache Synchronization, Frame-0 SWR Pre-seeding, TanStack Query Inventory Analytics & Runtime Identifier Safety

### ⚡ Operational Cache Synchronization & Zero-Skeleton-Flicker Architecture
Version 2.5.2 resolves runtime reference errors and eliminates repetitive skeleton flashes across core operational and analytical interfaces by implementing an anti-stale caching architecture. Combining custom `useSWR` with `localStorage` frame-0 pre-seeding and TanStack Query caching, pages now render instantaneous cached views on navigation while continuously synchronizing in the background. Cross-tab cache invalidation via `BroadcastChannel` guarantees operational consistency when records are modified or created.

---

### 🛡️ Runtime Identifier Safety & Codebase AST Audit (`CreditsPage.jsx`, `PageTransition.jsx`, `ManualEntriesPage.jsx`, `InventoryIntelligenceSection.jsx`)
- **Fix CreditsPage ReferenceError** — Added missing `RefreshIndicator` import in `CreditsPage.jsx` (`import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';`), resolving the uncaught runtime error upon navigating to `/credits`.
- **Fix PageTransition Identifier Typo** — Corrected undefined `transitionConfigs.smooth` reference in `PageTransition.jsx` line 360 to `desktopConfigs.smooth`.
- **Fix ManualEntriesPage Duplicate Identifiers** — Removed legacy duplicate `useState` declarations (`entries`, `loading`, `totalPages`, `total`) in `ManualEntriesPage.jsx` that conflicted with `useSWR` data bindings.
- **Fix InventoryIntelligenceSection Syntax** — Terminated lucide-react import list properly before external formatter imports.
- **Full Frontend AST Identifier Audit** — Scanned all 181 frontend source files with a custom Babel AST traversal script, confirming 0 undeclared variables, 0 missing JSX components, and 0 unbound references.

---

### 👥 Employee Management Zero-Flicker & Cache Parity (`EmployeesPage.jsx`, `EmployeeDetailPage.jsx`, `EmployeeAnalyticsPage.jsx`, `employeeService.js`)
- **Frame-0 SWR Pre-seeding** — Migrated `EmployeesPage.jsx` to `useSWR` (`employees-list-${debouncedSearch}-${statusFilter}`) with 30s TTL, rendering instant cached directory entries without blank state flicker.
- **Header Refresh Indicator** — Integrated `<RefreshIndicator isRefreshing={isValidating} size="sm" showText />` into the employee management header for subtle validation feedback without layout shifts.
- **Synchronous Computed Stats** — Derived active employee counts and total generated sales directly from SWR state via `useMemo`.
- **Reactive Mutations & Multi-Tab Broadcast** — Added automatic `invalidateCachePattern('employees')` and `invalidateCachePattern('employee')` to `employeeService.js` on employee creation, updates, status toggles, password resets, and permission changes.
- **Detail & Analytics SWR Integration** — Updated `EmployeeDetailPage.jsx` and `EmployeeAnalyticsPage.jsx` to leverage SWR caching for instant profile visits, comparison windows, and session logs.

---

### 📦 Inventory Ledger & Manual Entries Synchronization (`InventoryLedgerPage.jsx`, `ManualEntriesPage.jsx`, `manualEntryService.js`)
- **Instant Ledger Navigation** — Connected `InventoryLedgerPage.jsx` to `useSWR` (`inventory-ledger-movements-...`) with 30s TTL, eliminating recurring skeleton sweeps on stock movement reviews.
- **Manual Entries Cache Pipeline** — Wired `ManualEntriesPage.jsx` to `useSWR` (`manual-entries-...`) with pagination, debounced query keys, and silent background revalidation.
- **Cross-Domain Cache Purging** — Instrumented `manualEntryService.js` to purge `manual-entries`, `customers`, `dashboard`, and `inventory-ledger` caches automatically on entry creation, payment recording, and deletions.

---

### 📊 TanStack Query Inventory Intelligence (`useInventoryIntelligenceQueries.js`, `InventoryIntelligenceSection.jsx`)
- **Domain Architectural Parity** — Created TanStack Query hooks (`useBatchExpiryQuery`, `useProductVelocityQuery`, `useStockRiskQuery`, `useSupplierProcurementQuery`) with `staleTime: 60000` for Reports inventory analytics, matching `features/salesAnalytics`.
- **Tab Switching Immobility** — Preserved analytics data in memory across tab switches in `ReportsPage.jsx`, ending unseeded skeleton pop-ins while maintaining manual refresh controls.

---

### 🎁 Referral System Caching (`ReferralPage.jsx`)
- **Dual SWR Pipeline** — Converted `ReferralPage.jsx` referral code generation and analytics statistics to `useSWR` with silent revalidation and header refresh indicators.

---

## [v2.5.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.5.1) — 2026-09-20 — Native Document-Root Scrolling, Sticky Header Docking, Mobile Desktop Zoom Ergonomics & Card Payment Visibility

### 📱 Layout Architecture, Native Document Scrolling & Mobile Card Financial Ergonomics Milestone
Version 2.5.1 unifies the application's layout architecture by transitioning from a nested `<main>` scroll container to native document-root scrolling (`window` / `<html>`) paired with sticky header docking (`sticky top-0 z-30`). It removes the application's nested main vertical scrolling context that was contributing to the mobile Desktop-mode single-finger zoom lock, restores the document scroll extent required for native Chromium Long Screenshots ("Capture more"), reclaims 60–80px of mobile screen estate through native address bar retraction, preserves forward/back scroll position on `POP` navigation, establishes a deterministic 3-tier scroll parent resolution model, and swaps the financial payment status into the collapsed customer invoice card view for instant operational visibility.

---

### 🏛️ Native Document-Root Scrolling & Sticky Docking (`index.html`, `DashboardLayout.jsx`)
- **Document Root Primary Scroller** — Replaced `height: 100%; overflow: hidden;` on `html, body, #root` and the outer layout shell with `min-height: 100%; height: auto;`, establishing the document root as the primary vertical scrolling context.
- **Docked Non-Scrolling Top Header** — Positioned `<Header>` with `sticky top-0 z-30 w-full bg-slate-950/95 border-b border-slate-800` in natural document flow. The header and hamburger menu button (`☰`) remain permanently docked at `top: 0` throughout scrolling, guaranteeing navigation is always accessible.
- **Sticky Desktop Sidebar** — Positioned the desktop sidebar rail with `sticky top-0 h-screen z-20 shrink-0` to remain docked beside the main document column.
- **Ancestor Scroll Invariant** — Enforced that no layout ancestor of the primary application content may establish an unintended vertical scrolling context (`overflow-y: auto`, `overflow-y: scroll`, or `overflow: hidden`).
- **Natural Document Flow for `<main>`** — Removed `overflow-y-auto`, `overflow-x-hidden`, and `overscroll-y-contain` from `<main>`, converting it to a natural document flow container (`flex-1 min-w-0 bg-slate-950`).
- **Mobile Screen Estate Recovery** — Reclaims 60–80px of vertical viewing space on mobile Chrome and Safari as native document scrolling permits the browser URL omnibox to auto-retract on downward scroll.
- **Direction-Aware Window Scroll-to-Top** — Updated `useScroll` listener and `handleScrollToTop` to track `window.scrollY` and execute `window.scrollTo({ top: 0, behavior: 'smooth' })` with Clamp & Glide for large lists.
- **Smart Navigation Scroll Restoration (PUSH vs. POP)** — Leveraged React Router's `useNavigationType()` to reset scroll position to `(0, 0)` on fresh forward navigation (`PUSH` / `REPLACE`), while allowing natural browser scroll restoration when navigating back/forward (`POP`).

---

### 📜 Deterministic 3-Tier Scroll Parent Resolution (`scrollUtils.js`, `Sidebar.jsx`, `DashboardLayout.jsx`)
- **Explicit Container Matching** — Replaced dynamic overflow inspection heuristics in `findScrollParent(node)` with a deterministic 3-tier hierarchy:
  1. *Explicit Semantic Modals*: Nodes with `role="dialog"` or `.modal-body`.
  2. *Explicit Intentional Scrollers*: Elements carrying the `data-scroll-container` attribute.
  3. *Primary Document Fallback*: `document.scrollingElement || document.documentElement`.
- **Drawer Explicit Participation** — Added `data-scroll-container` to the `<nav>` scroll body in `Sidebar.jsx` and `role="dialog" aria-modal="true"` to the mobile drawer panel in `DashboardLayout.jsx`, ensuring drawer navigation never falls through to the document root.
- **Viewport Root IntersectionObserver** — When `scrollRoot` resolves to the document element, `useInfiniteScrollSentinel` passes `root: null` to `IntersectionObserver`, anchoring detection directly to the browser viewport.
- **Window Target Abstraction** — Bound the secondary fast-scroll listener to `window` whenever the root scroller is the document, seamlessly measuring `document.scrollingElement` scroll height and window scroll offsets.

---

### 🛡️ Table Touch & Overflow Refinement (`index.css`)
- **Vertical Touch Passage** — Replaced `overflow-y: hidden !important;` on `[data-horizontal-table-scroll="true"]` with `overflow-x: auto; touch-action: auto;`. Eliminates touch-action conflict over wide desktop tables so vertical gestures bubble naturally to document scrolling while preserving horizontal table panning.

---

### 💳 Customer Card Financial Status Visibility (`CustomerDetailsPage.jsx`)
- **Collapsed Header Payment Status** — Swapped document status (`Printed` / `Created`) with financial `paymentStatus` (`Partial (₹354.57)`, `Paid`, `Unpaid`) on collapsed mobile invoice cards. Operators can verify balances at a glance without having to expand every card.
- **Strict Cancellation Guard** — Preserved cancellation priority: cancelled invoices display the `Cancelled` badge in red regardless of payment calculations.
- **Expanded Document Details** — Moved document status badge (`statusConfig[invoice.status]`) into the expanded details row alongside item count (`2 items`).

---

### 🐛 Resilient Search Debouncing & Runtime TypeError Elimination (`InventoryIntelligenceSection.jsx`, `useDebounce.js`, `GstReportPage.jsx`)
- **Tuple Destructuring Correction** — Corrected search hook destructuring in `InventoryIntelligenceSection.jsx` (`[debouncedRiskSearch]`, `[debouncedVelocitySearch]`, `[debouncedProcurementSearch]`). Previously, assigning the tuple array `[debouncedValue, flush]` directly caused `Array.prototype.trim` undefined lookups, throwing `Uncaught TypeError: se.trim is not a function` during `useMemo` evaluation.
- **Hook Self-Healing Resilience** — Enhanced `useDebounce.js` return tuple with defensive string delegates (`.trim()`, `.toLowerCase()`, `.toUpperCase()`) whenever `debouncedValue` is a string, immunizing the application against accidental non-destructured hook assignments.
- **Filter Query Optimization** — Moved `rawSearch.trim().toLowerCase()` computation outside the item iteration loops in `displayedVelocityFast`, `displayedVelocitySlow`, and `displayedSuppliers`, avoiding $O(N)$ redundant string lowercasing per filter run.
- **Defensive String Handling** — Hardened `debouncedProductSearch` handling in `GstReportPage.jsx` to safely handle non-string and nullish values.

---

### 👆 Unified Touch Gesture Navigation & Mobile Zoom Isolation (`DashboardLayout.jsx`)
- **Visual Viewport Zoom Immunity** — Guarded edge gestures with `window.visualViewport.scale > 1.05`. When pinch-zoomed in on mobile devices (including Desktop Site mode), all 1-finger horizontal and vertical drags are reserved 100% for native browser viewport panning, completely preventing accidental sidebar/drawer pop-ins while magnified.
- **Universal Viewport Support (Mobile & Desktop Site)** — Re-enabled intuitive right-swipe across all viewport tiers: on mobile/tablet, expands the drawer navigation; on desktop and mobile Desktop Site viewports, expands the collapsed sidebar rail; left-swipe cleanly collapses or closes overlays.
- **Ergonomic Natural Thumb Edge Zone** — Calibrated the edge trigger zone to `touchStartX <= Math.max(110, window.innerWidth * 0.28)` or top header bar (`touchStartY <= 80`), avoiding OS-level system back gesture conflicts while providing fluid, reliable thumb activation.
- **Dual-Trigger Sweet Spot Kinematics** — Calibrated gesture mechanics to a balanced sweet spot with dual triggers: quick light flick ($\Delta X \ge 30\text{px}$ in $\le 350\text{ms}$) or relaxed thumb glide ($\Delta X \ge 45\text{px}$ in $\le 1200\text{ms}$), paired with natural thumb-arc angular tolerance ($|\Delta X| \ge 0.9 \times |\Delta Y|$) and relaxed vertical scroll lockout ($|\Delta Y| > 50\text{px}$ and $|\Delta Y| > 1.8 \times |\Delta X|$). Eliminates forced high-acceleration swipes while preserving 100% zoom immunity.

---

## [v2.5.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.5.0) — 2026-09-19 — Infinite Scroll Resilience, Deterministic Pagination, Lightweight CSS Navigation & 1,000+ Item Scale Stability

### ⚡ Enterprise-Scale Infinite Scroll, Deterministic Pagination & GPU-Optimized Navigation Milestone
Version 2.5.0 delivers a comprehensive reliability and performance overhaul for high-velocity scrolling, large datasets (1,000+ items), and multi-tenant pagination correctness. It resolves critical backend pagination non-determinism caused by missing sort tiebreakers on batch-seeded data, eliminates infinite scroll stalls from destructive geometric state overwrites, adds a passive high-velocity scroll listener so rapid flicks never miss pagination triggers, replaces heavy Framer Motion scroll button physics with lightweight 60fps GPU-composited CSS transitions, removes ghost padding from virtualized containers, introduces the **Clamp & Glide** pattern for seamless scroll-to-top across 50,000px+ datasets, resolves desktop-on-mobile viewport blowout, and increases API rate-limit headroom to support high-throughput SPA navigation patterns.

---

### 🏛️ Dual-Trigger Infinite Scroll Resilience (`scrollUtils.js`)
- **Stuck-State Elimination & Destructive Guard Removal** — Removed the manual `setIsIntersecting(false)` override inside the post-layout geometric guard that desynchronized React state from native browser `IntersectionObserver` state and prevented pagination from re-triggering until an artificial scroll-up/scroll-down sequence was performed.
- **Secondary Fast-Scroll Container Trigger** — Added a passive `scroll` listener on `scrollRoot` (`<main>`) that calculates `scrollHeight - (scrollTop + clientHeight) <= 600px` on high-velocity mousewheel flicks or scrollbar thumb dragging, guaranteeing that fast scrolling never outruns pagination triggers.
- **Expanded 600px Look-Ahead Root Margin** — Expanded `INFINITE_SCROLL_ROOT_MARGIN` from `250px` to `600px`, preloading subsequent pages well before the user reaches the end of the content.
- **Post-Fetch Layout Continuation** — When a page completes loading (`isFetching` transitions to `false`), if the user is still within 600px of the bottom (or on tall displays where items don't fill the vertical space), automatically queues the next page after a 60ms layout settlement window.

---

### ⚡ VirtualizedList Container Height Stabilization & Small-Dataset Fix (`VirtualizedList.jsx`)
- **Container Height Stabilization & Small-Dataset Fix** — Set container `style.height` in `VirtualizedList` and `VirtualizedGrid` to `virtualizer.getTotalSize()` directly. Previously, subtracting `scrollMargin` collapsed container height to 0px whenever cumulative item height was smaller than the scroll offset from `<main>` (e.g., small datasets of 8 items), hiding rows under `overflow-y: hidden`. TanStack Virtual's `getTotalSize()` represents exact cumulative item dimensions without `scrollMargin`.
- **Item Measurement Cache Preservation** — Removed the redundant `virtualizer.measure()` call on `items.length` changes, preserving TanStack Virtual's cached row dimensions across infinite scroll appends and eliminating layout thrashing when scaling to 1,000+ items.
- **Buffer Overscan Increase** — Raised `DEFAULT_OVERSCAN` from 10 to 12 items for seamless row pre-rendering during high-velocity scrolling.

---

### 🧭 Lightweight Scroll-to-Top Button & Clamp & Glide Pattern (`DashboardLayout.jsx`)
- **GPU-Composited CSS Transitions (Anti-Lag)** — Replaced heavy Framer Motion `<AnimatePresence>` and `<motion.button>` scale/translate physics with a persistent semantic `<button>` powered by pure hardware-accelerated CSS transitions (`transition-all duration-150 ease-out will-change-transform`), eliminating main-thread contention while scrolling.
- **Direction-Aware Scroll-to-Top Gating** — Automatically hides the button when the user scrolls downwards (`currentScrollTop > lastScrollTop + 6`), smoothly revealing it exclusively when scrolling upwards (`currentScrollTop < lastScrollTop - 6`), and hiding it near the top (`currentScrollTop < 250px`).
- **Clamp & Glide Pattern for 1,000+ Items** — For large lists (`scrollTop > 1200px`, e.g. 1,000+ items / 50,000px+), instantly clamps `scrollTop` to a near-top buffer (350px) before smoothly gliding the remaining distance to `top: 0` in the next animation frame, preventing browser thread freezes and mid-scroll stalling.
- **Immediate State Dismissal** — Immediately resets `setShowScrollTop(false)` and `lastScrollTopRef.current = 0` upon click, eliminating button flickering during the return animation.

---

### 🛡️ Spurious Table Vertical Scrollbar Suppression (`index.css`, `InvoicesPage.jsx`, `PurchasesPage.jsx`, `ProductsPage.jsx`, `CustomerDetailsPage.jsx`, `SupplierDetailsPage.jsx`)
- **Implicit Promotion Elimination** — Enforced a global rule in `index.css` (`[data-horizontal-table-scroll="true"] { overflow-y: hidden !important; }`) to neutralize W3C CSS Overflow Module Level 3 (§3.3) behavior, where specifying `overflow-x: auto` implicitly promotes `overflow-y` to `auto` and triggers a secondary vertical scrollbar inside the table.
- **Scrollbar Box Intrusion & Subpixel Row Isolation** — Prevented the 6px-17px horizontal scrollbar gutter and virtualized row subpixel anti-aliasing offsets from spawning nested double-scrollbars on desktop viewports.
- **Explicit JSX Class Pairing** — Paired `overflow-x-auto overflow-y-hidden` across desktop table wrappers in `InvoicesPage.jsx`, `PurchasesPage.jsx`, `ProductsPage.jsx`, `CustomerDetailsPage.jsx`, and `SupplierDetailsPage.jsx`.

---


### 🛡️ Deterministic Pagination & Sort Tiebreakers (`productController.js`, `productExportController.ts`, `buildCustomerFilter.ts`, `Product.js`)
- **`_id` Sort Tiebreaker for Skip/Limit Correctness** — Added `{ createdAt: -1, _id: -1 }` compound sort to product pagination aggregation pipelines and product export queries. Without a unique tiebreaker, batch-seeded products sharing identical `createdAt` timestamps produced non-deterministic MongoDB sort order, causing `skip(N)` to re-visit or skip documents across pages — manifesting as the 886/1,000 product cutoff on infinite scroll.
- **Compound B-Tree Index (ESR Rule)** — Added `{ tenantId: 1, isActive: 1, createdAt: -1, _id: -1 }` compound index to the `Product` model, following Equality → Sort → Range ordering for optimal index utilization during sorted pagination with tenant isolation.
- **Customer Sort Consistency** — Extended `buildCustomerFilter.ts` sort builder with `_id: -1` tiebreaker to prevent identical issues on customer collections.

---

### 🚦 API Rate-Limit Headroom (`server.js`)
- **General Limiter Increase** — Raised `generalLimiter` from 500 to 3,000 requests per 15 minutes (5,000 in development) to accommodate high-throughput SPA navigation patterns: infinite scroll pagination, dashboard polling, and rapid filter/search cycles that collectively exhaust low rate-limit budgets and trigger HTTP 429 errors.

---

### 🏛️ Semantic Horizontal Table Scroll & Container Isolation (`scrollUtils.js`, `InvoicesPage.jsx`, `PurchasesPage.jsx`, `ProductsPage.jsx`, `SuppliersPage.jsx`, `SupplierDetailsPage.jsx`, `CustomerDetailsPage.jsx`)
- **Horizontal Table Scroll Marker (`data-horizontal-table-scroll="true"`)** — Introduced a standardized semantic attribute on horizontal scrollable desktop table wrappers (`w-full overflow-x-auto`), isolating them from DOM vertical scroll container resolution.
- **Table Container Blowout Elimination** — Enforced a strict two-layer architecture (`<div className="glass-card w-full overflow-x-auto" data-horizontal-table-scroll="true"><div className="min-w-[800px]">{/* table */}</div></div>`). Prevents `min-w-[800px]` from expanding outer containers on ~390px mobile viewports and clipping centered loaders off-screen.
- **External Persistent Sentinels** — Anchored all infinite scroll loader sentinels strictly outside the `min-w-[800px]` horizontal scroll container, guaranteeing full-viewport centering and visibility regardless of horizontal pan position.

---

### 📜 Shared Scroll Parent Resolution & Virtualization Parity (`scrollUtils.js`, `VirtualizedList.jsx`)
- **Centralized `findScrollParent(node)` Primitive** — Unified scroll container detection across `@tanstack/react-virtual` and all `IntersectionObserver` implementations. Checks for vertical overflow (`scrollHeight > clientHeight + 4`) and vertical scroll intent (`overflow-y: auto | scroll`), skipping elements marked with `data-horizontal-table-scroll="true"`.
- **Nested Modal Precedence** — Ensures that table and list containers inside dialog modals resolve to their enclosing modal scroll body instead of blindly falling back to the top-level `<main>` container.
- **Constants Centralization** — Exported `INFINITE_SCROLL_ROOT_MARGIN = '250px'` and `INFINITE_SCROLL_THRESHOLD = 0` to standardize pre-fetching thresholds across all paginated entities.

---

### ⚡ Defensive Infinite Scroll Engine & Lifecycle Concurrency (`InvoicesPage.jsx`, `CustomersPage.jsx`, `PurchasesPage.jsx`, `ProductsPage.jsx`, `SuppliersPage.jsx`, `CreditsPage.jsx`)
- **Query Key Provenance Stamping** — SWR fetchers inject `_queryKey` and `_page` directly into cached payloads. Inbound responses verify `data._queryKey === activeQueryKeyRef.current`, dropping stale or out-of-order page deliveries from rapid search/filter changes.
- **Synchronous Request Lock (`isFetchingRef`)** — Replaced asynchronous render-time mutations with an event-time synchronous lock triggered in `loadNextPage()`. Locks release strictly upon page-matching data arrival (`data._page === pendingPageRef.current`) or on SWR fetch error (`swrError`).
- **Dynamic `scrollRoot` Re-Resolution** — Dynamically recalculates the genuine vertical scroll parent on viewport resize or layout changes, re-binding `IntersectionObserver` without thrashing.
- **Persistent Sentinel Containers** — Replaced unmounting sentinel wrappers with permanently mounted DOM targets that toggle inner loader visibility smoothly (`hidden pointer-events-none` only when `!hasMore`), eliminating observer disconnect/reconnect loops.
- **Missing Pagination Observer Target Hookup (`ProductsPage.jsx`)** — Passed `observerTarget={sentinelRef}` to `ProductsTable` and wired persistent loader sentinels, fixing missing "Loading more" indicators on inventory product audits.

---

### 🧭 Smart Bidirectional Scroll Navigation (`DashboardLayout.jsx`)
- **Context-Aware Direction Toggle** — Upgraded the floating navigation pill to detect user scroll position: displays "Scroll to bottom" with `<ArrowDown />` when near the top (`scrollTop < 120px` and page is sufficiently long), seamlessly switching to "Scroll to top" with `<ArrowUp />` once scrolled down.
- **Bottom Offset Clearance** — Automatically elevates the floating button when approaching the bottom of the page (`bottom-20` on mobile, `bottom-8` on desktop) to prevent obscuring pagination bars, totals summary strips, or mobile sticky action bars.

---

### 🚀 Mobile GPU Scroll Performance & Hover De-tuning (`index.css`)
- **Backdrop Blur Elimination** — Replaced GPU-heavy `backdrop-blur-xl` and `backdrop-blur-md` on `.glass-card`, `.stat-card`, and modal backdrops with high-density Enterprise Obsidian styling (`bg-slate-900/90 border border-slate-800/80 shadow-lg`), eliminating mobile rasterization thrashing.
- **Touch Hover De-tuning** — Added `@media (hover: none) and (pointer: coarse)` to suppress hover transforms (`translateY`, scale) and hover glow effects during touch drag gestures, ensuring silky 60 FPS scrolling on mobile devices running desktop view.

---

## [v2.4.4](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.4.4) — 2026-09-19 — Single-Scroll Container Architecture, Mobile Header Docking & Hamburger Accessibility

### 📱 Layout Architecture, Viewport Boundaries & Mobile Navigation Resilience Milestone
Version 2.4.4 establishes an unambiguous single-scroll-container architecture across the entire application shell. It resolves a critical mobile accessibility defect where scrolling down long collection views (such as the Invoices page) caused the top header and its hamburger navigation button (`☰`) to scroll out of view, trapping operators and forcing them to scroll all the way back to the top of the screen to access navigation.

---

### 🏛️ Single-Scroll Container Architecture (`DashboardLayout.jsx`, `Header.jsx`, `index.html`)
- **Sole Scroll Container (`<main>`)** — Enforced `flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain` on `<main>`, declaring it as the single vertical scroll owner throughout the application.
- **Dynamic Viewport App Shell (`100dvh`)** — Anchored the application shell to `h-screen h-[100dvh] overflow-hidden` and added `min-h-0` to the flex column (`min-w-0 min-h-0 h-full overflow-hidden`), eliminating `min-height: auto` flexbox expansion and document-level window scroll bleed.
- **Document Root Available Height (`index.html`)** — Specified `height: 100%` alongside `min-height: 100%` and `margin: 0` on `html, body, #root` to establish a bounded canvas.
- **Non-Scrolling `shrink-0` Top Header (`Header.jsx`)** — Eliminated ambiguous and redundant `sticky top-0` positioning from both the header wrapper and `<header>`. Because the header sits strictly outside `<main>` as a flex sibling (`shrink-0 w-full z-30`), it naturally remains permanently docked at the top of the screen across all mobile and desktop viewports without participating in content scrolling.
- **Scroll Chaining Containment** — Added `overscroll-y-contain` to `<main>` to prevent touch momentum swipes from chaining to ancestor scroll containers where supported.

---

## [v2.4.3](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.4.3) — 2026-09-19 — Progressive Disclosure Mobile Cards, User Card View Preferences, Navigation Scroll Anchoring & Modal Address Search

### 📱 Mobile Information Architecture, Dynamic Density & Ergonomic Navigation Milestone
Version 2.4.3 introduces a major mobile user experience overhaul by eliminating visual maximalism across small displays (< 768px). Financial records (Invoices, Collections, Customer Ledgers, and Payments) now render in a high-density, compact summary view by default with an accessible expand arrow to reveal secondary details on demand. This behavior is dynamically configurable per user in Settings with instant Frame-0 client caching. Additionally, this release fixes cross-page scroll retention, streamlines the scroll-to-top button with zero animation overhead, and surfaces customer addresses directly in payment collection workflows.

---

### 🗂️ Reusable Progressive Disclosure Card Primitive (`CollapsibleMobileCard.jsx`)
- **Compact Default Target (~78px)** — Eliminates excessive mobile vertical scrolling by rendering clean, condensed summary cards displaying primary identifiers (Entity ID, Customer, Date, Net Amount, and Status Badge).
- **Dedicated Accessible Toggle Button** — Features an un-nested, accessible chevron button (`min-w-[44px] min-h-[44px]`) equipped with `aria-expanded`, `aria-controls`, and `aria-label`.
- **Zero-Nesting Conflict Guard** — Clickable links (e.g. `<Link to="/invoices/:id">`) and interactive action buttons sit outside the toggle trigger. Neutral header clicks toggle expansion while clicks on links and action buttons execute independently without event interference.
- **Zero-Jitter Instant DOM Disclosure** — Avoids heavy layout/transform animations during expansion to ensure `@tanstack/react-virtual` measures element heights naturally on Frame 0 with zero coordinate drift or subpixel jitter.

---

### 🌐 Universal Mobile Progressive Disclosure Rollout (`InvoicesPage.jsx`, `CollectionsPage.jsx`, `CustomerDetailsPage.jsx`, `CreditsPage.jsx`)
- **Invoices Page** — Compact summary with dynamic virtualization sizing (`estimateSize: 78px` compact vs `220px` expanded); reveals customer phone, item count, payment method, and "View Details" button on expansion.
- **Collections Page** — Compact summary (~78px) with customer name, amount, method pill, and time; reveals phone, invoice link / manual entry badge, UTR copy button, cashier attribution, and receipt slip modal action on expansion.
- **Customer Details Page**:
  - **Invoices Tab**: Compact card (~78px) revealing item counts, partial due amounts, and direct payment recording.
  - **Payments Tab**: Compact card (~76px) revealing payment type, UTR reference, and administrator Edit/Delete controls.
  - **Customer Ledger Tab**: Compact card (~78px) displaying transaction ref and running balance (Dr/Cr); reveals payment mode, notes, and 3-column Debit / Credit / Balance financial breakdown on expansion.
- **Credit Notes Page** — Responsive desktop horizontal row vs mobile compact card with collapsible details for recent payments.

---

### ⚙️ User Preferences & Frame-0 Client Cache (`Admin.js`, `Employee.js`, `authController.js`, `AuthContext.jsx`, `SettingsPage.jsx`)
- **Backend Schema & Validation** — Added `mobileCardDensity: { type: String, enum: ['compact', 'expanded'], default: 'compact' }` to `preferences` on both `Admin` and `Employee` models, with strict HTTP 400 Bad Request validation in `updatePreferences`.
- **Instant Frame-0 Client Pre-seeding** — Synchronizes authenticated density preference with `localStorage.getItem('bharat_mobile_card_density')` on auth check and login, eliminating delayed layout pop-in shifts on page load.
- **Settings UI & Optimistic Updates** — Added a friendly "Mobile Card View" selector in Settings Preferences with optimistic client updates, non-technical explanations, and strict rollback on API error.

---

### 🧭 Navigation Scroll Anchoring & Direction-Aware Controls (`DashboardLayout.jsx`)
- **Route-Change Scroll Reset** — Fixed an issue where navigating between pages (e.g., from Invoices to Settings) preserved the scrollbar position of the previous page. Automatically resets `mainRef.current.scrollTop = 0` on every `location.pathname` change and anchors to the top via `requestAnimationFrame`.
- **Zero-Overhead Scroll-To-Top Button** — Streamlined the scroll button to hide on downward scroll and appear on upward scroll, lifting near the bottom to keep pagination bars unobstructed. Removed heavy Framer Motion animations and backdrop filters to eliminate scroll stutter and frame drops.

---

### 📍 Customer Address Display & Search in Collections (`RecordPaymentModal.jsx`, `customerController.js`, `buildCustomerFilter.ts`)
- **Address in Payment Modal** — Displays customer billing addresses with a `<MapPin />` icon in customer search results and selected customer cards for quick physical verification during payment collection.
- **Backend Address Search** — Added substring contains regex matching over `address` in `customerController.js` and `buildCustomerFilter.ts`.

---

## [v2.4.2](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.4.2) — 2026-09-13 — Universal Search Debouncing, Zero-CLS Subscription Banner, Collections Search Unification & N+1 Query Elimination

### ⚡ Enterprise Performance, Search Architecture & Layout Stability Milestone
Version 2.4.2 delivers a critical performance and reliability upgrade across both backend data layers and frontend user experience. It eliminates continuous DOM layout reflow thrashing caused by animated banner springs, eliminates an N+1 database bottleneck in employee session status resolution, standardizes 250–300ms debouncing across all application search inputs to prevent keystroke network spam, and unifies the Collections search engine to transcend single-day boundaries with full multi-field partial matching and zero-decimal numeric amount search.

---

### 🚀 Elimination of Zero-CLS Notification Banner Lag (`SubscriptionBanner.jsx`, `SubscriptionContext.jsx`)
- **Zero-Reflow GPU Acceleration** — Eliminated continuous DOM layout recalculations caused by Framer Motion's `animate={{ height: 'auto' }}` spring oscillation across the entire page (Recharts SVG graphs, KPI cards, tables). Replaced with GPU-accelerated opacity and subtle Y-translation (`duration: 0.15s, ease: [0.16, 1, 0.3, 1]`) with explicit `will-change: transform, opacity`.
- **Instant Frame-0 Cache Mounting** — Pre-seeded subscription context from `localStorage.getItem('cached_subscription')`. Accounts in grace period render the notification banner immediately on initial frame mount, eliminating delayed 300ms pop-in layout shifts.
- **Session Dismissal Persistence** — Preserves temporary user dismissals across navigation within the active session (`sessionStorage`), suppressing redundant re-animation on route changes.
- **Lightweight Micro-Interactions** — Replaced nested Framer Motion interactive button wrappers with native hardware-accelerated CSS active transforms (`active:scale-95`).

---

### 🔍 Unified Enterprise Search & Universal Debouncing (`CollectionsPage.jsx`, `paymentController.js`, `collectionExportController.ts`, `useDebounce.js`, `EmployeesPage.jsx`, `ManualEntriesPage.jsx`, `ActivityLogPage.jsx`, `InventoryIntelligenceSection.jsx`)
- **Collections Multi-Field Partial Matching** — Upgraded backend customer search from anchored prefix regex (`^query`) to substring contains matching (`containsPattern`), enabling searches by customer last name or partial phone digits. Added partial matching on `invoiceSnapshot.invoiceNumber` and exact numeric query matching on `amount`.
- **Date Boundary Override & "All Dates" Preset** — Added `isAllTime=true` support and an "All Dates" preset pill to the Collections view, allowing searches across historical records outside the default single-day boundary. Integrated an empty-state action button (*"Search All Dates"*) when 0 results match the current date.
- **100% Export-to-UI Parity** — Applied identical multi-field search and date override logic to `collectionExportController.ts`, ensuring exported Excel/PDF reports match screen results precisely.
- **Universal Search Debouncing** — Tuned default delay in `useDebounce.js` from 500ms to 300ms for instantaneous feel. Debounced keystrokes across:
  - **Collections Page** (`CollectionsPage.jsx`): 300ms debounce with clear button.
  - **Employees Directory** (`EmployeesPage.jsx`): 300ms debounce on directory filter with clear button.
  - **Manual Entries** (`ManualEntriesPage.jsx`): 300ms debounce on customer/note search with clear button.
  - **Activity Log Filter** (`ActivityLogPage.jsx`): 250ms debounce with memoized employee filter list.
  - **Inventory Intelligence** (`InventoryIntelligenceSection.jsx`): 250ms debounced filters across Stock Risk, Sales Velocity, and Vendor Procurement with dedicated clear buttons.

---

### 🏛️ Senior Backend Optimization & Zero N+1 Queries (`employeeController.js`, `Session.js`, `Payment.js`)
- **Batch Session Status Resolution** — Eliminated a 50-iteration `Promise.all(employees.map(async emp => Session.findOne(...)))` loop in `getEmployees()`. Replaced with a single batched `$in` query: `Session.find({ user: { $in: employeeIds }, userModel: 'Employee', isActive: true, lastActivityAt: { $gte: fiveMinutesAgo } }).select('user').lean()`. Added an in-memory `Set` for O(1) online status resolution, slashing database round-trips from 52 down to 3 queries (94% reduction).
- **Compound B-Tree Indexing (ESR Rule)**:
  - Added `sessionSchema.index({ user: 1, userModel: 1, isActive: 1, lastActivityAt: -1 })` for high-throughput activity audits.
  - Added `paymentSchema.index({ tenantId: 1, referenceNumber: 1 })` and `paymentSchema.index({ tenantId: 1, 'invoiceSnapshot.invoiceNumber': 1 })` for sub-millisecond collection lookups.

---

## [v2.4.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.4.1) — 2026-09-12 — Dashboard Card Separation, Universal Elevation, Invoice Web Share & Accessible UI Polish

### 🎨 Enterprise Card Elevation, Universal Separation & High-Contrast Light Mode
Version 2.4.1 is a targeted visual clarity and functionality patch addressing card-to-canvas separation across all dashboards and entity views, fixing the non-functional invoice Share button, eliminating white-on-white text in KPI statistics, and polishing drag affordance cursors across the floating calculator system.

---

### 🖼️ Universal Card Elevation & Surface Contrast (`index.css`, `ThemeContext.jsx`)
- **Light Mode Canvas & Border Inversion** — Remapped light canvas `--color-slate-950` to `#f1f5f9` (crisp slate-100) and card borders `--color-slate-800` to `#e2e8f0` (slate-200). Previously, `--color-slate-800` resolved to `#f1f5f9` (identical to the canvas), causing cards using `border border-slate-800` across dashboards and list views to blend invisibly into the background.
- **Universal Card Elevation Rules** — Configured `.glass-card`, `.stat-card`, and `[class*="bg-slate-900"].rounded-*` elements with dedicated elevation:
  - **Light Mode**: Solid `#ffffff` card surface, `#e2e8f0` boundary borders, and soft drop shadows (`0 1px 3px rgba(0,0,0,0.06)`).
  - **Dark Mode**: Solid `#141417` card surface on `#09090b` obsidian canvas, crisp `#282933` borders, and dark drop shadows (`0 2px 4px rgba(0,0,0,0.45)`).
- **Theme Synchronization (`ThemeContext.jsx`)** — Synchronized browser status bar `meta[name="theme-color"]` (`#f1f5f9` light / `#09090b` dark) and Recharts tooltip colors (`#141417` with `#333440` borders).

---

### 📤 Invoice Web Share & Instant Clipboard Fallback (`InvoiceViewPage.jsx`)
- **Native Web Share Integration** — Wired the previously dormant "Share" button to `navigator.share` with structured payload (invoice number, customer name, formatted total, and direct URL), enabling native OS sharing via WhatsApp, Email, Messages, and AirDrop on mobile and supported desktop browsers.
- **Dual-Layer Clipboard Fallback** — Implemented modern `navigator.clipboard.writeText` with legacy `document.execCommand('copy')` fallback for non-secure contexts.
- **Micro-Interaction State** — Displays an instant success toast (`Invoice link copied to clipboard!`) and temporarily transitions the button icon to `<Check className="text-emerald-400" />` and label to `Copied` for 2.5 seconds.

---

### 🎯 High-Contrast Sessions Stat & Calculator Cursor Polish (`ActivityLogPage.jsx`, `CalculatorWidget.jsx`, `CalculatorDock.jsx`, `index.css`)
- **Sessions KPI Stat Accessibility (`ActivityLogPage.jsx`, `index.css`)** — Replaced raw dynamic template string that generated unreadable `text-white` on light cards with explicit semantic tokens (`text-indigo-400` with icon container `bg-indigo-500/10 border-indigo-500/20`), backed by accessible `--color-indigo-400: #4f46e5;` in light mode.
- **Canonical Move Cursors (`CalculatorWidget.jsx`, `CalculatorDock.jsx`)** — Replaced `cursor-grab` with standard window drag affordance `cursor-move` on widget headers and `cursor-pointer` on dock buttons, eliminating the jarring white cartoon hand cursor on Windows Chromium.

---

## [v2.4.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.4.0) — 2026-09-12 — Pro UI/UX Obsidian Dark Palette, Mobile Manual Entries Cards, Activity Log DOM Virtualization & Zero-CLS Skeletons

### 💎 Senior Enterprise UI & High-Performance Virtualization Milestone
Version 2.4.0 introduces an enterprise visual and architectural overhaul. It replaces amateur, high-saturation midnight-navy backgrounds with industry-standard neutral obsidian dark tokens (`#09090b` canvas, `#121215` card surfaces, and `#2a2b32` borders) modeled after Linear and Vercel. It unifies the Header, Sidebar, and Page Canvas into one cohesive surface, adds responsive mobile card layouts for Manual Entries, replaces raw loading spinners with dedicated zero-CLS shimmer skeletons across Activity Log and Employee Detail views, and incorporates `@tanstack/react-virtual` DOM virtualization across both top-level session cards and high-volume shift sub-lists.

---

### 🎨 Pro UI/UX Obsidian Dark Theme & Canvas Unification (`index.css`, `DashboardLayout.jsx`, `Header.jsx`, `AppShellSkeleton.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`)
- **Pro Obsidian Color Tokens (`index.css`)** — Replaced 84% blue-saturated dark tokens with neutral obsidian charcoal (`#09090b` canvas, `#121215` card surfaces, `#17171c` inner sub-panels, `#1c1d22` secondary surfaces, and `#2a2b32` refined borders), eliminating eye strain, chromatic aberration, and amateur "vibecoded" blue glows while keeping light mode 100% untouched.
- **Unified Obsidian Canvas (`DashboardLayout.jsx`, `Header.jsx`)** — Eliminated diagonal gradient bleeds and rotating radial haze overlays that created color mismatches between the sidebar and main canvas. Added `dark:bg-slate-950/80` to Header and AppShellSkeleton for seamless edge-to-edge dark consistency.
- **Auth Page Obsidian Canvas (`LoginPage.jsx`, `RegisterPage.jsx`)** — Replaced diagonal blue gradients with pure obsidian canvas `#09090b`.

---

### 📱 Responsive Mobile Cards for Manual Entries (`ManualEntriesPage.jsx`, `ManualEntriesPageSkeleton.jsx`)
- **Dual-Mode Desktop & Mobile Split** — Preserved high-density administrative table with monospace typography on desktop (`hidden md:block`), while dynamically displaying standalone glass cards (`block md:hidden space-y-3`) on mobile (< 768px).
- **Mobile Card Architecture** — Modeled after `InvoicesPage.jsx`: Entry Type & Payment pills, 44px touch-accessible delete action buttons (`min-w-[40px] min-h-[40px] active:scale-95`), customer avatar badges with phone numbers, right-aligned monospace amounts with remaining credit balance, and formatted timestamps.
- **Dedicated Mobile Pagination Card** — Clean pagination card with 36px touch targets for `Prev` and `Next` navigation.
- **Symmetric Zero-CLS Skeleton (`ManualEntriesPageSkeleton.jsx`)** — Synchronized mobile card placeholders and desktop table skeletons for smooth loading transitions.

---

### ⚡ DOM Virtualization & Bounded Session Lists (`ActivityLogPage.jsx`, `ActivityLogPageSkeleton.jsx`, `EmployeeDetailPage.jsx`, `EmployeeDetailPageSkeleton.jsx`)
- **Top-Level Sessions Virtualization (`VirtualizedList`)** — Wrapped the main `activityLog` list in `@tanstack/react-virtual` with dynamic height measurement (`measureElement`). When selecting 30-day ranges across multi-shift enterprises (50–150+ sessions), only the visible 5–8 session cards in the viewport are mounted in the DOM.
- **Accordion Height Recalibration** — Attached a debounced `window.dispatchEvent(new Event('resize'))` listener to `SessionCard` triggering whenever accordions expand or sub-lists toggle, dynamically recalculating parent virtualizer bounds with zero layout overlap.
- **Shift Sub-Lists Virtualization** — In busy shifts with 80–200+ invoices or payments, the expanded list inside `max-h-72 overflow-y-auto custom-scrollbar` renders through nested `VirtualizedList` components (`estimateSize={() => 48}`), ensuring minimal memory consumption and 60fps smooth scrolling.
- **5-Item Initial Limit & Category Filter Pills** — Invoices and payments are capped to 5 items initially with "Show all {count} (+X more) / Show fewer" toggles, product chips capped at 8, and quick-jump category filter tabs (`[All] [Invoices] [Payments] [Products]`).
- **Activity Log & Employee Detail Shimmer Skeletons** — Created `ActivityLogPageSkeleton.jsx` and `EmployeeDetailPageSkeleton.jsx` to replace raw `<RefreshCw />` spinners with full-page zero-CLS shimmer skeletons.

---

### 🛡️ Auth Reliability & Brand Loading Experience (`AuthContext.jsx`)
- **Auth Brand Loader** — Isolated `/login` and `/register` in `AuthContext.jsx` to render a focused, sleek brand loader (pulsing "B" badge + spinner on `#09090b` canvas) instead of momentarily flashing the entire dashboard sidebar and metric skeletons.
- **Null-Safety Hardening** — Guarded `checkAuth`, `login`, and `register` responses with optional chaining (`data?.success`, `result?.success`) to prevent unhandled TypeErrors during transient server restarts or network drops.

---

## [v2.3.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.3.1) — 2026-09-06 — Canonical Support Email Standardization & Post-Versioning Release Note Automation

### 📧 Canonical Support Email Standardization
Version 2.3.1 is a targeted integrity patch establishing `support.bharatenterprise@gmail.com` as the canonical customer support and legal communications channel across the entire platform. This resolves inconsistencies where dummy domain addresses (`support@bharatenterprise.com`) and legacy plural addresses were referenced across subscription touchpoints, access control guards, and legal disclosure documentation.

---

### 🎨 Frontend & SaaS Subscription Touchpoints (`SubscriptionBanner.jsx`, `SubscriptionPage.jsx`, `PlanAccessRestricted.jsx`, `TermsPage.jsx`, `PrivacyPolicyPage.jsx`)
- **Centralized Support Constant** — Standardized `SUPPORT_EMAIL = 'support.bharatenterprise@gmail.com'` across `SubscriptionBanner.jsx`, `SubscriptionPage.jsx`, and `PlanAccessRestricted.jsx`.
- **Interactive Copy & Mailto Consistency** — Replaced legacy plural mailto and copy-to-clipboard targets in `TermsPage.jsx` and `PrivacyPolicyPage.jsx` with `support.bharatenterprise@gmail.com`.
- **Changelog Historical Alignment** — Updated previous release documentation to point to the canonical mailto endpoint.

---

### 📋 Legal & Compliance Synchronization (`PRIVACY_POLICY.md`, `TERMS_AND_CONDITIONS.md`)
- **Section 20 Terms & Conditions** — Updated official support contact table to `support.bharatenterprise@gmail.com`.
- **Privacy Policy Section 13** — Standardized contact table row formatting with `support.bharatenterprise@gmail.com`.

---

### ⚙️ Workspace Governance & Release Protocol (`release-protocol.md`, `SKILL.md`, `AGENTS.md`)
- **Mandatory Post-Versioning Release Notes** — Codified Step 6 into `.agents/rules/release-protocol.md`, `.agents/skills/release-manager/SKILL.md`, and `.agents/AGENTS.md` requiring automatic generation of complete, copy-paste-ready GitHub Release Notes with direct publication links upon completing version tagging and push.

---

## [v2.3.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.3.0) — 2026-09-05 — Enterprise Collections Workstation, Cashier Reconciliation, Interactive Capsule Affordance & Shared Export Engine

### 🏛️ Operational Collections Workstation & Accounting Integrity
Version 2.3.0 is a milestone minor release elevating the Collections module (`/collections`) into a high-density, senior enterprise financial workstation. It enforces strict mathematical reconciliation (`Total Collections === Cash Collections + Non-Cash Collections`), eliminates UTC midnight 05:30 AM timestamp display artifacts, provides dedicated print isolation for customer payment receipts and cashier register closeout statements, introduces interactive horizontal scroll affordances with smooth chevron navigation, eliminates mobile modal navigation back-traps, integrates timezone-safe export period presets, and ensures integer count metrics never display with decimal currency formatters.

---

### 🎨 Frontend Workstation UI & Mobile Accessibility (`CollectionsPage.jsx`, `ExportModal.jsx`, `PaymentReceiptModal.jsx`, `DailyCloseoutPrintModal.jsx`, `formatters.js`)
- **Pixel-Perfect 8-Column Table Alignment** — Explicitly aligned table headers (`th`) and body cells (`td`) with `text-left` for 6 informational columns and `text-right` for `Amount` and `Actions`.
- **Narrow Monospace Reference / UTR Guard** — Bank reference numbers are styled with narrow monospace (`font-mono text-xs tracking-tight`), constrained with `max-w-[140px] truncate`, and equipped with a full-reference hover tooltip and 1-click clipboard copy.
- **Enterprise Cashier Identity Presentation** — Displays cashier name first with operational role tag (`[Admin]` or `[Staff]`), shows full email on hover via tooltip, and restricts email prefix extraction to legacy fallbacks only.
- **Interactive Capsule Scroll Affordance (`ScrollAffordanceContainer`)** — Engineered a dedicated container for horizontal capsule strips (channel allocation pills and date filter chips) featuring subtle edge gradient masks, dynamic overflow detection via `ResizeObserver`, and clickable left/right slide chevrons smoothly scrolling content by 180px increments.
- **Mobile Modal Navigation & Back-Trap Elimination (`PaymentReceiptModal.jsx` & `DailyCloseoutPrintModal.jsx`)** — Added a sticky mobile header with `<ArrowLeft>` back button, a sticky full-width bottom dismiss button, backdrop tap-to-close dismissals, and `Escape` keyboard shortcuts so mobile users are never trapped inside dialogs.
- **Comprehensive 8-Period Export Presets (`ExportModal.jsx`)** — Upgraded the export modal with an 8-preset responsive grid (`Today`, `Yesterday`, `Last 7 Days`, `This Month`, `Last Month`, `This Year`, `Last 30 Days`, `All Time`). Boundaries are calculated using timezone-immune UTC arithmetic anchored to Indian Standard Time (`Asia/Kolkata`).
- **Active Export Scope Inheritance (`CollectionsPage.jsx`)** — Pre-populates the export modal with the parent page's active filter scope (`defaultPreset`, `initialDateRange`) and provides live visual scope feedback across single-day, multi-day, and all-time selections.
- **Thermal & A5 Payment Receipt Voucher (`PaymentReceiptModal.jsx`)** — Renders isolated printable receipts via React Portals (`createPortal(..., document.body)`). Screens carry `.no-print`, while `.invoice-print` prints clean vouchers without background page screenshots.
- **Daily Cashier Closeout Statement (`DailyCloseoutPrintModal.jsx`)** — Produces formal end-of-day register reconciliation statements with cash vs non-cash summaries, channel breakdowns, transaction ledgers, and signature sign-off lines.
- **Accurate Financial Empty State (`CollectionsPage.jsx`)** — Replaced generic `"No collections found"` with domain-accurate `"No payments found"` accompanied by contextual period dates (e.g. `Yesterday (04 Sep 2026)`).
- **Timestamp Standardization (`formatters.js`)** — Exported `hasExplicitTime`, `formatPaymentTime` (guaranteeing uppercase `AM`/`PM`), and 3-letter month formatting (`05 Sep 2026`).

---

### 🔧 Backend Service Layer & Export Engine (`paymentController.js`, `manualEntryController.js`, `collectionExportController.ts`, `excel.ts`, `helpers.ts`, `types.ts`)
- **IST Business-Day Boundaries (`parseISTDateBoundary`)** — Single dates and date ranges are strictly parsed in `Asia/Kolkata` (UTC+5:30) with start-of-day (`00:00:00.000`) and end-of-day (`23:59:59.999`) bounds.
- **Explicit Timestamp Preservation (`resolvePaymentDate` & `resolveEntryDate`)** — Preserves real-time hours, minutes, and seconds when recording payments or manual entries, preventing default UTC midnight serialization from generating 05:30 AM display artifacts.
- **Cashier Attribution & Unified Normalization** — Queries `createdBy.user` and normalizes both `Payment` and `ManualEntry` records into a uniform DTO contract with cashier name, email, and role.
- **Zero-N+1 Bounded Lookups** — Caps search lookup on customer name and phone to 50 matching IDs using compound B-Tree indexes `{ tenantId: 1, customerName: 1 }` and `{ tenantId: 1, phone: 1 }`.
- **Shared Export Engine Integration (`collectionExportController.ts`)** — Standardized Excel (`.xlsx`), CSV (RFC-4180 with UTF-8 BOM), and PDF exports via `backend/utils/export` with a strict 5,000-record / 365-day boundary.
- **Integer Metric Formatting (`helpers.ts`, `excel.ts`, `types.ts`)** — Introduced explicit `'integer'` formatting and auto-detection via `Number.isInteger(num)`. Discrete metrics (e.g. `Total Receipts Recorded`, `Total Purchases`, `Total Inventory Units`) render cleanly as integers (e.g. `3`, `42`) rather than decimal currency artifacts (`3.00`, `42.00`) across PDF and Excel exports.
- **Guard-Safe All-Time Export Querying (`collectionExportController.ts`)** — Added explicit `isAllTime=true` support bounded precisely to 364 days ago from start of day IST to end of today IST, ensuring safe full-history exports without tripping the 365-day boundary guard.
- **Zero-Record Export Guard (`collectionExportController.ts`)** — Added an early count verification returning HTTP `404` (`"No payments found for the selected period. Nothing to export."`) when matching records equal 0, preventing empty zero-row spreadsheet downloads.

---

## [v2.2.6](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.2.6) — 2026-09-05 — Employee Activity Log Reliability, Activity-First Querying & Daily Work Sessions

### ⚡ Activity-First Discovery Architecture
Version 2.2.6 fixes an architectural flaw where employee activity in production (such as recorded payments and created invoices) was hidden whenever the employee had not performed an explicit login session within the short rolling time window (e.g. multi-day JWT lifespan). Activity discovery is now decoupled from session existence: activities are queried directly by tenant and employee attribution, while sessions serve as non-gating contextual metadata.

---

### 🔧 Backend Domain Service & Batched Queries (`employeeActivityService.ts` & `employeeAnalyticsController.js`)
- **Activity-First Querying (`employeeActivityService.ts`)** — Replaced session-dependent iteration with parallel batched queries across Invoices, Payments, Products, and Sessions. Completely eliminated N+1 database queries.
- **Independent Metrics & Direct Activities** — Returns independent counts for sessions, invoices, payments, and sales. Activities recorded outside explicit login sessions are retained and surfaced cleanly as Direct Activities rather than discarded.
- **Robust IST Business-Day Boundaries** — Implemented `parseActivityTimeRange` supporting `today`, `yesterday`, `24h`, `7d`, and `30d` with accurate Asia/Kolkata date boundaries, removing the previous arbitrary 72-hour cap.
- **Daily Work Session Maintenance (`authController.js` & `activityTracker.js`)** — Integrated `ensureActiveWorkSession` into the heartbeat endpoint and mutation tracker with in-flight mutex concurrency protection, safely maintaining one active daily session per employee without creating duplicate session documents.
- **Thin Controller Pattern** — Refactored `getActivityLog` in `employeeAnalyticsController.js` to delegate orchestration to `employeeActivityService.ts`.

---

### 🎨 Frontend Activity Log Polish (`ActivityLogPage.jsx` & `employeeService.js`)
- **Expanded Operational Time Range Filters** — Replaced the 72-hour dropdown with **Today**, **Yesterday**, **Last 24h**, **Last 7 Days**, and **Last 30 Days**.
- **Defensive Session Rendering** — Updated `SessionCard` to seamlessly render direct activities when `entry.session` is null without null-reference errors, featuring a distinct "Direct Activity" badge.
- **Independent KPI Summary Cards** — Wired KPI summary cards to `stats` from the backend, accurately displaying non-zero payment/invoice counts even when session count is zero.
- **Updated Empty State** — Replaced misleading "No sessions found" with "No activities or sessions found in the selected time range".

---

## [v2.2.5](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.2.5) — 2026-09-04 — Complete UI Notification Elimination in Printed Documents (Invoices, Credit Notes, Ledgers)

### 🖨️ Two-Layer Print Isolation Architecture
Version 2.2.5 introduces a comprehensive, two-layer print isolation defense across the platform. Invoices, credit notes, customer ledgers, and supplier ledgers now contain strictly their intended financial, customer, and table content, with zero leakage of toasts, subscription/trial banners, background revalidation indicators, modals, or application chrome during browser print preview, physical printing, or "Save as PDF".

---

### 🛡️ Layer 1: Component-Level Print Protection
- **Subscription Banners (`SubscriptionBanner.jsx` & `DashboardLayout.jsx`)** — Added `no-print` and `subscription-banner` to the root motion container and defensively wrapped `<SubscriptionBanner />` in `<div className="no-print">` in `DashboardLayout.jsx`. Active trial ("Trial Ending Soon"), grace period, and expired warnings remain visible on screen but are completely omitted from printed documents.
- **Toast Notifications (`ToastContext.jsx` & `AuthContext.jsx`)** — Added `no-print` and `aria-live="polite"` to `ToastContainer` and the fallback toast wrapper. Success/error notifications (such as "Invoice created successfully!", "Credit note created successfully!", or "Invoice marked as printed") with 5-second lifetimes can never stamp into the top-right corner of documents when printing immediately.
- **Background Revalidation Indicators (`RefreshIndicator.jsx`)** — Added `no-print` to `RefreshIndicator` and `RefreshDot`. Prevents animated spinning icons or "Refreshing..." text from appearing when window focus triggers SWR background revalidation during print dialogs.
- **Portaled Modals, Dropdowns & Overlays (`Modal.jsx`, `RecordPaymentModal.jsx`, `EditPaymentModal.jsx`, `ManualEntryModal.jsx`, `CustomDropdown.jsx`, `CommandPalette.jsx`)** — Added `no-print` to all root portal containers to guarantee dialog backdrops and listboxes are excluded from the print stream.
- **UI Chrome & Utilities (`DashboardLayout.jsx`)** — Added `no-print` to the floating scroll-to-top button.

---

### 🎨 Layer 2: Global Print Stylesheet Concealment (`index.css`)
- **Canonical `.no-print` Standard** — Defined `.no-print, .no-print * { display: none !important; }` across all print media queries.
- **Defensive Print Concealment Rules** — Expanded `@media print` rules with explicit selectors: `.toast-container`, `.toast`, `.subscription-banner`, `[role="alert"]`, `[role="status"]`, `[role="dialog"]`, `[role="listbox"]`.
- **Eliminated Fragile Selectors** — Removed bare `[class*="pointer-events-none"]` from print rules to protect legitimate document content, while ensuring `.invoice-print` and `.invoice-copy` retain 100% layout fidelity.

---

### 📄 Documentation & Standards Synchronization
- **Print Positioning Guide (`PRINT-POSITIONING-GUIDE.md`)** — Updated invoice print positioning guide to reflect current A4 defaults (`size: A4 portrait`, `margin: 6mm`, `width: 190mm`), cleaned file references to repository-relative paths, and documented the print isolation architecture.
- **Agent Engineering Rules & Skills (`frontend-standards.md` & `frontend-architect/SKILL.md`)** — Codified the Two-Layer Print Isolation Architecture, canonical `.no-print` standard, and repository-relative path hygiene into workspace rules and the frontend bug prevention checklist.

---

## [v2.2.4](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.2.4) — 2026-09-04 — Fix Sales Velocity Ranking & Sorting for Fast-Moving and Slow-Moving Inventory

### 📊 Inventory Intelligence Sorting & Ranking
Version 2.2.4 fixes an issue in the Inventory Intelligence dashboard where "Top Fast-Moving Products" and "Slow-Moving & Zero-Sales" were displayed in MongoDB natural insertion order instead of ranked sales velocity order.

---

### 🔧 Velocity Service & UI Defensiveness (`inventoryAnalyticsService.ts` & `InventoryIntelligenceSection.jsx`)
- **Strict Velocity Ranking in Service** — In `inventoryAnalyticsService.ts`, the final segment lists (`FAST_MOVING`, `SLOW_MOVING`, `NO_SALES`) now derive and filter from sorted velocity aggregations rather than unranked product collections:
  - **Fast-Moving Products**: Filtered from `sellingProducts` and sorted descending by `unitsSold` (with `velocityRate` as secondary tie-breaker).
  - **Slow-Moving Products**: Filtered from `sellingProducts` and sorted ascending by `unitsSold` (least sold first, with highest `currentStockQty` on hand as secondary tie-breaker).
  - **Zero-Sales Products**: Filtered from `productList` and sorted descending by `currentStockQty` to highlight highest dead capital first.
- **Client-Side Sorting Resilience** — In `InventoryIntelligenceSection.jsx`, wrapped `displayedVelocityFast` and `displayedVelocitySlow` in memoized sorting routines (`useMemo`) to guarantee immediate correct descending/ascending order even if stale or cached payload data is loaded.

---

## [v2.2.3](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.2.3) — 2026-09-04 — Fix Duplicate Product Addition When Batch Tracking Is Disabled

### 🐛 Invoice Creation Bug Fix
Version 2.2.3 fixes an issue where selecting a product from the search dropdown inserted the product twice when batch tracking was disabled, while preserving full batch and FIFO functionality.

---

### 🔧 Product Selection Deduplication (`InvoiceCreatePage.jsx`)
- **Eliminated Redundant `onMouseDown` Selection Trigger** — Removed `handleProductSelect(product)` from the dropdown option's `onMouseDown` event handler. Previously, both `onMouseDown` and `onClick` were executing `handleProductSelect` on every mouse click. When batch tracking was disabled, this triggered two synchronous insertions before React could update state, resulting in duplicate product rows.
- **Retained Dropdown Focus Protection** — Preserved `e.preventDefault()` on `onMouseDown` to prevent the search input from losing focus prematurely during selection, and retained `onMouseEnter` prefetching for batch cache warming.
- **Added Atomic Insertion Guard** — Enhanced `setInvoiceItems` updater with an atomic guard (`prev.some(...)`) to ensure a product can never be prepended twice in rapid succession.
- **Preserved Batch & FIFO Architecture** — Batch-tracking logic (`enableBatchTracking && allocationMode === 'AUTO'`), background FIFO simulation, and manual batch selection remain completely intact and untouched.

---

## [v2.2.2](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.2.2) — 2026-09-03 — Mobile Responsive Subscription Notification & Dynamic Expiry Verification

### 📱 Mobile Notification Layout & Dynamic Days Calculation
Version 2.2.2 fixes the mobile responsive styling for subscription notifications and trial banners, adds direct support email mailto links, and verifies dynamic real-time calculation of remaining trial days.

---

### 🎨 Mobile Responsive Notification Styling (`SubscriptionBanner.jsx`)
- **Responsive Flex Layout** — Replaced fixed horizontal flex row with a mobile-first responsive layout (`flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-4`). On mobile viewports (< 640px), the banner no longer squishes message text or overflows horizontally.
- **Full-Width Touch Targets** — On mobile devices, action buttons (`Upgrade Plan` / `Renew Plan`) now expand to a comfortable full-width touch target (`w-full sm:w-auto`), with clean, concise labels.
- **Positioned Dismiss Button** — On mobile screens, the dismiss (`X`) button is anchored cleanly in the top-right corner (`absolute top-3 right-3 sm:static`), with padding buffer preventing text overlap.
- **Direct Mailto Links** — Embedded clickable `mailto:support.bharatenterprise@gmail.com` links directly inside banner messages, allowing users on both mobile and desktop to open their email client instantly.

---

### 🔍 Dynamic Trial & Grace Days Verification
- **Verified Non-Hardcoded Calculation** — Confirmed that the remaining days in *"Your trial of the Professional plan ends in 4 days"* is 100% dynamically computed. In `featureService.ts`, remaining duration is calculated in real time: `Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))`, served via `/api/saas/subscription`, and consumed reactively by `SubscriptionContext.jsx`.

---

## [v2.2.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.2.1) — 2026-09-02 — Enterprise Dashboard Polish & Contextual Payment Entry-Point Enforcement

### 🎨 Enterprise Polish & Workflow Cohesion
Version 2.2.1 delivers an aesthetic overhaul eliminating AI/vibecoded tropes in favor of a crisp, high-density enterprise SaaS layout, and enforces intelligent contextual guards for payment collection actions across the dashboard.

---

### 🛡️ Contextual Payment Entry-Point Enforcement
- **Accessible Entry-Point Requirement** — Fixed a workflow contradiction where an employee with `payments.create` could still see a *"Record Payment"* quick action pointing to `/collections?action=record` even when `collections`, `customers`, and `invoices` were all disabled by the administrator.
- **Dynamic Contextual Routing** — In `EmployeeDashboard.jsx`, the *"Record Payment"* quick action, top header button, and collections KPI card now require `canViewCollections || canViewCustomers || canViewInvoices`:
  - **Collections Permitted**: Routes directly to `/collections?action=record`.
  - **Collections Restricted, Customers Permitted**: Routes dynamically to `/customers` to allow recording payment against a customer account.
  - **Collections & Customers Restricted, Invoices Permitted**: Routes dynamically to `/invoices` to allow recording payment against an invoice.
  - **All Three Restricted**: Cleanly hides the *"Record Payment"* action and collections KPI card, preventing unauthorized 403 navigation errors.

---

### 💻 Enterprise Dashboard Aesthetic Redesign
- **Stripped "Vibecoded" Artifacts** — Removed ambient background glow blobs (`blur-3xl`), rainbow gradient text clips (`bg-gradient-to-r`), saturated gradient action tiles, and decorative `Sparkles` icons.
- **High-Density Enterprise Layout** — Realigned typography, spacing, and card tokens with the unified enterprise design system (`bg-slate-900 border-slate-800 rounded-xl`).
- **Dynamic Responsive Grid** — Removed dummy greyed-out *"Restricted Module"* placeholder cards. The KPI grid now dynamically formats into 2, 3, or 4 columns based purely on permitted operational metrics.
- **Clean Document Table & Stock Alerts** — Formatted recent employee invoices with monospaced numbers, dark discrete payment status badges (`Paid`, `Partial`, `Unpaid`), and non-financial operational stock warning chips.

---

## [v2.2.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.2.0) — 2026-09-02 — Custom Role-Tailored Employee Dashboard & Financial Data Isolation

### 🛡️ Role-Tailored Employee Dashboard & Sensitive Data Protection
Version 2.2.0 introduces a dedicated operational workspace for employee users that completely shields administrator-only business intelligence and company-wide financial metrics at both the backend data layer and the frontend presentation layer.

---

### 🔒 Dual-Layer Security Model & Backend Data Isolation
- **Early-Branching Backend Controller** — In `dashboardController.js`, `req.userRole === 'employee'` branches immediately before constructing any executive database aggregations. Company-wide lifetime revenue (`totalInvoiceAmount`), total daily sales (`todaySales`), monthly sales (`monthSales`), previous month sales (`prevMonthSales`), and business growth rate percentages (`growth`) are completely skipped and strictly omitted from the response JSON payload.
- **Strict Schema Attribution** — Today's employee operational metrics (`todayInvoicesCreated`, `todaySalesHandled`, `todayPaymentsRecorded`, `todayPaymentsAmount`) and recent invoices are strictly scoped via `createdBy.user === req.user._id` and `createdBy.userModel === 'Employee'`.
- **Permission-Guarded Low Stock** — Low stock operational count and product alerts are guarded by `inventory.view` or `ledger.view`. Items display strictly operational information (product name, SKU, current stock) with wholesale purchase rates, supplier prices, and profit margins completely concealed.
- **Zero 403 Network Errors** — `DashboardPage.jsx` implements conditional SWR null keys (`isAdmin ? key : null`) for all administrator-only sales analytics and credit endpoints, completely preventing unauthorized network requests and eliminating console errors.

---

### 💻 Dedicated Frontend Employee Dashboard (`EmployeeDashboard.jsx`)
- **Personalized Operational Hero** — Welcomes employees by name (`Welcome back, {user.name}`), features an active Operational Desk indicator, live IST date/time, and a role badge dynamically derived from schema role definitions (`Billing Operator`, `Payment Collector`, `Inventory Manager`, `Full Operational Access`, `Operational Viewer`, or `Custom Operations`).
- **Personal Operational KPIs** — Focuses purely on personal operational contributions: *Invoices Created by Me* (today's count & career total), *Sales Handled by Me* (today's volume & career volume), *Collections Logged by Me* (today's receipts & career collections), and *Inventory Stock Alerts*.
- **Role-Aware Quick Actions** — Dynamically renders only the operational workflows authorized by the employee's assigned permissions (`+ New Invoice`, `+ Record Payment`, `Product Catalog`, `Inventory Ledger`, `Customer Directory`, `Inward Purchase`, and `Collections Hub`).
- **My Recent Invoices Feed** — Fast, high-density table displaying recent invoices created by this employee, with customer name, invoice number, amount, date, dynamic payment status badge (Paid / Partial / Unpaid), and direct view navigation.

---

## [v2.1.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.1.1) — 2026-09-02 — RBAC Inventory Ledger Enforcement, Collections Permission & Live Customer Outstanding

### 🛡️ RBAC Permissions & Financial Data Accuracy
Version 2.1.1 delivers crucial access control fixes for the inventory ledger, introduces independent employee permission controls for the collections module, ensures live financial dues are calculated in customer search, and fixes real-time payment status updates on the dashboard.

---

### 🔒 Granular RBAC: Inventory Ledger & Collections Permissions
- **Enforced Inventory Ledger Permission Decline** — Fixed access control for `/inventory/ledger` where declining `ledger` permission in the Employee Permissions Editor previously allowed access because routes and navigation checked general `inventory`. Updated backend `stockMovements.ts`, frontend route guards in `App.jsx`, and sidebar navigation in `navigationConfig.js` to strictly enforce `ledger` view permission.
- **Dedicated Collections Permission** — Added `collections: ['view']` to `PERMISSIONS_REGISTRY` and `ROLE_PRESETS`. Organization Admins can now independently grant or decline Collections access in `EmployeePermissionsEditor.jsx`, with dedicated route guards in `App.jsx` and endpoint protection in `routes/payments.js`.

---

### 💳 Live Customer Outstanding in Search & Payment Recording
- **Accurate Dues Aggregation in Customer Search** — Updated `searchCustomers` in `customerController.js` to run parallel aggregations (`Invoice.aggregate`, `ManualEntry.aggregate`, `CreditNote.aggregate`). Real-time calculated dues (including credit note return deductions) are now accurately returned in search results.
- **Live Outstanding Display in Modal** — Fixed `RecordPaymentModal.jsx` to display `cust.calculatedOutstanding ?? cust.outstandingBalance` instead of nonexistent fields, showing accurate live dues (e.g. ₹2,522.08) in both the search list and active customer card.

---

### ⚡ Real-Time Dashboard Invoices Payment Status
- **Included Payment Fields in Dashboard Stats** — Updated `Invoice.find` in `dashboardController.js` to include `paymentStatus`, `paidAmount`, and `paymentType` in the select projection.
- **Dynamic Status Badging** — `DashboardActivityHub.jsx` now correctly renders Paid (emerald), Partial (amber), and Unpaid (slate) badges in real-time, accurately decrementing Pending Dues counts when bills are settled.
- **App-Wide Cache Invalidation** — Recording payments from any modal now broadcasts cache invalidations across `'dashboard'`, `'collections'`, `'invoices'`, `'customer'`, and `'credit'`.

---

## [v2.1.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.1.0) — 2026-09-02 — Collections Analytics & Standalone Payment Recording

### 💰 Collections Analytics & Standalone Payment Recording
Version 2.1.0 delivers powerful collection-method visibility, fixes the monthly collections trend aggregation, and streamlines the payment recording workflow with a standalone customer search modal and direct quick action routing.

---

### 📈 Monthly Sales & Collections Trend Fix
- **Parallel Collections Aggregation** — Fixed `SalesAnalyticsService.getMonthlySales` to aggregate `Payment` records in parallel with `Invoice` revenue, grouped by month using `Asia/Kolkata` timezone semantics.
- **Accurate Monthly Cash Flow** — Guarantees all 12 monthly data points contain numeric `revenue` and `collections`, defaulting to `0` for months without payment receipts. The green Collections area in the Dashboard "Sales & Collections Trend" chart now renders real collected cash volumes.

---

### 💳 Standalone Record Payment Modal
- **Decoupled Customer Selection** — Extended `RecordPaymentModal` to function seamlessly without requiring a pre-selected customer prop, while maintaining 100% backward compatibility for invoice and customer profile pages.
- **Debounced Customer Search** — Instant, real-time client search across customer name, phone number, and GSTIN with balance indicators, loading feedback, and empty-state messaging.
- **Automatic Dues Fetching** — Automatically queries and loads unpaid invoices (`customerService.getCustomerInvoices`), opening balances (`manualEntryService.getUnpaidOpeningBalances`), and credit notes (`creditNoteService.getCreditNotesByCustomer`) upon customer selection.
- **Integrated FIFO & Single Allocations** — Feeds seamlessly into the existing single-document payment selection or automated chronological FIFO allocation queue.
- **Change Customer Action** — Allows switching between clients directly inside the modal without closing and reopening.

---

### 📊 Collections Page Visual Analytics & Quick Actions
- **Header Action Button** — Added a prominent `+ Record Payment` action button in the Collections page header.
- **Dashboard Quick Action Linkage** — Updated Dashboard Quick Actions to route to `/collections?action=record`, automatically launching `RecordPaymentModal` and safely consuming the query parameter to prevent reopening loops.
- **Visual Payment Method Share Bar** — Multi-segmented progress bar visually displaying proportional collection volumes across payment channels (Cash, UPI, Bank Transfer, Cheque, NEFT/RTGS).
- **Payment Method Analytics Cards** — Detailed channel breakdown cards with total collected amounts, transaction counts, and share percentages.
- **Collection KPIs** — Added **Average Payment Size** and **Top Payment Method** metric cards.
- **Actionable Empty States** — Replaced passive informational notices with direct `Record Payment` call-to-action buttons in both the analytics and payment details empty states.
- **Instant Cache Synchronization** — Automatically invalidates collections cache (`invalidateCachePattern('collections')`) and triggers SWR revalidation upon payment recording, immediately refreshing metrics, charts, and tables without browser reloads.

---

## [v2.0.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v2.0.0) — 2026-09-02 — Complete Inventory & Purchasing Evolution

### 🚀 Major Product Milestone
Version 2.0.0 marks a transformative evolution of Bharat Enterprise Billing System, expanding it from an invoice and billing utility into a comprehensive, multi-tenant business operations platform. This release introduces complete supplier procurement workflows, inward purchase entries with atomic inventory synchronization, an immutable inventory movement ledger, multi-tiered batch and FIFO stock allocation, operational intelligence reporting, and extensive performance and UX optimizations across desktop and mobile.

---

### 🧾 Purchase Management & Supplier Operations
- **Supplier Master Management** — Full-featured vendor directory tracking trade names, contact persons, phone numbers, email addresses, billing addresses, GSTIN numbers, state codes, payment terms, opening balances, and vendor notes.
- **Inward Purchase Entry** — Streamlined recording of incoming inventory bills with supplier reference numbers, invoice dates, purchase rates, selling rates, MRP, batch lots, manufacturing/expiry dates, and multi-slab GST taxes and discounts.
- **Purchase Lifecycle (`COMPLETED → CANCELLED`)** — Clear, auditable purchase workflow. Submitting a purchase immediately marks it as **COMPLETED**, atomically incrementing warehouse inventory and recording lot batches. Completed purchases can be **CANCELLED** by authorized staff, atomically reversing previously applied stock additions to prevent phantom warehouse inventory.
- **Session Form Recovery** — Integrated client-side form autosave in `sessionStorage` to safeguard unsaved invoice drafts and prevent data loss during active data entry.
- **Purchase History & Management** — Searchable, filterable purchase list with date-range filters, supplier filters, status indicators, and detailed purchase inspection drawers.

---

### 📦 Advanced Inventory & Batch/FIFO Architecture
- **Dual Inventory Tracking Modes** — Seamless support for both standard quantity-based inventory and batch-tracked inventory configured at the individual product level.
- **Automated FIFO Allocation** — Intelligent First-In-First-Out (FIFO) algorithm automatically allocates oldest received/unexpired batch lots during sales invoicing, minimizing waste and product expiration risk.
- **Manual Batch Allocation & Modal Controls** — Flexible modal interface empowering operators to override automatic FIFO allocation, pick specific lot numbers, split quantities across multiple batches, and update prices on the fly.
- **Lazy/JIT Batch Migration** — Zero-downtime lazy migration strategy ensuring existing un-batched product stock effortlessly transitions into batch tracking without requiring database migrations.
- **Universal Availability** — Batch tracking and FIFO allocation tools are fully accessible across all subscription tiers (Starter, Business, and Professional).

---

### 📜 Immutable Inventory Ledger & Stock Movement Audit Trail
- **StockMovement Ledger** — Centralized, immutable ledger tracking all stock mutations across the system: inward purchases (`PURCHASE`), sales deductions (`SALE`), credit note customer returns (`RETURN`), and administrative inventory adjustments (`ADJUSTMENT`).
- **Granular Movement Traceability** — Tracks movement quantities, pre- and post-transaction balance snapshots, batch lot numbers, user attribution, and linked document references.
- **Operational Inflow/Outflow Visibility** — Provides operators with an auditable trail of why and when stock changed, eliminating mysterious inventory variances.

---

### 📊 Purchase & Operational Flow Reports
- **Supplier-Wise Purchase Analysis** — Aggregated procurement summaries breaking down total spend, tax paid, and invoiced volumes across suppliers.
- **Product-Wise Inward Tracking** — Detailed reporting on product procurement volumes, purchase rates, and supplier sources over customizable date ranges.
- **Inventory Flow & Movement Reports** — Clear operational visibility into stock additions, sales velocity, returns, and net stock changes.
- **Operational Report Distinction** — Explicit disclaimers clarifying that reports are operational visibility tools rather than statutory financial accounting, COGS certification, or tax advice.

---

### 🧠 Professional Inventory Intelligence
- **Batch Expiry Horizon** — Real-time tracking of upcoming batch expiries (e.g. 30, 60, 90-day horizons) to prevent dead inventory and spoilage.
- **Product Velocity & Risk Indicators** — Operational signals highlighting fast-moving vs. slow-moving stock lines to inform reordering decisions.
- **Supplier Procurement Patterns** — Insights into vendor order frequencies and pricing trends over time.

---

### 👥 Team & Access Control (Tenant-Controlled RBAC)
- **Granular Module Permissions** — Organization Admins can grant or restrict employee capabilities across discrete modules (Customers, Products, Invoices, Payments, Purchases, Suppliers, and Reports).
- **Action-Level Security** — Granular permissions for viewing, creating, editing, deleting, or cancelling entries strictly enforced via backend middleware.
- **Employee Activity & Audit Logs** — Operational action logging linking transactions and updates to specific team member accounts for administrative accountability.

---

### 💳 SaaS Subscription Tier Expansion
- **Starter (₹299/mo)** — Essential billing and invoicing, basic inventory tracking, Batch & FIFO allocation, and single employee seat.
- **Business (₹499/mo)** — Everything in Starter plus Payments, Collections, Credit Notes, Customer Outstanding Ledger, Supplier Management, Purchase Entry, Purchase Reports, and Inventory Movement Ledger.
- **Professional (₹699/mo)** — Everything in Business plus Employee Management, Role-Based Access Control (RBAC), Employee Analytics, Activity Logs, GST Reports, Advanced Reporting, and Professional Inventory Intelligence.
- **Non-Destructive Plan Transitions** — Changing or downgrading subscription plans dynamically adjusts feature access while permanently preserving all historical business records, invoices, purchases, and ledger entries.

---

### ⚡ Performance, UX & Desktop Optimization
- **Independent Performance Detection Hook (`usePerformanceMode`)** — Lightweight, synchronous hardware-aware detection hook that evaluates logical CPU cores and device memory without running heavy benchmarks. Low-end desktop PCs (such as 2nd/3rd gen Intel Core i3/i5 systems with 4GB RAM) automatically disable expensive 3D perspective mousemove transforms and GPU fragment blur filters to guarantee silky 60fps operation.
- **Preserved Mobile Optimization Layer** — `useDeviceType` remains completely independent and dedicated to responsive layout classification and mobile animation suppression.
- **Zero-Lag Batch Allocation Modal** — Added 30-second TTL request caching to `productService.getBatches`, reducing batch modal opening delay to 0ms for previously loaded products and rendering an immediate loading skeleton.
- **Stable Invoice Row Rendering** — Transitioned invoice item identity to unique, immutable `_rowId` values, and refactored `handleProductSelect` to await batch allocation asynchronously before state commit, eliminating transient duplicate row cards and exit animation glitches.
- **Mobile Sidebar Swipe Gestures** — Added responsive, passive touch listeners allowing operators to swipe right from the screen edge to open the navigation drawer and swipe left to close it.
- **Hardened ToastProvider Architecture** — Lifted `<ToastProvider>` to top-level app mounting and introduced safe fallback handlers to prevent unhandled exceptions during rapid page transitions or HMR intervals.

---

### 🛡️ System Resilience & Architecture
- **Atomic Stock Operations** — Purchase completion and cancellation execute within atomic database updates, preventing race conditions and inventory corruption.
- **Strict Multi-Tenant Isolation** — Multi-tenant partitioning enforced across all new Purchase, Supplier, Batch, and Movement collections at both query and indexing layers.
- **Optimistic UI with Reversion** — Robust user experience patterns across preferences and table views with automatic reversion on failure.

---

## [v1.26.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.26.0) — Employee Enhancements & Validation Fixes


### Added
- **Employee Date of Birth (DOB)** — Added a dedicated Date of Birth field to the Employee profile, seamlessly integrated into the backend schema, the employee creation/edit modal, and the employee details page.

### Improved
- **Employee Details Mobile Responsiveness** — Refactored flexbox layouts on the Employee Details page and Permissions Editor to flawlessly wrap buttons and long names on mobile screens.
- **Dynamic Document Headers** — Invoices and Credit Notes now fetch the most up-to-date Admin profile details dynamically, ensuring that any modifications to business phone numbers or GSTIN are immediately reflected on new PDFs.
- **Enhanced Toast Messaging** — Increased the visibility duration of toast notifications to give users ample time to read system alerts.

### Fixed
- **Inactive Customer Search Leak** — Fixed an issue where inactive customers were showing up in the "Create Invoice" search dropdown. The backend now strictly ignores `includeInactive` flags when querying customers for invoices.
- **GSTIN Validation** — Implemented strict backend and frontend validation for GSTIN inputs to guarantee data integrity.

---

## [v1.25.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.25.0) — Tenant-Controlled RBAC & Employee Compliance

### Added
- **Tenant-Controlled RBAC Architecture** — Introduced granular employee authorization with a permissions registry. Admins can now control employee access to view, create, edit, delete, or cancel across modules (Customers, Products, Invoices, Payments, etc.).
- **Employee Permissions Editor** — New dedicated interface for administrators to seamlessly manage and toggle employee permissions directly from the frontend.
- **Backend Permission Middleware** — Added `requirePermission()` to strictly protect backend API routes based on tenant-configured employee permissions, ensuring true end-to-end security.
- **Employee Profile Expansion** — Added support for Government IDs (with strict Aadhar/PAN regex validation and a "custom document" fallback) and Address storage.
- **Drug License (DL) Number** — Added a DL number field alongside GSTIN in the Admin Business Details settings for medical and pharmacy billing workflows.

### Improved
- **Frontend Route Protection** — Upgraded `App.jsx` with `<PermissionRoute>` logic that gracefully intercepts unauthorized navigation and displays clear "Access denied by admin" toast notifications.
- **Dynamic Employee Add/Edit Interface** — Improved the `EmployeeModal` layout to support responsive two-column structures and dynamically adapting custom ID document inputs.
- **Employee Details Grid** — Upgraded the employee details administrative interface to display the new address and Government ID fields using intuitive `MapPin` and `CreditCard` icons.

### Fixed
- **Infinite Render Loop (`Maximum update depth exceeded`)** — Fixed a severe React crash during unauthorized routing by properly stabilizing the `showToast` and `hasPermission` references in `AuthContext` using `useCallback()`.
- **Employee Detail Page Crash** — Fixed a blank-screen crash on the employee details page by restoring a missing `RefreshCw` Lucide-react import.
- **ProtectedRoute Rendering Failure** — Fixed a bug where `ProtectedRoute` was missing a crucial `return children;` statement, causing authorized content to silently fail to render.

---

## [v1.24.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.24.0) — Product Batch Tracking & Cross-Device Invoice Preferences

### Added
- **Product Batch Tracking** — Added proper end-to-end support for product batch numbers (`batchNo`) and expiry dates (`expiryDate`), preserving this information from product creation through invoice product snapshots.
- **Server-Side Preferences** — Upgraded Invoice View column preferences (including batch and expiry columns) from browser-only `localStorage` to validated server-side preferences, allowing settings to persist seamlessly across browsers and devices.

### Improved
- **Optimistic UI Updates** — Invoice column preference toggling now uses optimistic UI updates with a 500ms debounced server sync for a smoother user experience, complete with failure state reversion.
- **Migration & Cleanup** — Automatically cleans up legacy `localStorage` preferences and falls back safely to default configurations for existing users without requiring database migrations.

---

## [v1.23.2](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.23.2) — Backend Stability & Dependency Fixes

### Fixed
- **Backend Change Stream Backoff** — Fixed a bug in the exponential backoff logic for the MongoDB stock change stream. The `reconnectAttempts` counter was prematurely resetting to 0 right before reconnecting, defeating the backoff entirely and causing the server to aggressively spam reconnect attempts every 1 second when the database connection failed. The delay now properly doubles up to a maximum of 30 seconds.
- **Missing Dependency** — Fixed a backend crash during startup where the `date-fns` module could not be found due to it missing from `node_modules`.

---

## [v1.23.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.23.1) — SSE Stability & WebGL Resilience

### Fixed
- **SSE Infinite Reconnect Loop** — Replaced `EventSource`'s uncontrolled built-in auto-reconnect with manual reconnection featuring exponential backoff (2s → 4s → 8s → 16s → 30s cap) and a 10-attempt retry limit. After max retries, logs a single warning and stops — eliminating the infinite `[useStockSSE] SSE error/disconnected` console spam when the backend is unreachable.
- **WebGL Context Loss Crash** — Added `webglcontextlost` / `webglcontextrestored` event handlers to the 3D particle galaxy background. On context loss (common on mobile or GPU-stressed devices), the canvas now fades out gracefully instead of showing a broken black screen with `THREE.WebGLRenderer: Context Lost` errors. Recovery is automatic when the browser restores the context.

---

## [v1.23.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.23.0) — Immersive 3D Landing Page Experience

### Added
- **3D Particle Swarm Background** — Replaced the static geometric shapes on the landing page with an interactive 3D particle swarm using React Three Fiber.
- **Scroll-Driven Cinematic Timeline** — Tied the 3D particle animation and camera choreography to the page scroll position, sweeping smoothly through a high-altitude cinematic drone shot as the user scrolls.
- **Brand Theming** — The particle swarm dynamically cycles through the app's core palette (blue, cyan, teal, emerald).
- **Mouse Interactivity** — Particles glow and smoothly repel from the user's cursor across the entire screen, creating a gentle rippling effect.

### Changed
- **Mobile Optimization (Tiered Rendering)** — Mobile users (<= 768px) and users with `prefers-reduced-motion` are served a zero-JS CSS animated gradient fallback to preserve battery and maintain 60fps performance without downloading Three.js.
- **Code-Splitting** — Three.js and associated libraries (~250KB gzipped) are lazy-loaded and only fetched on desktop devices to keep the initial page load blazing fast for all users.
- **Visual Balance (Frosted Glass)** — Implemented high-opacity dark backgrounds (`bg-slate-900/80`) paired with heavy CSS backdrop-blur filters across all floating cards and text sections to ensure flawless legibility against the bright 3D particles.

### Fixed
- **Procedural Timeline Integration** — Fixed an issue where dynamically changing spin speeds during scroll caused the galaxy's procedural rotation to rewind or jump violently.
- **NaN Render Corruption** — Hardened the 3D rendering loop with strict fallback guards to prevent missing refs (like during HMR) from causing NaN propagation and hiding the entire canvas.
- **THREE.Clock Deprecation** — Replaced R3F's deprecated global clock calls with a manually accumulated `state.delta` counter to silence internal warnings and improve stability.
- **Particle Distortion** — Removed chaotic procedural distortion and clamped morphological parameters so the galaxy always maintains a perfect, tight spiral disc structure across all camera angles.

---

## [v1.22.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.22.1) — Production SSE Connectivity Fix

### Fixed
- **Cross-Origin SSE Authentication** — Resolved an issue where Server-Sent Events (SSE) for real-time stock sync failed to connect in production (Vercel frontend → Render backend).
- **Absolute URLs** — SSE now connects via the absolute `VITE_API_URL` instead of relative paths, which previously caused 404s on Vercel.
- **JWT Query Parameter Fallback** — Added token passing via query string (`?token=...`) since the native `EventSource` API cannot send cookies or custom `Authorization` headers across domains. Backend auth middleware was updated to gracefully accept this fallback for SSE endpoints.

---
## [v1.22.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.22.0) — Real-Time Stock Sync Stability & Caching Hardening

### Fixed
- **SSE Version Comparison Bug** — Fixed an edge case where JavaScript evaluated `"10" <= "9"` as `true`, causing real-time stock updates to be ignored after the 9th version. The system now bypasses this brittle check and relies exclusively on strict idempotence (`update.currentStockQty === item.product.currentStock`).
- **Orphaned API Cache** — The `api.js` cache wasn't being cleared during cross-tab SSE invalidation events. Fixed `useSWR.js` to dynamically invoke `api.clearCache()`, guaranteeing the Product Search dropdown always shows fresh stock numbers instantly.
- **Aggressive Browser Caching** — Added `Cache-Control: no-cache, no-store, must-revalidate` to the global Axios instance to prevent browsers from serving stale disk-cached `GET /api/products` responses.

---
## [v1.21.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.21.1) — Invoice Editing Reliability & Real-Time Stock Synchronization

### Added
- **Automatic Product Stock Synchronization** — The Invoice Create page automatically refreshes product stock whenever inventory changes elsewhere (cross-tab synchronization, window focus, visibility change). Powered by BroadcastChannel and storage-event fallback.
- **Synchronization Architecture** — Reusable cross-page communication system with duplicate invalidation prevention, concurrent refresh protection, safe unmount handling, and HMR listener protection.

### Improved
- **Correct Stock Validation During Invoice Editing** — Editing correctly restores stock originally allocated to the invoice before validating quantity changes. Centralized allocation model (`getInvoiceStockAllocations()`, `getCurrentEditStock()`, etc.) enables correct effective editable stock, multi-line invoice support, and reduced API calls.
- **Documentation** — README synchronized through v1.21.0, comprehensive CHANGELOG added, and release history tracked.

### Fixed
- **Build Stability** — Resolved frontend syntax error caused by an extra closing brace in `ProductsPage.jsx`.

---

## [v1.21.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.21.0) — Shared Export Engine & Mobile Performance Optimization

### Added
- **Shared Export Engine** — Reusable infrastructure for generating Excel, CSV, and PDF exports through a strongly typed architecture
- **Universal Export Definition** (`ExportDefinition.ts`) — Standardized contract for transforming data before rendering
- **Dedicated Export Renderers** — Independent renderers for Excel (`excel.ts`), CSV (`csv.ts`), and PDF (`pdf.ts`)
- **Product Export Backend** — Product retrieval, search/stock filtering, aggregate calculations, 50,000-row safety limit
- **Frontend Export Integration** — Context-aware export controls in Products module via ExportModal

### Improved
- **Mobile Sidebar Performance** — Reduced backdrop blur, simplified shadows, CSS `contain: layout paint`, memoized navigation with `React.memo()`, dynamic GPU layer promotion with `will-change: transform`
- **TypeScript Infrastructure** — Module compilation fixes, generic type constraints, export interface refinements

### Fixed
- **Excel Percentage Export** — Percentage values now format correctly before spreadsheet generation

---

## [v1.20.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.20.0) — Complete Shimmer Integration & Product Stock History

### Added
- **100% Shimmer Skeleton Coverage** — Dedicated skeleton loaders for Invoice View, Customer Details, Product Details, Credit Note View, Credit Note Create, and Manual Entries
- **Product Stock History** — Chronological audit trail for inventory movements with movement type, quantity change, previous/new stock, reference, timestamp, and user info
- **Stock History API** — `GET /api/products/:id/stock-history` with cursor-based pagination, configurable page size, total record count, and malformed entry filtering
- **Cursor-Based Pagination** — Uses MongoDB subdocument ObjectIds for stable ordering with no duplicates or skipped entries
- **Infinite Scroll** — Powered by TanStack Query (`useInfiniteQuery`) and TanStack Virtual (`useWindowVirtualizer`)
- **Lazy Loading** — Stock history collapsed by default; expands on demand to reduce initial page load

### Improved
- **InfiniteVirtualizedList** — Custom next-page extraction, configurable initial page parameter, per-query stale time, adjustable virtualizer overscan (backward compatible)

---

## [v1.19.2](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.19.2) — Mobile Navigation Stability & Sidebar Architecture Refactor

### Improved
- **Single Source of Truth** — Sidebar animation ownership centralized in `DashboardLayout`
- **Reliable Hamburger & Close Buttons** — Semantic `<button>` elements, fixed 44×44px touch targets, animations on inner icon wrappers

### Fixed
- **Zombie Sidebar States** — Resolved sidebar refusing to reopen, frozen states, invisible overlays, presence lifecycle deadlocks, and rapid open/close failures
- **Simplified Event Handling** — Removed custom touch interception in favor of standard browser click handling
- **Cleaner Animation Architecture** — Eliminated duplicate Framer Motion containers; single component owns visibility, entry/exit animations, and overlay lifecycle

---

## [v1.19.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.19.1) — Premium App Shell Skeleton & Startup Experience

### Added
- **AppShellSkeleton** — Immediate application shell rendering with navbar, user profile, sidebar, and content placeholders

### Improved
- **Skeleton-First Authentication** — Background auth while users see the app shell instead of spinners
- **Zero Layout Shift** — Skeleton mirrors production layout for seamless hydration

### Removed
- "Authenticating, please wait…" screen, authentication spinner, route-level loading spinner, generic loader from `App.jsx`

---

## [v1.19.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.19.0) — Real Analytics & Premium Loading Experience

### Added
- **Real Sales vs Collections Analytics** — Backend aggregates daily invoice revenue and daily payment collections; merged by date with zero-fill for missing days
- **Premium Shimmer Skeleton System** — `ShimmerBone` component with `@keyframes shimmer-wave` animation
- **Page-Specific Skeleton Loaders** — Dashboard, Customers, Products, Invoices, Invoice Create/Edit, Collections, Credits, Employees, Employee Analytics, Notes, Settings, GST Reports
- **GST Report Skeleton** (`GstReportSkeleton.jsx`)

### Improved
- **Invoice Workflow** — Clearing a draft while editing no longer overwrites existing invoices
- **Cache Synchronization** — Invoice creation/updates now invalidate both SWR and React Query caches (`customer-summary`, `customer-invoices`, `customer-payments`)
- **Collections Mobile Cards** — Customer avatar, payment amount, time, invoice badge, manual entry badge, payment method
- **Products Rate Field** — Dedicated Rate column between MRP and GST on desktop; included in mobile pricing details

### Removed
- `Math.random()` from collections analytics — replaced with real backend data
- Duplicate Collections entry from admin navigation

---

## [v1.18.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.18.0) — FIFO Payment Allocation & Workflow Enhancements

### Added
- **True Chronological FIFO Payment Allocation** — Optional mode to settle multiple outstanding debts in strict chronological order (Opening Balances → Invoices)
- **Reusable FIFO Engine** — `buildFifoAllocations()` utility with chronological allocation, currency rounding, reusable output structure
- **Unified Chronological Queue** (`fifoQueue`) — Combines opening balances and outstanding invoices into a single normalized payment queue
- **Live Allocation Preview** — Type, reference, date, outstanding amount, allocated amount with visual status indicators (🟢 Fully / 🟠 Partially / ⚪ Not Allocated)
- **Summary Card** — Total Outstanding, Payment Amount, Total Allocated, Remaining Outstanding
- **Two-Step Confirmation** — Bulk allocations require confirmation before execution
- **Sequential Processing** — Progress indicator with current/total allocations and animated progress
- **Modal Protection** — Close button, Escape key, and backdrop clicks disabled during FIFO execution
- **Failure Recovery** — Processing stops on failure; successful allocations preserved; customer data refreshes

### Improved
- **Financial Accuracy** — All allocation calculations use `roundCurrency()` to eliminate floating-point issues
- Full backward compatibility — FIFO mode is completely optional

---

## [v1.17.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.17.0) — Enhanced Payment Workflow & Credit Note Integration

### Added
- **Reusable Custom Dropdown** (`CustomDropdown.jsx`) — React Portal rendering, keyboard navigation, focus management, rich option rendering, option grouping
- **Direct Payment Recording** — Record Payment action directly from Invoice View with automatic invoice selection
- **Payable Invoice Aggregation** — `getInvoicesWithCreditNotesPage()` dynamically calculates outstanding as Net Total − Paid Amount − Credit Note Total

### Improved
- **Credit Note-Aware Balances** — Outstanding = Invoice Total − Payments − Credit Notes across Payment Modal, Invoice View, Customer Details, Invoice APIs, Payment Validation
- **Rich Invoice Selection** — Invoices display number, date, and outstanding amount in dropdown
- **Stronger Payment Validation** — Backend rejects payments when invoice is fully paid or fully settled through credit notes
- **Unified Settlement Logic** — Single source of financial truth across Invoice View, Record Payment Modal, Customer Details, and all APIs
- **Simplified `canRecordPayment`** — Single boolean replaces multiple payment status checks in Customer Details

---

## [v1.16.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.16.0) — Customer Filtering, Payment Workflows & Admin Payment Settings

### Added
- **Advanced Customer Filtering** — Server-side filtering with `buildCustomerFilter.ts` query builder
- **URL-Synchronized Filters** (`useCustomerFilters.js`) — Refresh persistence, deep linking, browser Back/Forward support, shareable filtered views
- **Customer Filter Panel** — Status, GSTIN, Drug License, Phone, Email, Address, Created Date Range, server-side sorting
- **Inactive Customer Lifecycle** — Mark inactive, reactivate, display badges; blocked from creating invoices, recording payments, creating manual entries
- **Invoice Payment Information** — UPI ID, Bank Account, IFSC Code snapshot at invoice creation; displayed in PDF, print, and Invoice View
- **Admin Payment Settings** — Enable/disable payment info, update UPI ID, Bank Account, IFSC Code from Settings

### Improved
- **Customer Payment History** — Redesigned with `$unionWith` aggregation, early filtering, deferred lookups, `allowDiskUse(true)`, compound index optimization
- **Role-Based Settings Access** — Payment Information, Settings, Password Management, Preferences restricted to admins
- **Auth Response** — Now includes `paymentInformation` for frontend initialization without extra API calls

---

## [v1.15.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.15.0) — Responsive Invoice Experience, Financial Accuracy & Navigation Improvements

### Added
- **Responsive Invoice Creation** — `InvoiceItemMobileCard.jsx` for mobile/tablet; auto-selects layout via `useMediaQuery('(min-width: 950px)')`
- **Faster Product Entry** — Newly selected products inserted at top of invoice list

### Improved
- **Financial Reporting Accuracy** — Fixed floating-point precision issue where fully paid invoices showed phantom ₹0.00 balances; aggregation pipelines now use `$round()` and `$gt: 0.01`
- **Sidebar Stability** — Removed duplicate overlay, established `DashboardLayout` as single source of truth, smoother animations, background scroll lock
- **Customer Current Dues** — Fixed ₹0 display by requesting `includeInvoices=true`

---

## [v1.13.2](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.13.2) — Sales Analytics Timezone Consistency Fix

### Fixed
- **IST Timezone Consistency** — All date-based MongoDB aggregations now use `Asia/Kolkata` timezone, fixing invoices created around midnight IST being grouped into wrong reporting periods
- Applied to `$month`, `$year`, `$dateToString` operators in `salesAnalyticsService.ts`
- Affects daily sales, monthly sales, sales trends, revenue summaries, and dashboard widgets

---

## [v1.13.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.13.1) — Customer Ledger Database Performance Optimization

### Improved
- **Compound Index Optimization** — Targeted indexes for Invoice, Payment, Credit Note, and Manual Entry collections matching ledger aggregation query patterns
- **Query Execution** — COLLSCAN eliminated in favor of IXSCAN; B-tree index traversal for initial matching stages

### Performance Benchmarks
| Scenario | Before | After | Improvement |
|---|---|---|---|
| Cold Start | 128.38 ms | 34.64 ms | ~73% Faster |
| Paginated Query | 56.01 ms | 23.02 ms | ~59% Faster |
| Warm Cache | 24.55 ms | 19.11 ms | ~22% Faster |

---

## [v1.13.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.13.0) — Sales Analytics Dashboard & Unified Reports Hub

### Added
- **Sales Analytics Module** — Complete analytics dashboard with revenue, collections, outstanding balances, invoice trends, product/customer performance, payment distribution
- **Unified Reports Hub** — `/reports` route with tabbed interface for Sales Analytics and GST Reports
- **TypeScript Analytics Backend** — Isolated module at `backend/src/modules/salesAnalytics` with strict typing
- **7 Sales Analytics API Endpoints** — Overview, monthly, daily, yearly, top products, top customers, payment trends
- **TanStack Query (v5) Integration** — Hybrid data layer alongside SWR with 7 reusable React Query hooks
- **6 Animated KPI Cards** — Revenue, Collections, Outstanding, Invoice Count, Growth Indicators
- **7 Interactive Charts** — Sales Trend, Monthly Revenue, Invoice Volume, Sales vs Collections, Top Products, Top Customers, Payment Distribution (built with Recharts)
- **ChartWrapper.jsx** — Shared chart infrastructure with error boundaries, responsive behavior, empty states
- **URL-Based Filter Persistence** — Migrated from `useState + localStorage` to `useSearchParams`
- **express-validator** — Input validation for analytics endpoints

---

## [v1.12.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.12.0) — Settings Page, User Preferences & Responsive Calculator

### Added
- **User Preferences Infrastructure** — `preferences` object on Admin and Employee models; initial `showCalculator` preference
- **Preferences API** — `PUT /api/auth/preferences` with safe nested updates
- **Settings Page** (`SettingsPage.jsx`) — Replaced `/profile` with `/settings`; vertical tab layout
- **Role-Based Settings** — Admins: General, Preferences, Security; Employees: Preferences, Security
- **Global Calculator Preference** — Visibility driven by `user.preferences.showCalculator` synchronized through `AuthContext`

### Improved
- **Responsive Calculator** — Container queries (`container-type: size`), dynamic typography with `clamp()` + `calc(cqw + cqh)`
- **Premium Settings UI** — Deep glassmorphism, floating labels, dynamic gradients

### Removed
- `ProfilePage.jsx` — Replaced by `SettingsPage.jsx`

---

## [v1.11.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.11.0) — Virtualized Lists, Responsive Tables & Frontend Performance

### Added
- **VirtualizedList.jsx** — Built on `@tanstack/react-virtual`; only visible rows mounted, DOM recycling on scroll
- **Virtualization Applied** — Invoices, Products, Customers, Credits
- **CSS Grid Table Architecture** — Headers and rows share identical column definitions
- **Mobile Card Layouts** — Responsive cards for Customers, Products, Invoices, Credits

### Improved
- **Horizontal Scrolling** — `overflow-x-auto` on desktop table containers for tablet support
- **Touch Interaction** — Mobile invoice card navigation restricted to header only
- **Optimistic UI** — Printed status toggle now prioritizes local state over stale SWR data
- **Adaptive Typography** — Adjusted text sizes, icon sizes, padding, spacing for mobile

---

## [v1.10.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.10.0) — SEO, Security Hardening & Global Calculator System

### Added
- **Global Calculator System** — Floating calculator with dragging, docking (left/right/bottom), resizing, minimized mode, route/refresh persistence via localStorage, 10-calculation history, real-world percentage behavior
- **SEO Infrastructure** — Canonical URLs, Open Graph metadata, JSON-LD Schema, auto-generated `robots.txt` and `sitemap.xml`
- **Vercel Security Configuration** — `vercel.json` with security headers and SPA rewrites
- **Product Rate Display** — Rate shown directly in Product Details

### Improved
- **BrowserRouter Migration** — `HashRouter` → `BrowserRouter` for cleaner URLs and better SEO
- **Helmet Security** — Content Security Policy (CSP), Permissions Policy headers
- **Environment Configuration** — `VITE_API_URL`, `VITE_FRONTEND_URL` variables for environment-driven configuration

---

## [v1.9.2](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.9.2) — UI Rendering & Touch-Device Visibility Fixes

### Fixed
- **Green Button Flash** — Replaced Motion overlay with CSS `group-hover:opacity-[0.15]`; added `inherit={false}` for variant isolation
- **Mobile Action Button Visibility** — Added `group` class to customer card root; updated breakpoints from `md:` to `lg:` so tablets (768–1023px) always show action buttons
- **Notes Page Accessibility** — Edit, Delete, Pin, and footer buttons now always visible on touch devices

---

## [v1.9.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.9.1) — UX Polish, Cache Optimization & Transition Fixes

### Added
- **TableSkeleton** — Professional skeleton loading with Framer Motion shimmer effects

### Improved
- **SWR Cache Optimization** — Lists derive directly from `data.invoices`/`data.customers` synchronously on page 1; eliminates full-page spinner flashes on cached revisits

### Fixed
- **Page Transition Flicker** — Removed artificial `setTimeout(..., 500)` during auth hydration
- **Route-Aware First Visit Tracking** — `useRef(new Set())` tracks visited routes independently
- **Mobile Landing Navigation** — Wrapped `scrollToSection()` in `setTimeout(..., 100)` after drawer close for iOS Safari compatibility
- **Fixed Header Offset** — Added `scroll-mt-20` to landing-page target sections

---

## [v1.9.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.9.0) — Frontend Performance, Motion Optimization & UX Refinements

### Added
- **`useFirstVisit()` Hook** — Prevents entrance animations from replaying on page revisits
- **`useMediaQuery()` Hook** — Responsive motion behavior and conditional rendering
- **`useTransitionDelay()` Hook** — Delays heavy component mounting until page transitions finish

### Improved
- **Motion Optimization** — Large-scale cleanup across Collections, Credits, Customers, Invoices, Notes, Products, GST Reports; replaced deeply nested `motion.div` with semantic HTML
- **Collections Page SWR Migration** — Replaced `useEffect()` manual fetching with `useSWR()` (5-minute TTL)
- **Customer Fetch Size** — Reduced from 50 to 25 records per request
- **Product SWR State Seeding** — Product lists initialize from existing SWR cache
- **Layout Stability** — `scrollbar-gutter: stable` for consistent page widths
- **Infinite Scroll UX** — Sentinels only render when `hasMore === true`; loader text only when `isValidating === true`

### Fixed
- **Registration Auto-Login** — Explicitly assigns `userRole = 'admin'` during registration auto-login

---

## [v1.8.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.8.1) — Mobile UX & Performance Polish

### Added
- **GPU-Accelerated Mobile Hero Animations** — `@keyframes heroShapeIn` using only `transform` and `opacity` for compositor-thread rendering
- **Dynamic Rotation** — CSS variables `--start-rotate` and `--end-rotate` for lightweight rotation effects

### Improved
- **Mobile Visual Clarity** — Gradient opacity increased from 0.08–0.12 to 0.15–0.22; faux glass effect with visible borders, layered shadows, inner glow (no `backdrop-blur`)
- **Battery Performance** — Removed infinite floating animation (`y: [0, 15, 0]`); shapes animate once and settle

### Fixed
- **Notes Page Mobile Accessibility** — Action buttons (Edit, Delete, Pin) always visible below 768px; hover-to-reveal on desktop

---

## [v1.8.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.8.0) — Search Engine Optimization & Debounce Architecture Upgrade

### Added
- **High-Performance Bounded Fuzzy Search** — Centralized search utility architecture with shared TypeScript search infrastructure
- **Frontend Debounce Standardization** — Consistent debounce handling across all search inputs

### Improved
- **SWR Race Condition Handling** — Eliminated stale search results from overlapping requests
- **Search Performance** — Bounded result sets and optimized query patterns

---

## [v1.7.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.7.1) — Products Search Consistency & UI Polish Fixes

### Fixed
- **Search Results Race Condition** — Replaced `useEffect`-based accumulator with synchronous render-time derivation using `useRef()` and guarded render-state synchronization; eliminates stale product rows during rapid searches
- **Search Bar Focus Animation** — Replaced `scale: 1.02` (caused layout shifting) with `boxShadow` focus ring glow; added `rounded-lg` for correct border following

---

## [v1.7.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.7.0) — Enhanced Invoice Exports, Audit Reporting & Product GST Reliability

### Added
- **Cancelled Invoice Audit Handling** — Cancelled invoices remain visible but excluded from financial totals (totalAmount, totalGST, totalCash, totalCredit); active/cancelled counts shown separately
- **PDF Cancelled Invoice Styling** — Light red background, red text, "CANCELLED" warning banner on single invoice PDFs
- **Firm Branding in Exports** — Firm name, date range, export timestamp in both PDF and Excel; `formatDateRange()` utility for smart date formatting
- **Professional PDF Header** — Firm Name (bold 16pt centered), subtitle with report title, date range, timestamp
- **Excel Workbook Header** — Row 1: Firm Name (merged, bold 16pt), Row 2: Date Range (merged, italic 10pt), dynamic freeze pane

### Fixed
- **0% GST Edit Bug** — Changed `product.gstPercentage || 12` to `product.gstPercentage ?? 12` so 0% GST is preserved correctly
- **Product Creation GST Validation** — Initial state changed to `gstPercentage: ''` with "Select GST %" placeholder; blocks submission until explicitly selected

---

## [v1.6.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.6.0) — Invoice Domain Refactor & Production-Ready PDF Export System

### Added
- **Hybrid TypeScript Backend** — `tsx` runtime allowing `.js` and `.ts` side-by-side; `tsconfig.json` added
- **Invoice Domain Architecture** — Reorganized into `backend/controllers/invoice/` with shared types (`types.ts`), barrel exports (`index.ts`), and dedicated export controller
- **Single Invoice PDF Export** — `GET /api/invoices/:id/pdf` generating professional Tax Invoice PDFs with business info, customer details, GST sections, amount in words
- **Bulk PDF Export** — `GET /api/invoices/export?format=pdf` with multi-page support and date-range filtering
- **Memory-Safe Streaming** — PDF streams directly into HTTP response instead of buffering in memory
- **Export Loading State** — `isExporting` flag disables export button and shows spinner during export

### Fixed
- **Export Count Accuracy** — Backend date-range filtering is now source of truth; removed misleading frontend count display

---

## [v1.5.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.5.0) — Frontend Architecture & Structural Refactor

### Improved
- **Feature-Domain Structure** — Pages reorganized into `pages/Auth/`, `pages/Dashboard/`, `pages/Invoices/`, etc.
- **Service Layer** — Services grouped into domain-based folders: `services/auth/`, `services/customers/`, `services/invoices/`, `services/products/`
- **Shared Components** — Categorized into `components/Common/Buttons/`, `Dialog/`, `Feedback/`, `Modals/`, `Motion/`
- **Context Rename** — `src/context/` → `src/contexts/` for better semantics
- **Import Path Modernization** — Normalized imports across App.jsx, layout files, hooks, services, contexts, and components

---

## [v1.4.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.4.0) — Legal System, Theme Modernization & Mobile Performance Upgrade

### Added
- **Legal Pages** — `/privacy-policy` and `/terms` routes with `PrivacyPolicyPage.jsx` and `TermsPage.jsx`; lazy-loaded public routes
- **Legal Styling System** — Complete `.pp-*` design system for headers, sections, table of contents, callout boxes, tables, footers
- **Registration Consent Flow** — Privacy Policy and Terms links during registration (open in new tab)
- **Legal Documents** — `PRIVACY_POLICY.md` and `TERMS_AND_CONDITIONS.md` added to repository
- **Theme System** — `themeColors.js` centralized accent management; `migrate-theme.mjs` migration utility; Purple/Violet → Teal/Cyan migration
- **Smart Support Email** — Mobile: native `mailto:`; Desktop: copy to clipboard with "✓ Copied!" feedback

### Improved
- **Mobile Performance** — Near-zero GPU-heavy effects on ≤768px; removed ~34 animated elements, ~30 IntersectionObservers, blur filters on mobile; replaced `blur-[80px+]` with `radial-gradient()`; removed `backdrop-blur` from cards; static rendering for motion wrappers; instant stats rendering with proper cleanup
- **Hero Shape Optimization** — Disabled motion/blur/infinite floating animations on mobile; replaced with static lightweight rendering

---

## [v1.3.1](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.3.1) — Soft-Delete Product Visibility Fix

### Fixed
- **Product Listing Query** — Added `isActive: true` filter to `getProducts()` to match existing soft-delete architecture; soft-deleted products now correctly hidden from listings while preserved in database for audit/history

---

## [v1.3.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.3.0) — Multi-Tenant Hardening & Financial Consistency Upgrade

### Added
- **Controller-Level Tenant Enforcement** — All controllers refactored from `findById(id)` to `findOne({ _id: id, tenantId })` across creditNote, customer, invoice, manualEntry, note, product, and payment controllers
- **Tenant-Scoped Database Indexes** — Customer phone (`{ tenantId: 1, phone: 1 }`) and Credit Note number (`{ tenantId: 1, creditNoteNumber: 1 }`) compound unique indexes
- **Notes Tenant Support** — `tenantId` and tenant indexing added to Note model
- **Migration Scripts** — `migrateCustomerPhoneIndex.js` and `migrateCreditNoteNumberIndex.js` with npm commands
- **Smart Cache Invalidation** — `invalidateCachedRequest()`, `invalidateCachedRequestsByUrl()`, `invalidateCustomerCache(id)` utilities
- **Payment Modal Fresh-State Validation** — Refetches latest invoice state before recording payment

### Fixed
- **Payment Ledger Safety** — Outstanding balance adjustments now execute only when `invoice.paymentType === 'Credit'`; prevents incorrect balance modifications for Cash/Online payments
- **Tenant Error Messages** — "Phone number already exists for another customer in this tenant"

---

## [v1.2.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.2.0) — Multi-Tenant Stability & Cache Architecture Upgrade

### Added
- **Tenant-Safe Invoice Architecture** — Tenant-scoped numbering, customer validation, history loading, queries, and firm info resolution
- **Invoice Database Indexes** — `{ tenantId, invoiceNumber }` unique and `{ tenantId, createdAt: -1 }` compound indexes
- **Infinite Scrolling** — `IntersectionObserver`-based progressive loading for outstanding customers and ageing invoices
- **SWR Hook Refactor** — In-flight request deduplication, recent-request deduplication, background revalidation, `hasData` tracking
- **Auth Cache Safety** — `clearApiCache()` and `clearClientCaches()` during login/logout

### Improved
- **Invoice Creation Performance** — Batched product fetching (`$in`), duplicate line-item aggregation, bulk stock updates (`bulkWrite()`), reduced DB round trips
- **Reporting Performance** — MongoDB aggregation pipelines replacing JS processing; ageing report payload reduced from 2.3 MB to ~5 KB; parallel aggregations
- **Customer API** — `GET /api/customers/:id?includeInvoices=false` support
- **Sidebar Invoice Count** — Replaced manual fetching with `useSWR()` with cache TTL

---

## [v1.1.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.1.0) — Performance & Scalability Upgrade

### Added
- **Compound Database Index** — `{ tenantId: 1, status: 1, paymentStatus: 1, invoiceDate: -1 }`
- **Infinite Scroll System** — `IntersectionObserver` for outstanding customers and ageing invoices
- **SWR Caching** — `useSWR()` with cache TTL for instant cached rendering and background refresh

### Improved
- **Reporting Performance** — MongoDB aggregation pipelines (`$group`, `$project`, `$switch`, `$cond`, `$match`, `$addToSet`) replacing JS-heavy processing
- **Outstanding Report** — Customer grouping, due calculations, overdue logic, and credit note aggregation moved into MongoDB; added backend pagination
- **Credit Stats** — Single optimized aggregation for outstanding totals, overdue totals, and unique customer counting
- **Ageing Report** — Bucket calculations moved into MongoDB with `$switch`; `$skip` + `$limit` pagination; payload reduced from 2.3 MB to ~5 KB

---

## [v1.0.0](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/v1.0.0) — Initial Stable Production Release

### Added
- **Full Credit Note Integration** — Outstanding calculations, customer balances, credit stats, invoice due tracking, payment validation, ledger & printable reports
- **Financial Precision** — `round2()` utility eliminating ₹0.01 floating-point issues
- **Stock History Enum** — Added missing `sales_return` enum value preventing crashes during stock return operations

### Improved
- **Dashboard & Reports** — Corrected date filtering logic and tenant-based aggregation
- **Low Stock Threshold** — Changed from 10 to 5 for more practical inventory alerts
- **Financial Table Alignment** — Professional accounting-style alignment for currency, GST, quantity, and text columns
- **Mobile Responsiveness** — Touch-friendly layouts, proper spacing, and responsive adjustments
- **Invoice Print Layout** — Professional print styling with proper page margins and formatting
