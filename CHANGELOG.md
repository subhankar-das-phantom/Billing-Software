# Changelog

All notable changes to **Bharat Enterprise Billing System** are documented here.

For full release notes with implementation details, see [GitHub Releases](https://github.com/subhankar-das-phantom/Billing-Software/releases).

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
