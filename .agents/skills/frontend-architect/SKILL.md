---
name: frontend-architect
description: >-
  Use this skill when designing, building, or refactoring frontend interfaces, components,
  and user flows. Enforces high-density enterprise aesthetics (anti-vibecoded), mobile-first
  responsiveness, touch accessibility, zero-CLS layout stability, and prevents common frontend event/state bugs.
---

# Frontend Architect Skill

This skill ensures that all UI development in the Bharat Enterprise platform adheres to senior enterprise standards, eliminates amateur AI-generated design tropes, and safeguards against known frontend bug patterns.

---

## 💎 Design System & Aesthetic Standards

1. **Enterprise Dark Palette**:
   - Primary App Shell: `bg-slate-950`
   - Glass Cards & Containers: `bg-slate-900/60` or `bg-slate-900/80` with `border border-slate-800/80`
   - Card Headers: `bg-slate-950/40` with `border-b border-slate-800`
   - Interactive Hover States: `hover:bg-slate-800/40` with smooth transitions (`transition-colors`)
2. **Numeric Data & Badging**:
   - Currency (`₹`), counts, dates, quantities, HSN codes, and batch numbers must use `font-mono`.
   - Semantic pills:
     - Emerald (`bg-emerald-500/15 text-emerald-400 border border-emerald-500/25`): Active, Healthy, Paid.
     - Amber (`bg-amber-500/15 text-amber-400 border border-amber-500/25`): Low Stock, Approaching Expiry, Grace Period.
     - Rose (`bg-rose-500/15 text-rose-400 border border-rose-500/25`): Out of Stock, Overdue, Cancelled.
3. **Mobile-First Responsiveness**:
   - Every banner, card, and modal header must stack cleanly on small viewports: `flex-col sm:flex-row`.
   - Touch targets must be minimum 44px on mobile: buttons should use `w-full sm:w-auto`.
   - Absolute dismiss buttons must have padding buffers to avoid text clipping.

---

## 🚀 Zero-CLS Layout Stability & Anti-Lag Protocol

1. **Forbid `height: 'auto'` Spring Physics on Top-Level Banners**:
   - Animating `height: 0` to `height: 'auto'` with spring physics causes continuous layout recalculations (CLS thrashing) on every single frame, thrashing SVG graphs (Recharts), data tables, and KPI cards below it.
   - **Mandatory Pattern**: Animate GPU-accelerated opacity and subtle Y-translation (`duration: 0.15s, ease: [0.16, 1, 0.3, 1]`) with explicit `will-change: transform, opacity`.
2. **Instant Frame-0 State Pre-Seeding (Eliminate 300ms Pop-In)**:
   - For global notification banners (subscription grace period, trial status, offline banners), pre-seed React state synchronously from `localStorage` (`localStorage.getItem('cached_subscription')`) on context initialization.
   - This ensures banners mount on Frame 0 with zero delayed layout shift while background network verification executes seamlessly.
3. **Session Dismissal Persistence**:
   - Persist temporary banner dismissals in `sessionStorage` (`sessionStorage.getItem('dismissed_subscription_banner')`). Navigating across routes within the same tab must NOT re-trigger dismissible banner entry animations.
4. **Modal Opening & Closing Performance**:
   - Eliminate heavy backdrop filter blurs (`backdrop-blur-md` on full screen) that cause GPU stutter on low-end mobile devices and integrated desktop GPUs.
   - Keep modal exit transitions snappy (`duration: 0.15s` or `0.2s` ease-out), avoiding complex unmount cascades and heavy nested Framer Motion trees.
5. **Lightweight Interactive Elements**:
   - Avoid wrapping simple banner or table buttons in heavy Framer Motion components (`motion.button`). Use native CSS hardware-accelerated transforms (`active:scale-95 transition-transform duration-100`).

---

## 🔍 Universal Search Debouncing & Ergonomic Search UX

1. **Standardized Debounce Requirement**:
   - Every search input throughout the application (Collections, Customer lookups, Employee directories, Manual Entries, Activity Logs, Inventory Analytics) MUST be debounced:
     - **Remote Network Search**: Standard 300ms debounce (`useDebounce(searchTerm, 300)`).
     - **Local In-Memory Filter**: 250ms debounce.
2. **Ergonomic Clear (`X`) Buttons**:
   - Every search input must render an instant clear button (`X` icon with `p-0.5 text-slate-400 hover:text-slate-200`) whenever the query is non-empty.
3. **Contextual Fallback Actions in Empty States**:
   - When a search produces 0 results inside a bounded scope (e.g. today's date), provide an actionable 1-click fallback button: *"No payments matching '{search}' in {dateLabel}. [Search All Dates]"*.

---

## 🎨 Theme Architecture & Landing Page Integrity

1. **Default Dark Obsidian Tokens**:
   - `:root, .dark, html.dark` must establish canonical dark tokens by default (`--color-slate-950: #09090b; --color-slate-900: #121215; --color-slate-800: #2a2b32;`).
2. **Landing Page Dark Showcase Lock**:
   - The `/landing` showcase route must lock to dark mode (`html.dark` with meta theme-color `#09090b`) to preserve 3D WebGL particle galaxy canvases and glowing glassmorphic elements. Cleanly restore the user's previously configured theme mode upon unmount.
3. **Backend Preference Synchronization**:
   - On authentication (`login`, `checkAuth`), synchronize the user's stored MongoDB `themeMode` (`'dark' | 'light' | 'system'`) into `ThemeContext` and update backend preferences on toggle.

---

## ⚡ Virtualization, Pagination & Query Strategy

1. **Virtualization for Long Lists**:
   - For collections exceeding 50 items (catalogs, ledgers, audit logs), wrap rows in `@tanstack/react-virtual` using `VirtualizedList` or `InfiniteVirtualizedList`.
   - Never render hundreds of unbounded DOM nodes directly.
2. **Scenario-Based Strategy**:
   - **Numbered Pagination**: Administrative tables, financial reports, and audit trails where direct page access and exact print bounds are required.
   - **Infinite Scroll / Lazy Loading**: Interactive lookups, search dropdowns, customer selectors, and mobile list views.
3. **Anti-Stale Data & Zero-Skeleton-Flicker Architecture**:
   - **Operational CRUD Pages (`useSWR`)**:
     - For operational tables (Employees, Inventory Ledger, Manual Entries, Referral Code/Stats), leverage `useSWR(key, fetcher, { ttl: 30 * 1000 })`.
     - Data is pre-seeded instantaneously on Frame 0 from `localStorage` without blank screen/skeleton flickering.
     - Background revalidation (`isValidating = true`) runs silently and updates the UI seamlessly without unmounting components.
     - **Header Refresh Feedback**: Pair with `<RefreshIndicator isRefreshing={isValidating} size="sm" showText />` in the page header so the user has subtle feedback when fresh data is syncing.
     - **Synchronous Stat Derivation**: Derive summary metrics, totals, and counts directly from SWR state via `useMemo` (e.g. `const stats = useMemo(() => ..., [employees])`). Never maintain lagging duplicate `useState` mirrors.
     - **Cross-Tab & Multi-Domain Mutation Invalidation**: Any mutating service method (`create*`, `update*`, `delete*`, `toggleStatus`, `recordPayment*`) must immediately invoke `invalidateCachePattern('domain-prefix')`. This synchronizes in-memory cache, clears `localStorage`, and broadcasts via `BroadcastChannel` across open browser tabs.
   - **Analytical & Reporting Subsystems (TanStack Query)**:
     - For multi-tab analytics suites (e.g. `features/salesAnalytics`, `features/inventoryAnalytics`), use `@tanstack/react-query` (`useQuery`, `staleTime: 60000`, cache-first).
     - Retains aggregated charts and reports in memory across tab switches inside `ReportsPage`, preventing jarring skeleton flashes while allowing manual refetch triggers.

---

## 🖨️ Print Isolation & Document Integrity Protocol

1. **Two-Layer Defense Architecture**:
   - **Layer 1 (Component-Level)**: All non-document UI (toasts, subscription/trial banners, refresh spinners, modals, dropdown menus, floating utilities) must include `no-print` on their root containers. Defensively wrap layout-level banners: `<div className="no-print"><SubscriptionBanner /></div>`.
   - **Layer 2 (Global Print Stylesheet)**: `index.css` must maintain explicit `@media print` rules hiding `.no-print, .no-print *, .toast-container, .toast, .subscription-banner, [role="alert"], [role="status"], [role="dialog"], [role="listbox"]`.
2. **Zero-DOM Manipulation**:
   - Never use JavaScript DOM mutations (`element.remove()`, `display: none`) or `beforeprint` hooks right before `window.print()`. Use deterministic CSS so print preview and Save-as-PDF have zero race conditions with React rendering.

---

## 🛡️ Frontend Bug Prevention Checklist

Before completing any frontend code change, verify that:
- [ ] **Zero-CLS Banner Layout**: Top banners use GPU opacity/translate animations (`duration: 0.15s`), never `height: 'auto'` spring physics.
- [ ] **Frame-0 Cached Mounting & Anti-Stale Data**: Operational pages use `useSWR` (30s TTL) with `localStorage` pre-seeding to eliminate skeleton flicker while silently revalidating in the background.
- [ ] **Reactive Mutation Invalidation**: Service mutation methods (`create`, `update`, `delete`) invoke `invalidateCachePattern` to purge memory, `localStorage`, and multi-tab `BroadcastChannel` states.
- [ ] **Header Refresh Indicator**: Pages utilizing background revalidation include `<RefreshIndicator isRefreshing={isValidating} size="sm" showText />` in their header.
- [ ] **AST Identifier & Import Integrity**: All referenced JSX tags (e.g. `<RefreshIndicator />`) and identifiers are explicitly imported and declared. No duplicate `useState` declarations left behind from legacy code.
- [ ] **Universal Search Debouncing**: All search inputs use `useDebounce` (250–300ms) and include an `X` clear button.
- [ ] **No Event Double-Triggers**: Never attach handlers to both `onMouseDown` and `onClick`. Use `onMouseDown` only for `e.preventDefault()` (focus retention) and `onClick` for action execution.
- [ ] **Atomic Deduplication in Updaters**: Multi-click or fast typing cannot insert duplicate rows. Functional `setItems(prev => ...)` must check `prev.some(...)`.
- [ ] **Defensive Memoized Sorting**: Any list displayed to the user is explicitly wrapped in `useMemo` with an explicit sorting comparator (`(b.value - a.value)`).
- [ ] **Contextual Permission Routing**: Buttons triggering protected flows verify permission and dynamically route or hide cleanly.
- [ ] **Virtualization & Scale**: Collections with > 50 elements leverage `VirtualizedList` or `InfiniteVirtualizedList` with paginated query loading.
- [ ] **Print Isolation Enforced**: Screen-only UI carries `.no-print` and printable invoices remain 100% clean in print preview.
- [ ] **Documentation Path Hygiene**: No machine-specific absolute file URLs (`file:///...`) in git-tracked markdown documentation. Always use repository-relative paths (`src/...`).
- [ ] **Race Condition Immunity**: Out-of-order calls handled by TanStack Query/AbortController, submissions guarded by `useRef` locks, and background jobs keyed by immutable IDs (`_rowId`).
- [ ] **Build Validation**: Verified that `npm run build` compiles with 0 errors and all chunks bundle cleanly.
- [ ] **No Autonomous Browser Launch**: Never open Chrome or invoke browser subagents for frontend testing unless explicitly directed by the user.
