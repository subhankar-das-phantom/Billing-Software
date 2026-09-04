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
