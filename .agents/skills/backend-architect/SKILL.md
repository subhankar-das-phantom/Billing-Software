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

### 1. Zero N+1 Queries
- **Never** execute database queries inside a loop or `map(...)`.
- Group lookups using `$in` and index them in an in-memory `Map(id => object)`.
- Use `$lookup` with sub-pipelines for complex collection joins.

### 2. High-Performance MongoDB Aggregations
- **Stage 1 must always be `$match` with `{ tenantId }`** to utilize compound indexes.
- Strip unnecessary fields early using `$project` to conserve database working RAM.
- Never assume results from `find().lean()` or aggregate groups are in order. Explicitly sort in pipeline (`$sort`) or in JavaScript (`.sort(...)`) before slicing top-N segments.

### 3. Compound B-Tree Index Optimization (ESR Rule)
Design compound indexes strictly following the **Equality → Sort → Range** pattern:
```typescript
// 1. Equality: tenantId, isActive
// 2. Sort: createdAt (-1)
// 3. Range: currentStockQty ($gt: 0)
schema.index({ tenantId: 1, isActive: 1, createdAt: -1, currentStockQty: 1 });
```

### 4. Search Security & Speed
- Sanitize regex inputs: escape `[-[\]{}()*+?.,\\^$|#\s]` to prevent ReDoS attacks.
- Use prefix-matching (`^query`) to enable B-Tree index scans instead of unindexed full collection scans.
- Use lean field projections: `.select('_id productName hsnCode rate')`.

### 5. Multi-Tenant Boundary & Concurrency Safety
- **Mandatory Tenant Check**: Every query and aggregate must include `tenantId`.
- **Atomic Concurrency**: Use `findOneAndUpdate` with `$inc` and `stockVersion` increments.
- **Negative Stock Prevention**: Constrain updates with `{ currentStockQty: { $gte: requiredQty } }`.
- **Immutable Ledger**: Atomically record all inventory mutations in `StockMovement`.
