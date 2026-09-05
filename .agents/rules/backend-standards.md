# Backend Engineering Standards & MongoDB Performance Patterns

This rule establishes non-negotiable architectural practices for high-performance, multi-tenant backend services in the Bharat Enterprise platform.

---

## 🚫 1. Strict Elimination of N+1 Queries

### The Trap
Executing database queries inside loops or array mappings (`products.map(async p => await Order.find(...))`). With 50 products, this fires 51 queries, causing severe latency spikes, socket exhaustion, and DB thread blocking.

### The Standard
- **Single Batch Lookups (`$in`)**: Collect IDs in a single `Set`, query once, and map results in memory using a JavaScript `Map`:
  ```typescript
  // ✅ CORRECT: 1 Query instead of N
  const productIds = items.map(i => i.productId);
  const products = await Product.find({ 
    _id: { $in: productIds }, 
    tenantId 
  }).lean();

  const productMap = new Map(products.map(p => [p._id.toString(), p]));
  ```
- **Aggregation `$lookup`**: In aggregate pipelines, join collections using `$lookup` with a sub-pipeline or foreign field match, ensuring the foreign collection is indexed on the joined key.

---

## ⚡ 2. MongoDB Aggregation Optimization

### Pipeline Ordering Matters
1. **Always `$match` First**: The very first stage of an aggregation pipeline must be `$match` with `tenantId` and active status. This allows MongoDB's query optimizer to use compound B-Tree indexes.
2. **Project Early**: Use `$project` before intensive stages (`$unwind`, `$group`) to strip out unneeded nested subdocuments, minimizing RAM usage during aggregation.
3. **Index-Covered Sorting**: When sorting (`$sort`), ensure the sort fields match the compound index suffix or perform sorting after reducing the dataset through grouping/filtering.
4. **Never Rely on Natural Storage Order**:
   - `Product.find().lean()` without `.sort()` returns documents in arbitrary physical insertion order.
   - Any velocity, ranking, or ledger query must be explicitly sorted either in MongoDB (`$sort`) or in JavaScript (`.sort((a, b) => b.unitsSold - a.unitsSold)`) before slicing top-N results.

---

## 🔍 3. Ultra-Fast Search & Compound B-Tree Indexing

### The ESR Rule (Equality, Sort, Range)
When designing compound indexes in Mongoose models, order the index fields strictly by:
1. **Equality fields** (e.g. `tenantId`, `isActive`, `status`)
2. **Sort fields** (e.g. `createdAt: -1`, `unitsSold: -1`)
3. **Range fields** (e.g. `expiryDate: { $lte: horizon }`, `currentStockQty: { $gt: 0 }`)

**Example:**
```typescript
// Compound index adhering to ESR rule:
ProductSchema.index({ tenantId: 1, isActive: 1, productName: 1 });
InvoiceSchema.index({ tenantId: 1, status: 1, invoiceDate: -1 });
```

### Search Performance & Regex Safety
1. **Escape Regex Special Characters**: Never pass raw user search input into a `new RegExp(query)`. Escape special characters (`[-[\]{}()*+?.,\\^$|#\s]`) to eliminate Regular Expression Denial of Service (ReDoS) vulnerabilities.
2. **Prefer Prefix Matches**:
   - `^query` can utilize a B-Tree index on indexed string fields.
   - Unanchored queries (`.*query.*`) force a full collection scan (`COLLSCAN`) unless backed by an Atlas Search text index.
3. **Field Projection**: Always use `.select('_id productName hsnCode rate currentStockQty')` so only required fields travel over the wire.

---

## 🔒 4. Multi-Tenant Security & Concurrency Safety

### Mandatory Tenant Boundary
- **Every single query, aggregate, mutation, and delete must include `{ tenantId }`**.
- Never allow an `_id` lookup without validating `tenantId`:
  ```typescript
  // ❌ VULNERABLE: Cross-tenant data leakage risk
  const invoice = await Invoice.findById(req.params.id);

  // ✅ SECURE: Strict tenant isolation
  const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  ```

### Atomic Stock & Concurrency Controls
- **Never read-modify-write stock quantities in memory**:
  ```typescript
  // ❌ DANGEROUS: Susceptible to race conditions
  product.currentStockQty -= quantity;
  await product.save();
  ```
- **Use Atomic `$inc` with Safety Constraints**:
  ```typescript
  // ✅ ATOMIC & RACE-FREE:
  const updated = await Product.findOneAndUpdate(
    { 
      _id: productId, 
      tenantId, 
      currentStockQty: { $gte: quantity } // Prevents negative inventory
    },
    { 
      $inc: { currentStockQty: -quantity, stockVersion: 1 } 
    },
    { new: true }
  );
  if (!updated) {
    throw new Error('Insufficient stock available or concurrent stock mutation occurred');
  }
  ```
- **Stock Movement Ledger**: Every inventory mutation must atomically record a corresponding `StockMovement` document with the pre-transaction balance, change quantity, post-transaction balance, and document reference.

---

## 🏛️ 5. Thin Controllers & Scalable Domain Services (Anti-"Fat Controller")

### Architectural Separation
Controllers should act strictly as HTTP gatekeepers, not business executors:
- **Controller Responsibilities (Thin)**:
  - Extract and sanitize query parameters, body, and path variables.
  - Verify tenant context (`req.user.tenantId`) and user identity (`req.user.id`).
  - Invoke domain services (`await invoiceService.createInvoice(...)`).
  - Return clean HTTP responses (`res.status(200).json({ success: true, data })`) and delegate errors to the centralized error middleware.
- **Service Layer Responsibilities (Rich)**:
  - Complex tax, discount, and total calculations.
  - FIFO batch allocation algorithms.
  - Inventory balance validations and atomic ledger creation.
  - Third-party API orchestrations (Razorpay, SMS/Email).

```typescript
// ❌ FAT CONTROLLER (Anti-pattern: business logic mixed with HTTP)
export const createInvoice = async (req, res) => {
  // 150 lines of tax math, batch loops, database queries, and manual rollbacks...
};

// ✅ THIN CONTROLLER + SERVICE LAYER (Senior pattern)
export const createInvoice = async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const invoice = await invoiceService.createInvoice({
      tenantId,
      userId,
      invoiceData: req.body
    });
    return res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};
```

### High-Scale Memory & Event Loop Discipline
1. **Never Block the NodeJS Event Loop**:
   - Avoid long synchronous loops over massive datasets.
   - Use MongoDB aggregation pipelines to process sums, averages, and group counts inside the database engine rather than pulling raw documents into NodeJS memory.
2. **Streaming for Massive Datasets**:
   - When generating large CSV/Excel exports or historical audit reports, use cursor streaming (`Model.find().cursor()`) to stream chunks directly to the response instead of buffering 50,000 documents in RAM.
3. **Stateless Clustering**:
   - Never store user session state, pending batch allocations, or counters in in-memory global variables. All shared state must reside in MongoDB or Redis to allow zero-friction horizontal scaling.

---

## 🛡️ 6. Multi-Document ACID Transactions & Atomicity

### When to Use MongoDB Multi-Document Transactions
Whenever a business workflow updates **more than one document or collection** where partial success would cause data corruption:
- Creating an Invoice $\rightarrow$ deducting product stocks $\rightarrow$ updating batch quantities $\rightarrow$ creating stock movements $\rightarrow$ incrementing customer outstanding balance.
- Cancelling a Purchase Bill $\rightarrow$ restoring batch inventory $\rightarrow$ creating compensatory stock returns.
- Processing a Credit Note $\rightarrow$ adjusting invoice balances $\rightarrow$ updating customer ledger.

### Standard Transaction Template
```typescript
import mongoose from 'mongoose';

export async function executeInTransaction<T>(
  work: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### Single-Document vs Multi-Document Atomicity
- **Use Multi-Document Transactions** when consistency across disparate collections (Invoices, Products, Batches, StockMovements, Ledgers) is required.
- **Use Single-Document Atomic Operators** (`$inc`, `$set`, `$push`, `findOneAndUpdate` with conditional query filters) for localized operations (e.g. updating a counter or toggling a status flag), avoiding unnecessary transaction locking overhead.

---

## 📊 7. Export Engine Formatting, Bounds & Zero-Record Safeguards

### Integer vs Decimal Number Formatting
- **The Trap**: Routing all numerical values through a currency formatter (`#,##0.00`). Discrete count metrics (e.g. `Total Receipts Recorded`, `Total Purchases`, `Total Movement Records`, `itemCount`) get rendered as decimals (`3.00`, `42.00`).
- **The Standard**:
  1. Define explicit `'integer'` format in `ExportColumn` and `ExportDefinition.summary`.
  2. In `formatValue` (`backend/utils/export/helpers.ts`), automatically detect integers via `Number.isInteger(num)` and format with zero decimal places (`maximumFractionDigits: 0`).
  3. In Excel exports (`excel.ts`), map `'integer'` to cell format `#,##0` instead of `#,##0.00`.

### Zero-Record Export Guard
- **The Trap**: Allowing an export query with 0 matching records to proceed generates a blank, zero-row spreadsheet file that downloads silently.
- **The Standard**:
  - Always count documents before full retrieval.
  - If `totalMatching === 0`, immediately return HTTP `404` with a descriptive message (`"No payments found for the selected period. Nothing to export."`).
  - Enables frontend to display a clear notification toast instead of creating a confusing zero-byte download.

### Guarded Date Span Bounds (365-Day Ceiling)
- When supporting `isAllTime=true`, bound `startBoundary` from `todayStart.getTime() - 364 * 24 * 60 * 60 * 1000` to `todayEnd` (end of today IST).
- Ensures `Math.ceil((endBoundary - startBoundary) / (1000 * 60 * 60 * 24))` evaluates to exactly 365 days, never exceeding the `MAX_EXPORT_DAYS` safety ceiling.


