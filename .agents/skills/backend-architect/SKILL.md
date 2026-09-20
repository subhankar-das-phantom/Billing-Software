---
name: backend-architect
description: >-
  Use this skill when designing, reviewing, or implementing backend services, MongoDB models,
  controllers, or aggregation pipelines. Enforces strict elimination of N+1 queries, compound
  B-Tree indexing (ESR rule), atomic concurrency guards, and high-performance multi-tenant architecture.
---

# Backend Architect Skill

This skill enforces senior backend engineering practices, database scalability, and concurrency safety across all server services in the Bharat Enterprise platform.

---

## ⚡ Core Engineering Mandates

### 1. Zero N+1 Queries & Batch Resolution
- **Strictly Prohibited**: Never execute database queries inside a loop, `Array.map`, or `Promise.all(items.map(async item => Model.findOne(...)))`.
- **Batch Resolution Pattern**:
  ```javascript
  // ❌ ANTI-PATTERN: N+1 queries (e.g. 50 employees = 52 database queries)
  const results = await Promise.all(employees.map(async emp => {
    const session = await Session.findOne({ user: emp._id, isActive: true });
    return { ...emp, isOnline: !!session };
  }));

  // ✅ SENIOR PATTERN: Single batch query + O(1) in-memory lookup (3 queries total)
  const employeeIds = employees.map(e => e._id);
  const activeSessions = await Session.find({
    user: { $in: employeeIds },
    userModel: 'Employee',
    isActive: true,
    lastActivityAt: { $gte: fiveMinutesAgo }
  }).select('user').lean();

  const activeUserSet = new Set(activeSessions.map(s => String(s.user)));
  const enrichedEmployees = employees.map(emp => ({
    ...emp,
    isOnline: activeUserSet.has(String(emp._id))
  }));
  ```
- **In-Memory Maps & Sets**: Always aggregate batch lookups into an in-memory `Map(id => object)` or `Set(id)` for $O(1)$ constant-time resolution.
- **Aggregated `$lookup`**: Use `$lookup` with nested sub-pipelines for joining relational entities in aggregation pipelines.

---

### 2. Operational Search Architecture & UI-to-Export Parity
- **Substring vs. Prefix Matching**:
  - While prefix matching (`^query`) leverages B-Tree indexes for catalog SKUs, human entity searches (customers, phone numbers, notes, UTRs) require substring contains matching (`containsPattern`).
  - Always sanitize regex: `const escaped = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');`
  - Bounded Execution: When using substring regex, always guard with `tenantId` and enforce strict limits (`.limit(100)`).
- **Numeric Field Search Detection**:
  - In financial tables (Payments, Collections, Invoices), when a user types digits (e.g., `"1500"`), automatically parse numeric values and add exact number matching:
    ```javascript
    if (!isNaN(Number(query))) {
      orConditions.push({ amount: Number(query) });
    }
    ```
- **Date Boundary Overrides (`isAllTime` / "All Dates")**:
  - Operational transaction pages often anchor queries to "Today" (IST). Always support an `isAllTime=true` query parameter so live search can transcend the single-day ceiling and locate historical transactions instantly.
- **100% Parity Between UI Query & Export Engine**:
  - Any search logic, date boundary override, or filter condition added to a controller (`*Controller.js`) MUST be replicated identically in the corresponding export service (`*ExportController.ts`). An exported spreadsheet or PDF report must match the exact data displayed on screen.

---

### 3. Compound B-Tree Index Optimization (ESR Rule)
Design compound indexes strictly following the **Equality → Sort → Range** pattern:
```typescript
// 1. Equality: tenantId, isActive
// 2. Sort: createdAt (-1)
// 3. Range: currentStockQty ($gt: 0)
schema.index({ tenantId: 1, isActive: 1, createdAt: -1, currentStockQty: 1 });

// Activity & Audit Lookups
sessionSchema.index({ user: 1, userModel: 1, isActive: 1, lastActivityAt: -1 });

// Transaction Search Lookups
paymentSchema.index({ tenantId: 1, referenceNumber: 1 });
paymentSchema.index({ tenantId: 1, 'invoiceSnapshot.invoiceNumber': 1 });
```

---

### 4. High-Performance MongoDB Aggregations
- **Stage 1 must always be `$match` with `{ tenantId }`** to utilize compound indexes.
- Strip unnecessary fields early using `$project` to conserve database working RAM.
- Never assume results from `find().lean()` or aggregate groups are in order. Explicitly sort in pipeline (`$sort`) or in JavaScript (`.sort(...)`) before slicing top-N segments.

---

### 5. Multi-Tenant Boundary & Concurrency Safety
- **Mandatory Tenant Check**: Every query and aggregate must include `tenantId`.
- **Atomic Concurrency & Zero Read-Modify-Write**:
  - **Strictly Forbid In-Memory Balance Overwrite**: Never fetch an entity balance into memory, subtract in JavaScript, and overwrite via `Customer.findOneAndUpdate({ outstandingBalance: newBalance })`. Concurrent payments or edits will cause lost updates.
  - **Always Use Atomic Operators**: Use `$inc: { outstandingBalance: -normalizedAmount }` (or delta adjustments) directly on the database engine.
- **Negative Stock Prevention**: Constrain updates with `{ currentStockQty: { $gte: requiredQty } }`.
- **Immutable Ledger**: Atomically record all inventory mutations in `StockMovement` and all customer credits/debits in transactional collections.

---

### 6. Thin Controllers & Rich Service Layer (Anti-"Fat Controller")
- **Controllers Must Be Thin Orchestrators**:
  - Responsibilities limited to: HTTP input parsing/sanitization, auth/tenant extraction, calling service methods, and mapping domain outcomes to HTTP status codes (`200`, `201`, `400`, `404`).
  - **Zero Business Logic in Controllers**: Tax calculations, FIFO batch allocations, ledger entries, and status transitions must reside strictly in dedicated domain services (`*Service.ts`).
- **High Scalability & Stateless Architecture**:
  - Keep request lifecycles 100% stateless to support horizontal clustering.
  - Protect NodeJS event loop: offload heavy reports, use `.lean()` queries, stream massive exports, and avoid in-memory loops over thousands of unbounded records.

---

### 7. ACID Transactions & Atomic Multi-Document Workflows
- **Mandatory Multi-Document Transactions**:
  - When a mutation spans multiple collections or documents (e.g. Payment creation + Invoice paidAmount increment + Customer balance decrement; or Invoice creation + Inventory deduction + Batch allocation + Customer ledger), wrap the operation in a MongoDB ACID transaction (`mongoose.startSession()`).
- **Auto-Retrying Write Conflicts via `session.withTransaction`**:
  - Prefer `session.withTransaction(async () => { ... })` over manual `startTransaction()` / `commitTransaction()`. MongoDB's driver natively intercepts `TransientTransactionError` and `WriteConflict` under concurrent access and automatically retries the transaction until commitment succeeds.
- **Failure Atomicity**:
  - Never allow partial database writes. If any step fails (insufficient stock, invalid invoice, customer inactive), abort or throw immediately so the entire operation rolls back clean. Provide a defensive fallback for standalone development MongoDB instances lacking replica sets.

---

### 8. Dynamic Query Parity & Asynchronous Self-Healing Loop
- **Immutable Ledger as Single Source of Truth**:
  - Cached summary fields (e.g., `customer.outstandingBalance`) are merely read-through performance optimizations. The immutable transactional documents (Invoices, Credit Notes, Manual Entries) are the ground truth.
- **100% Query Parity**:
  - Single-entity lookups (`getCustomer`) MUST calculate live balances dynamically from active unpaid invoices, manual entries, and credit notes to guarantee 100% mathematical parity with List cards (`getCustomers`) and the Ledger (`getCustomerLedger`).
- **Zero-Latency Self-Healing**:
  - If a single-entity lookup detects that stored summary fields have drifted from the real-time calculated total (`|stored - liveDue| > 0.01`), trigger an asynchronous background update (`Customer.updateOne(...).exec().catch(...)`) to heal the document in MongoDB on access without delaying the HTTP response.

### 9. User Preferences & Theme Mode Persistence
- Store user preferences directly on user models (`Admin` and `Employee`):
  ```javascript
  preferences: {
    themeMode: {
      type: String,
      enum: ['dark', 'light', 'system'],
      default: 'dark'
    }
  }
  ```
- Expose an authenticated endpoint (`PUT /api/auth/preferences`) that allows both Admins and non-admin Employees to persist personal UI preferences (theme mode) across devices without granting employees permissions to alter tenant-wide billing/invoice configuration.
