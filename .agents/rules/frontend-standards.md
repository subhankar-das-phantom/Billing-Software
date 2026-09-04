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
