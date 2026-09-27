# Bharat Enterprise — System Architecture & Data Flow

> High-level architecture, multi-tenancy model, transaction guarantees, and technology stack.

Bharat Enterprise is architected as a distributed SaaS system comprising a lightweight single-page frontend (SPA), a stateless RESTful backend API service, and a document-oriented database with ACID transaction support.

---

## 1. High-Level Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                       Client Browser (SPA)                      │
│            React 19 • Vite • TanStack Query • Tailwind          │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTPS / REST (JSON)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js / Express Backend                   │
│          Auth (JWT) • SaaS Middleware • Domain Services         │
└────────────────────────────────┬────────────────────────────────┘
                                 │ MongoDB Wire Protocol (TLS)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MongoDB Enterprise Database                  │
│       Multi-Document ACID Transactions • Compound B-Tree Indexes│
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tenancy & Data Isolation

* **Tenant Resolution**: Every tenant represents a distinct business entity (an Admin account). All subsidiary entities—employees, customers, products, invoices, stock movements, and notes—possess a strictly typed and indexed `tenantId` field (`mongoose.Schema.Types.ObjectId`).
* **Query-Level Isolation**: All database lookups, mutations, aggregations, and delete operations strictly prefix queries with `{ tenantId }`. No tenant can query or modify another tenant's documents.
* **Compound B-Tree Indexing**: Indexes adhere to the **Equality → Sort → Range (ESR)** rule:
  * Invoices: `{ tenantId: 1, invoiceDate: -1 }`, `{ tenantId: 1, invoiceNumber: 1 }`
  * Products: `{ tenantId: 1, isActive: 1, createdAt: -1 }`
  * Stock Movements: `{ tenantId: 1, productId: 1, createdAt: -1 }`
  * Customers: `{ tenantId: 1, customerName: 1 }`

---

## 3. Transaction Guarantees & Concurrency

* **Atomic Stock & Balance Mutations**: The system forbids read-modify-write patterns in application memory. Financial balance adjustments and product stock updates execute directly on the database engine using native atomic operators (`$inc: { currentStockQty: -qty }`, `$inc: { outstandingBalance: delta }`).
* **ACID Multi-Document Transactions**: Core workflows involving multiple collections (e.g. creating an invoice, which modifies `Invoice`, `Product`, `StockMovement`, and `Customer`) run within MongoDB ACID sessions (`session.withTransaction`). This ensures write conflicts and transient network glitches are automatically retried and partial writes are physically impossible.
* **Idempotency Safeguards**: Sensitive operations (e.g., invoice creation) accept a unique client-generated `createRequestId`. If a network retry occurs, the unique compound index `{ tenantId: 1, createRequestId: 1 }` intercepts duplicates and returns the existing resource without double-charging or duplicate stock deduction.

---

## 4. Frontend State & Anti-Stale Caching

* **Dual-Tier Cache Strategy**:
  * **Static & Master Data (`useSWR`)**: Entity directories (Employees, Products, Customers) use SWR with 30s TTL, Frame-0 `localStorage` pre-seeding, and background validation (`isValidating`).
  * **Analytics & Intelligence (TanStack Query)**: Multi-tab analytics suites utilize `@tanstack/react-query` with a 60-second stale time to eliminate layout reflow flashes during tab switching.
* **Cross-Tab Synchronization**: Mutations emit events across browser tabs via `BroadcastChannel`, automatically invalidating stale caches when actions are taken in concurrent tabs.
