# Frontend Engineering Standards & Anti-"Vibecoding" Principles

This rule establishes strict design standards, layout guidelines, and lessons learned from past frontend bugs in the Bharat Enterprise platform.

---

## 🎨 Design Philosophy: Anti-"Vibecoding" Enterprise Aesthetics

Modern enterprise software must look authoritative, dense, high-contrast, and purposeful. Avoid amateurish "vibecoded" tropes:

### ❌ What to Avoid (Vibecoded Tropes)
- **Oversaturated multi-color neon gradients** (e.g. purple-to-pink-to-cyan headers on everything).
- **Giant low-density cards** with massive empty whitespace that force excessive scrolling.
- **Low-contrast text** (e.g. gray-400 text on dark gray-800 backgrounds with poor readability).
- **Inconsistent border radii and paddings** (`rounded-3xl` next to `rounded-sm`).
- **Gimmicky animations** that delay user interactions or stutter on mid-range hardware.

### ✅ What to Build (High-Density Enterprise SaaS)
- **Base Surface Hierarchy**:
  - Background: `bg-slate-950`
  - Cards & Containers: `bg-slate-900/60` or `bg-slate-900/80`
  - Subtle Contrast Borders: `border-slate-800/80` or `border-slate-700/60`
  - Header / Section Accents: `bg-slate-950/40` with `border-b border-slate-800`
- **Typographic Discipline**:
  - Use `font-mono` for all quantitative numbers, currency (`₹`), quantities, dates, HSN codes, and batch numbers.
  - Clear hierarchy: `text-xs uppercase tracking-wider text-slate-400` for table headers; `font-medium text-white` for primary titles; `text-[10px] text-slate-500` for secondary metadata.
- **Semantic Status Palette**:
  - **Emerald (`text-emerald-400`, `bg-emerald-500/10`)**: Completed, Verified, Healthy Stock, High Velocity.
  - **Amber (`text-amber-400`, `bg-amber-500/10`)**: Near Stockout, Warning, Expiring soon (30-60 days).
  - **Rose (`text-rose-400`, `bg-rose-500/10`)**: Out of Stock, Overdue, Critical, Expired.
  - **Blue / Sky (`text-blue-400`, `bg-blue-500/10`)**: Informational, Draft, Normal operations.

---

## 🐛 Critical Frontend Bug Traps & Proven Patterns

### 1. The Event Double-Trigger Bug (`onMouseDown` vs `onClick`)
**Trap:**
Attaching selection logic to both `onMouseDown` and `onClick` causes double execution on a single click, inserting items twice:
```jsx
// ❌ INCORRECT (Inserts item twice on rapid click)
<button
  onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
  onClick={() => handleSelect(item)}
>
```
**Fix:**
Use `onMouseDown` exclusively to prevent input blur, and trigger the action strictly on `onClick`:
```jsx
// ✅ CORRECT
<button
  onMouseDown={(e) => {
    e.preventDefault(); // Prevents search input from blurring
  }}
  onMouseEnter={() => prefetchCache(item.id)} // Safe background warming
  onClick={(e) => {
    e.stopPropagation();
    handleSelect(item); // Single action trigger
  }}
>
```

### 2. State Updater Deduplication Guard
**Trap:**
Rapid user clicks or keyboard presses can fire multiple synchronous state dispatches before React updates state, prepending duplicate rows.
**Fix:**
Always use an atomic duplicate guard inside the functional state updater:
```jsx
// ✅ CORRECT
setInvoiceItems((prev) => {
  const isDuplicate = prev.some(
    (existing) => String(existing.productId) === String(newItem.productId)
  );
  if (isDuplicate) return prev; // Reject duplicate insertion atomically
  return [newItem, ...prev];
});
```

### 3. Defensive Client-Side Sorting (`useMemo`)
**Trap:**
Assuming API responses are always pre-sorted. Network caches or DB pagination can deliver unsorted items, resulting in jumbled tables.
**Fix:**
Memoize and defensively sort array data in the view component:
```jsx
// ✅ CORRECT
const sortedFastMovers = useMemo(() => {
  return [...(data?.fastMoving || [])].sort((a, b) => 
    (b.unitsSold - a.unitsSold) || (b.velocityRate - a.velocityRate)
  );
}, [data?.fastMoving]);
```

### 4. Search Input Debouncing
**Trap:**
Triggering API calls or expensive regex filters on every single keystroke lags the UI and floods the backend.
**Fix:**
Always debounce inputs by 250ms–400ms:
```jsx
// ✅ CORRECT
const debouncedSearch = useDebounce(searchQuery, 300);
useEffect(() => {
  fetchSearchResults(debouncedSearch);
}, [debouncedSearch]);
```

### 5. Mobile Responsive Layouts & Touch Accessibility
- **Full-Width Touch Targets on Mobile**: Buttons in banners and modals must stretch on mobile: `className="w-full sm:w-auto px-4 py-2"`.
- **Top-Right Absolute Close Buttons**: On small screens (< 640px), position dismiss icons cleanly: `absolute top-3 right-3 sm:static`, with right padding buffer on text containers (`pr-8 sm:pr-0`).
- **Clickable Contact Links**: Always render email addresses as `mailto:email@domain.com` and phone numbers as `tel:+91...`.
- **Contextual Permission Guards**: Never render dead or forbidden action links (e.g., Record Payment shortcuts when collections/invoices are disabled). Check permissions dynamically and adapt the target route or hide the button.

### 6. List Virtualization, Pagination & Infinite Scroll Architecture
- **Mandatory Virtualization for Long Lists**:
  - Whenever rendering large collections (> 50–100 items, such as product catalogs, customer ledgers, invoice histories, or inventory movements), use DOM virtualization via `@tanstack/react-virtual` (`VirtualizedList` / `InfiniteVirtualizedList`).
  - Keeps DOM element count flat (< 30 nodes), prevents memory leaks and mobile browser crashes, and guarantees silky 60fps scrolling.
- **Scenario-Based Loading Patterns**:
  - **Numbered / Discrete Pagination**: Use for dense administrative audit tables, financial registers, and reports where users require exact page counts, direct page jumping, and deterministic print/export views.
  - **Lazy Loading with Infinite Scroll**: Use for interactive product search dropdowns, customer selectors, mobile feeds, and operational logs where users browse progressively.
- **Data Fetching & Cache Management (TanStack Query / SWR)**:
  - Leverage `@tanstack/react-query` (`useQuery`, `useInfiniteQuery`) or SWR for declarative server-state management.
  - Configure sensible caching: `staleTime: 60 * 1000` (1 min) for read-heavy masters (products, customers), and `staleTime: 0` with targeted query invalidation (`queryClient.invalidateQueries(...)`) after mutations.
  - Pair `useInfiniteQuery` directly with `InfiniteVirtualizedList` (`fetchNextPage`, `hasNextPage`, `isFetchingNextPage`) to stream pages dynamically without layout shifting.

### 7. Race Condition Prevention (Network, Events & Asynchronous State)
Always identify and mitigate race conditions before starting implementation:

1. **Network Out-of-Order Race Conditions (Stale Overwrites)**:
   - **The Danger**: Request A (slow network) is sent, user changes filter/tab/search, Request B (fast network) is sent and resolves first. Request A resolves later and overwrites the newer data with stale data.
   - **Standard Fixes**:
     - **Abort In-Flight Requests**: Use `AbortController` in `useEffect` cleanups or pass `signal` to axios/fetch:
       ```javascript
       useEffect(() => {
         const controller = new AbortController();
         fetchData({ signal: controller.signal });
         return () => controller.abort(); // Cancel if query/component changes
       }, [searchQuery]);
       ```
     - **Active Component Flags**:
       ```javascript
       useEffect(() => {
         let isCurrent = true;
         api.get('/data').then(res => { if (isCurrent) setData(res.data); });
         return () => { isCurrent = false; };
       }, [query]);
       ```
     - **Query State Engines**: Use `@tanstack/react-query` or SWR which automatically discard out-of-order query responses for the same query key.

2. **Double-Submit / Double-Execution Race Conditions**:
   - **The Danger**: Rapid double-tapping or keyboard submissions of financial actions (creating an invoice, recording a payment, generating credit notes) firing two parallel network requests before React re-renders the disabled button state.
   - **Standard Fixes**:
     - **Synchronous Execution Lock via `useRef`**: React state updates are asynchronous; a ref updates synchronously:
       ```javascript
       const isSubmittingRef = useRef(false);
       const handleSubmit = async () => {
         if (isSubmittingRef.current) return;
         isSubmittingRef.current = true;
         setIsSubmitting(true);
         try {
           await createRecord();
         } finally {
           isSubmittingRef.current = false;
           setIsSubmitting(false);
         }
       };
       ```
     - **Immediate UI Disabling**: `disabled={isSubmitting}` and `pointer-events-none` on the trigger button.

3. **Asynchronous Background State Race Conditions**:
   - **The Danger**: User modifies invoice rows (e.g. quantity, rate, discount) while an asynchronous batch resolution or FIFO simulation (`_batchPreviewPending`) is in-flight in the background.
   - **Standard Fixes**:
     - Assign immutable row identifiers (`_rowId: crypto.randomUUID()`) to state items rather than relying on index positions.
     - When an async calculation completes, update strictly by `_rowId` rather than array index.
     - Block dependent operations while `_batchPreviewPending` is active.

### 8. Verification & Browser Subagent Prohibition
- **Never Open Chrome Autonomously**: Do NOT launch Chrome or spawn browser testing subagents (`browser_subagent`) to test frontend changes unless the user explicitly commands it.
- **Validation Methods**: Verify frontend correctness via production build checks (`npm run build`), TypeScript/linting validations, and structured manual verification steps provided to the user.

### 9. Print Isolation Architecture & UI Concealment
**Trap:**
UI notifications (toasts, subscription/trial banners, background revalidation indicators), floating widgets, modals, and navigation chrome leaking into browser print previews, physical paper prints, or "Save as PDF" outputs when invoices, credit notes, or ledgers are printed.
**Mandatory Two-Layer Print Isolation:**
1. **Component-Level Canonical `.no-print` Standard**:
   - Every single screen-only element, floating container, toast notification (`ToastContainer`), alert banner (`SubscriptionBanner`), revalidation indicator (`RefreshIndicator`), modal portal (`Modal`, `RecordPaymentModal`, `EditPaymentModal`, `ManualEntryModal`), dropdown menu (`CustomDropdown`), and floating utility (e.g. scroll-to-top button, calculator dock) MUST explicitly include the `.no-print` class on its root container.
   - When wrapping layouts (e.g. `DashboardLayout`), defensively wrap notifications: `<div className="no-print"><SubscriptionBanner /></div>`.
2. **Global `@media print` Defensive Concealment (`index.css`)**:
   - Standardize `.no-print, .no-print * { display: none !important; }`.
   - Explicitly conceal notification containers and status roles:
     ```css
     @media print {
       .no-print,
       .no-print *,
       .toast-container,
       .toast-container *,
       .toast,
       .toast *,
       .subscription-banner,
       .subscription-banner *,
       [role="alert"],
       [role="status"],
       [role="dialog"],
       [role="listbox"],
       aside,
       header,
       nav,
       button,
       .sidebar,
       .navbar,
       [class*="backdrop-blur"] {
         display: none !important;
       }
     }
     ```
3. **Avoid Overly Broad or Fragile Selectors**:
   - Never use bare `[class*="pointer-events-none"]` or hide tags indiscriminately without checking printable templates. Do not break legitimate invoice/ledger layout (`.invoice-print`, `.invoice-copy`).
4. **Zero-DOM Manipulation Print Rule**:
   - NEVER use temporary JavaScript DOM deletion (`element.remove()`), inline display mutations (`element.style.display = 'none'`), or `beforeprint`/`afterprint` hacks. Print isolation must be pure, deterministic CSS to eliminate React render race conditions.

### 10. Documentation & Path Hygiene (Repository-Relative References)
**Trap:**
Hardcoding machine-specific absolute file URLs (e.g. `file:///d:/...` or `C:\...`) into git-tracked markdown documentation (`*.md`), guides, or READMEs.
**Standard:**
- In all git-tracked documentation and markdown guides, NEVER include machine-specific absolute URLs (`file:///d:/...`, `C:\...`).
- Always use clean repository-relative paths (e.g. `src/index.css`, `frontend/src/pages/Invoices/InvoiceViewPage.jsx`) or markdown backticks (`` `src/index.css` ``) so documentation remains portable, clean, and professional across all developers, environments, and GitHub.

### 11. Horizontal Scroll Affordance & Interactive Overflow Navigation (Capsule Peeking)
**Trap:**
Hiding scrollbars (`no-scrollbar` or `overflow-x-auto`) on mobile or desktop navigation strips (e.g. payment channel selector pills, date preset chips) leaves users unable to determine whether additional capsules or buttons extend beyond the visible screen edge ("peeking" ambiguity).
**Standard:**
Implement a dedicated `ScrollAffordanceContainer` incorporating:
1. **Visual Edge Gradient Fades**: Subtle slate gradient masks (`bg-gradient-to-r from-slate-900 to-transparent`) indicating content clipping on the overflowing side.
2. **Interactive Micro-Navigation Chevrons**: Floating, clickable chevrons (`ChevronLeft` / `ChevronRight`) with subtle backdrop blur (`bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 text-slate-300`).
3. **Smooth Slide Action**: Clicking chevrons smoothly scrolls by a fixed quantum (`containerRef.current.scrollBy({ left: -180, behavior: 'smooth' })`).
4. **Dynamic Overflow Detection**: Use `ResizeObserver` and `scroll` event listeners to dynamically reveal/hide arrows only when overflow is physically detected (`scrollLeft > 4` and `scrollLeft + clientWidth < scrollWidth - 4`).
5. **Responsive Wrapping Fallback**: Add `sm:flex-wrap sm:overflow-visible` so arrows and gradient fades automatically disappear on desktop screens where wrapping is enabled.

### 12. Mobile Modal Navigation & Back-Trap Elimination
**Trap:**
On mobile viewports (< 640px), centered dialogs relying solely on a small top-right `X` icon trap users who naturally expect mobile-native back navigation (top-left arrow or bottom close action).
**Standard:**
For all full-screen or large operational modals (e.g. `PaymentReceiptModal.jsx`, `DailyCloseoutPrintModal.jsx`, `RecordPaymentModal.jsx`):
1. **Sticky Header Back Button**: Include a top-left `<ArrowLeft>` button on mobile (`block sm:hidden text-slate-300 hover:text-white p-1`) to serve as a back action.
2. **Sticky Bottom Close Action**: On mobile/tablet, provide a full-width bottom "Close" button in the sticky footer.
3. **Backdrop Tap Dismissal**: Tapping the dimmed backdrop (`onClick={onClose}`) dismisses the modal, guarded with `!isSubmitting` and `e.stopPropagation()` on the inner container.
4. **Hardware/Keyboard Escape Support**: Listen for `Escape` keydown events on the `window` while the modal is open.

### 13. Export Period Selector Design & Timezone-Immune Presets
**Trap:**
Export period dialogs defaulting to blank date ranges or `"all"` override the user's active page filters, causing unintentional data exports. Selecting presets with browser-local `new Date()` causes timezone rollback artifacts across boundaries (e.g. UTC vs IST).
**Standard:**
1. **Inherit Active Scope**: Pass `defaultPreset` and `initialDateRange` matching the active page filters (`datePreset`, `selectedDate`, `startDate`, `endDate`) rather than resetting to blank.
2. **Timezone-Immune Arithmetic**: Calculate day offsets using pure UTC arithmetic anchored to Indian Standard Time (`Asia/Kolkata`):
   ```javascript
   const d = new Date(Date.UTC(currY, currM - 1, currD - daysBack));
   const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
   ```
3. **Interactive Scope Feedback**: Always render an active "Selected Export Scope" banner dynamically describing single-day dates (`Single Day · 05 Sep 2026`), multi-day ranges (`01 Sep 2026 — 05 Sep 2026`), or explicit All-Time windows (`Complete History (All Time · Up to 365 Days)`).
4. **Explicit All-Time Contract**: Pass `isAllTime=true` rather than empty strings when exporting all-time data, preventing parent page handlers and backend controllers from falling back to today's date.




