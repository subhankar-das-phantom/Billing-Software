---
name: frontend-architect
description: >-
  Use this skill when designing, building, or refactoring frontend interfaces, components,
  and user flows. Enforces high-density enterprise aesthetics (anti-vibecoded), mobile-first
  responsiveness, touch accessibility, and prevents common frontend event/state bugs.
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

## 🛡️ Frontend Bug Prevention Checklist

Before completing any frontend code change, verify that:
- [ ] **No Event Double-Triggers**: Never attach handlers to both `onMouseDown` and `onClick`. Use `onMouseDown` only for `e.preventDefault()` (focus retention) and `onClick` for action execution.
- [ ] **Atomic Deduplication in Updaters**: Multi-click or fast typing cannot insert duplicate rows. Functional `setItems(prev => ...)` must check `prev.some(...)`.
- [ ] **Search Debouncing**: Every live search input is wrapped with a 250–400ms debounce hook before triggering filtering or API requests.
- [ ] **Defensive Memoized Sorting**: Any list displayed to the user is explicitly wrapped in `useMemo` with an explicit sorting comparator (`(b.value - a.value)`).
- [ ] **Contextual Permission Routing**: Buttons triggering protected flows (e.g. Record Payment) verify permission to at least one entry point and dynamically route or hide cleanly.
