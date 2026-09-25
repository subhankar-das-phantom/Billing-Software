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
3. **Financial Counter Precision & Paise Integrity**:
   - **Zero Truncation on Financial Totals**: Never truncate or round financial metrics (outstanding balances, credit limits, invoice dues, purchase totals) with `Math.round()` or hardcoded `decimals={0}`. Truncating paise creates false discrepancies between KPI cards (e.g. showing `₹7,038`) and underlying ledgers or invoice lists (e.g. showing `₹8,063.03` or `₹7,038.38`).
   - **Mandatory 2-Decimal Precision**: Always pass `decimals={2}` to animated counters or formatters displaying currency (`<AnimatedCounter target={value} decimals={2} />`).
   - **Indian Numbering Standard (`en-IN`)**: Format all monetary figures using the Indian numbering system (`Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`) so thousand/lakh separators render correctly (`₹1,23,456.78`).
   - **Visual & Query Parity**: Ensure that values rendered in customer/supplier profile headers match the live transactional sum from tables and ledgers down to the exact paisa.
4. **Mobile-First Responsiveness**:
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
6. **Dropdown, Menu, Popover & Floating Panel Anti-Flicker Engineering**:
   - **Forbid Spring Physics & Center Scale on Floating Elements**: Spring physics (`type: 'spring'`) causes high-frequency subpixel oscillations that trigger border anti-aliasing shimmering on 1px borders (`border-slate-700/80`), deep box-shadow rasterization thrashing (`shadow-2xl shadow-black/60`), and text blurring on Chromium. Always use GPU-accelerated opacity and subtle Y-glide:
     ```jsx
     initial={{ opacity: 0, y: -6 }}
     animate={{ opacity: 1, y: 0 }}
     exit={{ opacity: 0, y: -6 }}
     transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
     ```
   - **Mandatory Transform Anchor Origin**: Floating cards positioned via `right-0` (or `left-0`) must explicitly define `style={{ transformOrigin: 'top right' }}` (or `'top left'`). Never allow the browser to default to `center center`, which causes anchored edges to drift horizontally and snap back during opening/closing.
   - **Compositor Layer Promotion**: Always add `will-change-[transform,opacity]` or `style={{ willChange: 'transform, opacity' }}` to isolate the dropdown panel on its own GPU compositor layer immediately upon mounting.
   - **Trigger Button Active Open State Locking**: Trigger buttons must NEVER rely solely on `:hover` classes. When the dropdown menu is open (`isOpen` / `aria-expanded="true"`), the trigger button must be conditionally styled to retain its active background/border (`isOpen ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-xs' : 'bg-slate-800/40 hover:bg-slate-800/80...'`). This prevents the button from losing hover and triggering abrupt `transition-colors` back and forth when the user navigates the cursor across the gap into the dropdown menu.
   - **Trigger Child Event Isolation**: Apply `pointer-events-none` to inner text, avatars, and indicator SVGs inside trigger buttons to ensure stable event target resolution directly on the `<button>`. Use functional state updaters `setIsOpen((prev) => !prev)` to avoid closure races.
   - **Indicator Transition Synchronization**: Match the transition duration of indicator chevrons (e.g. `duration-150`) to the dropdown panel's exit/entry duration (`0.15s`).

---

## 🛡️ Defensive Data Rendering & Table Column Shape Parity

1. **Dual-Shape Table Column Renderers**:
   - When rendering tables or item lists (such as invoices, bills, credit notes, or receipts), never assume a single strict schema (e.g. `item.product.productName`, `item.ratePerUnit`, `item.quantitySold`).
   - Always implement nullish-coalescing fallbacks for flat data structures:
     - Product Name: `item.product?.productName ?? item.productName ?? item.name`
     - Rate: `item.ratePerUnit ?? item.rate ?? 0`
     - Quantity: `item.quantitySold ?? item.quantity ?? 0`
     - Batch: `item.product?.batchNo ?? item.batchNumber ?? item.batchNo`
     - Expiry: `item.product?.expiryDate ?? item.expiryDate`
     - Total: `item.totalAmount ?? (qty * rate)`
2. **Defensive Numeric & String Method Calls**:
   - Never call `.toFixed()`, `.slice()`, or `.charAt()` without nullish coalescing or optional chaining:
     - `(Number(val) || 0).toFixed(2)`
     - `(Array.isArray(list) ? list : []).slice(0, limit)`
     - `(str || '?').charAt(0)`
   - Never perform direct `.length` lookups on potentially undefined nested arrays without null-safe fallback `(activities?.invoicesCreated || []).length`.

---

## 🧪 Demo Mode & Mock Adapter Data Parity Protocols

1. **Dual-Source Binding Synchronization (Root Entity vs Summary Object)**:
   - When building mock endpoints or detail views, always synchronize root entity properties (`entity.totalPurchases`, `entity.invoiceCount`) with the `summary` object (`summary.totalPurchases`, `summary.invoiceCount`). Detail pages frequently bind KPI cards to both locations; failure to synchronize leads to contradictory numbers on the same page.
2. **Per-Entity Mock Isolation**:
   - Mock endpoints must filter collections strictly by entity ID (e.g. `customerId`, `supplierId`). Never return global mock arrays for specific entity queries.
3. **Deep-Link Key Integrity**:
   - Mock records must always populate valid relationship IDs (`invoiceId`, `invoice: { _id, invoiceNumber }`) to prevent broken `/undefined` navigation routes.
4. **Authentic Business Variance in Mock Analytics**:
   - Mock charts and analytics must avoid flat lockstep percentages (e.g. daily collections locked to 88% of daily sales). Use natural variance with independent sales spikes, weekend dips, and lagged payment clearing waves.

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
- [ ] **Dropdown Anti-Flicker & Zero Spring Scale**: Dropdown menus, popovers, and floating cards use GPU-accelerated opacity/Y-glide (`duration: 0.15s`), explicit `transformOrigin`, `will-change-[transform,opacity]`, locked active button styling when open, `pointer-events-none` on button children, and zero spring oscillations.
- [ ] **Defensive Table Column Renderers**: Column renderers provide nullish-coalescing fallbacks for nested vs flat data (`item.product?.name ?? item.name`, `item.ratePerUnit ?? item.rate`), never calling `.toFixed()` on undefined.
- [ ] **Defensive String & Array Calls**: All `.slice()`, `.toFixed()`, and `.charAt()` calls are guarded by nullish coalescing and optional chaining.
- [ ] **Mock Adapter Parity & Isolation**: Mock endpoints isolate data per entity ID, populate relationship IDs for deep-links, and synchronize both root `entity.*` and `summary.*` fields to avoid split KPI counts.
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
- [ ] **Financial Precision & Paise Preservation**: Currency counters and KPI summaries use `decimals={2}` with `'en-IN'` locale formatting, never truncating cents/paise via `Math.round()` or `decimals={0}`.
- [ ] **Visual Parity with Ledger**: Entity balance cards match live table/ledger sums exactly with zero rounding drift.
- [ ] **Build Validation**: Verified that `npm run build` compiles with 0 errors and all chunks bundle cleanly.
- [ ] **No Autonomous Browser Launch**: Never open Chrome or invoke browser subagents for frontend testing unless explicitly directed by the user.
