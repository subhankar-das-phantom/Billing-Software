# Bharat Enterprise - Billing & Business Operations Platform

[![GitHub Tag](https://img.shields.io/badge/version-v2.1.0-emerald.svg)](https://github.com/subhankar-das-phantom/Billing-Software/releases)
[![CI](https://github.com/subhankar-das-phantom/Billing-Software/actions/workflows/ci.yml/badge.svg)](https://github.com/subhankar-das-phantom/Billing-Software/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

A comprehensive, multi-tenant cloud business operations platform optimized for both high-speed desktop workflows and mobile accessibility. Evolved from an invoicing utility into an end-to-end enterprise solution featuring **inward purchasing, dual-mode inventory with automated FIFO & manual batch selection, an immutable stock movement ledger, operational intelligence, granular RBAC, and tiered SaaS subscriptions**.

---

## 🚀 Release v2.0.0 — Complete Inventory & Purchasing Evolution

Version 2.0.0 marks a major product milestone. The system transitions into a broader operations platform while preserving its core speed, simplicity, and transactional data integrity.

### 💎 Key Highlights

- **Dual-Mode Inventory Tracking & FIFO**  
  Seamlessly operates in either standard quantity-based inventory or lot-tracked batch inventory. Features automated First-In-First-Out (FIFO) stock allocation, zero-downtime lazy batch migration, and manual lot selection modals with 0ms cached loading. Available on **all** plan tiers.
- **Inward Purchase & Supplier Management**  
  Full vendor master directory coupled with a structured purchase lifecycle (`DRAFT → COMPLETED → CANCELLED`). Receiving a bill atomically increments inventory and assigns batch lots; cancellations create compensating returns with strict negative-stock prevention.
- **Immutable Inventory Ledger (`StockMovement`)**  
  Centralized historical audit trail recording every inventory change (`PURCHASE`, `SALE`, `SALE_RETURN`, `PURCHASE_RETURN`, `MANUAL_ADJUSTMENT`) with pre/post balance snapshots, batch lot numbers, and document references.
- **Operational Reports & Inventory Intelligence**  
  Supplier procurement analysis, product inward volume tracking, batch expiry horizons (30/60/90 days), and stock velocity indicators.
- **Multi-Tenant SaaS Subscription Engine**  
  Tiered feature gating (Starter, Business, Professional), automated 30-day trials, 7-day grace periods, Razorpay subscription checkout, and a built-in referral viral loop.
- **Mobile-First UX & Performance Mode**  
  Edge swipe gestures (swipe-to-open and swipe-to-close drawer), optimistic invoice row insertion, hardware-aware motion scaling, and hardened top-level toast notifications.

---

## 📦 SaaS Subscription Matrix

Access is gated at the API middleware and frontend UI navigation layers:

| Capability | Starter (₹299/mo) | Business (₹499/mo) | Professional (₹699/mo) |
| :--- | :---: | :---: | :---: |
| **Invoice Billing & History** | ✅ | ✅ | ✅ |
| **Thermal & A4 Print / PDF** | ✅ | ✅ | ✅ |
| **Customer & Product Catalog** | ✅ | ✅ | ✅ |
| **Dual Inventory Modes (Batch ON/OFF)** | ✅ | ✅ | ✅ |
| **Automated FIFO & Batch Modals** | ✅ | ✅ | ✅ |
| **Payments & Collections** | ❌ | ✅ | ✅ |
| **Customer Ledger & Credit Notes** | ❌ | ✅ | ✅ |
| **Supplier Master Management** | ❌ | ✅ | ✅ |
| **Inward Purchase Entry & Lifecycle** | ❌ | ✅ | ✅ |
| **Inventory Movement Ledger** | ❌ | ✅ | ✅ |
| **Purchase Operational Reports** | ❌ | ✅ | ✅ |
| **Employee Management & RBAC** | ❌ | ❌ | ✅ |
| **Employee Performance Analytics** | ❌ | ❌ | ✅ |
| **Activity & Audit Logs** | ❌ | ❌ | ✅ |
| **GST Tax Reports** | ❌ | ❌ | ✅ |
| **Inventory Intelligence (Expiry/Risk)** | ❌ | ❌ | ✅ |

> ℹ️ **Operational Disclaimer:** All operational reports, stock movements, and analytics provided by the platform are designed for internal workflow visibility and decision support. They do **not** constitute certified statutory accounting, cost-of-goods-sold (COGS) certification, or tax filing advice.

---

## 🛠️ Architecture & Tech Stack

```
                               ┌────────────────────────────────┐
                               │       React 18 + Vite SPA      │
                               │ (Tailwind, Motion, TanStack)   │
                               └───────────────┬────────────────┘
                                               │ HTTPS / REST / SSE
                               ┌───────────────▼────────────────┐
                               │       Express 5 Middleware     │
                               │  Auth ➔ Tenant ➔ SaaS ➔ RBAC  │
                               └───────────────┬────────────────┘
                                               │
                   ┌───────────────────────────┴───────────────────────────┐
                   ▼                                                       ▼
    ┌──────────────────────────────┐                       ┌──────────────────────────────┐
    │     Billing & Operations     │                       │     Inventory & Purchases    │
    │  Invoices, Payments, Ledger  │                       │  FIFO, Batches, StockLedger  │
    └──────────────┬───────────────┘                       └──────────────┬───────────────┘
                   │                                                       │
                   └───────────────────────────┬───────────────────────────┘
                                               ▼
                               ┌────────────────────────────────┐
                               │   MongoDB Atlas Multi-Tenant   │
                               └────────────────────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, TanStack Query, TanStack Virtual, SWR, Tailwind CSS, Lucide Icons |
| **Animation & Gestures** | Framer Motion with custom `usePerformanceMode` hardware throttle, Touch swipe listeners |
| **Backend API** | Node.js, Express.js (v5), TypeScript (SaaS, Purchases, Inventory, Analytics, Exports) |
| **Database** | MongoDB 6+ with Mongoose schemas, transactions, and Change Streams (`StockChangeStream`) |
| **Authentication** | JWT cookies/headers, Bcrypt password hashing, Tenant isolation resolver |
| **Payments & SaaS** | Razorpay Node.js SDK, Webhook HMAC signature verification |
| **Document Export** | Modular Export Engine (ExcelJS, PDFKit, CSV streaming) with 50,000-row safety limits |

---

## ⚡ Core Workflows

### 1. Inward Purchases (`DRAFT → COMPLETED → CANCELLED`)
1. Create inward bill under **Purchases → New Purchase** with supplier, bill number, items, purchase rate, selling rate, MRP, lot number, and expiry date.
2. Saving as **COMPLETED** atomically updates warehouse stock (incrementing `Product.currentStockQty` or creating/updating `Batch` lots) and records an immutable `PURCHASE` movement.
3. If an error occurred, authorized personnel can **CANCEL** the purchase, creating a compensating `PURCHASE_RETURN` movement and atomically decrementing inventory (guarded against negative inventory).

### 2. Dual-Mode Inventory & FIFO Billing
- **Batch Tracking Disabled (Default)**: Authoritative stock is `Product.currentStockQty`. Invoice deductions and returns operate directly on the product document.
- **Batch Tracking Enabled**: Authoritative stock lives in `Batch` lots. When creating an invoice, the system automatically allocates the oldest unexpired stock via FIFO. Operators can click the batch pill to manually split quantities across lots or select custom batches with zero loading lag.
- **Lazy Migration**: Existing unbatched products automatically transition into batch tracking when batches are added, requiring zero manual database scripts.

### 3. Sales Invoicing & Credit Notes
- Delta-based invoice editing prevents double-deduction race conditions.
- Credit Notes atomically restore stock and adjust customer balances.
- Real-time stock updates broadcast over Server-Sent Events (SSE).

---

## 🌐 API Reference Overview

### SaaS & Subscriptions
- `GET /api/saas/plans` — List public plan tiers and pricing rules
- `GET /api/saas/subscription` — Current tenant subscription status and features
- `POST /api/saas/subscription/checkout` — Create Razorpay subscription order
- `POST /api/saas/subscription/verify` — Verify signature and activate subscription
- `POST /api/saas/subscription/webhook` — Razorpay webhook listener

### Suppliers & Purchases
- `GET /api/suppliers` — List vendors with balance summaries
- `POST /api/suppliers` — Create vendor profile
- `GET /api/purchases` — Filter purchases by date, status, or vendor
- `POST /api/purchases` — Create purchase bill (`DRAFT` or `COMPLETED`)
- `PUT /api/purchases/:id` — Edit purchase (`DRAFT` only)
- `POST /api/purchases/:id/complete` — Transition `DRAFT` to `COMPLETED`
- `POST /api/purchases/:id/cancel` — Cancel completed purchase with stock reversal

### Inventory, Batches & Ledger
- `GET /api/batches/product/:productId` — List available batches for a product
- `GET /api/stock-movements` — Paginated stock audit ledger with document references
- `GET /api/reports/purchases/supplier-summary` — Spend and tax breakdown per supplier
- `GET /api/reports/purchases/product-summary` — Inward product procurement volumes
- `GET /api/analytics/inventory/expiry-risk` — Upcoming batch expiry horizons (30/60/90 days)
- `GET /api/analytics/inventory/velocity` — Fast-moving vs. slow-moving inventory analysis

### Invoices, Customers & Payments
- `GET /api/invoices` — Search invoices with server-side filtering
- `POST /api/invoices` — Create invoice with automated or manual batch allocation
- `POST /api/credit-notes` — Create sales return credit note
- `GET /api/customers/:id/ledger` — Unified running financial ledger
- `GET /api/payments/collections` — Daily collections aggregated by payment mode

---

## 🏁 Quick Start (Local Development)

### Prerequisites
- Node.js v18+
- MongoDB v6+ (running locally or MongoDB Atlas URI)

### 1. Clone & Configure Backend
```bash
cd backend
cp .env.example .env
npm install
npx tsx scripts/seedSaasPlans.ts
npm run dev
```
Backend starts at `http://localhost:5000`.

### 2. Configure Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Frontend runs at `http://localhost:3000` (or `http://localhost:5173`).

---

## 📄 Documentation

- **User Guide**: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **Version History & Notes**: [CHANGELOG.md](CHANGELOG.md)
- **Legal Terms**: Accessible in-app at `/terms` and `/privacy-policy`

---

## 🔒 Security & Data Integrity

- Strict multi-tenant isolation enforced at database query, indexing, and middleware boundaries.
- No sensitive credentials, private keys, or `.env` files are tracked in source control.
- Non-destructive database operations with atomic transactions for all stock-altering workflows.

---

## 📜 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.  
Copyright (c) 2026 Subhankar Das / Bharat Enterprise. All rights reserved.
