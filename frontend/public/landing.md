# Bharat Enterprise Billing System

> The Operating System for Modern Indian Distribution: Itemized GST Billing, Real-Time Inventory Ledger, Customer Khata, and Operational Intelligence.

Bharat Enterprise is a high-performance, multi-tenant cloud operations platform built for Indian distributors, wholesale merchants, pharmaceuticals, FMCG traders, and manufacturers. It replaces disconnected offline spreadsheets with a unified, real-time operating system covering billing, stock inventory, customer accounts, and tax reporting.

---

## Key Platform Capabilities

### 1. Statutory GST Billing & Invoicing
* Itemized tax invoices with CGST, SGST, and IGST breakdowns.
* Automatic HSN/SAC classification, scheme discounts, and rate calculations.
* Dual-copy and triplicate prints: Original for Recipient, Duplicate for Transporter, Triplicate for Supplier.
* Client-side idempotency safeguards to prevent accidental double-billing.

### 2. Real-Time Inventory Control & Movement Ledger
* Deterministic stock tracking with `Product.currentStockQty` as the single source of truth.
* Centralized, immutable `StockMovement` audit log recording purchases, sales deductions, customer returns, and physical warehouse adjustments.
* Low-stock buffer alerts and dead-stock identification.

### 3. B2B Customer Khata & Accounts Receivable
* Running balance statements with exact visual parity down to the paisa (`decimals={2}`).
* Customer credit limits, overdue debt aging alerts, and payment collections.
* Multi-mode settlement recording: UPI, Bank Transfer (NEFT/RTGS/IMPS), Cheque, and Cash.

### 4. Procurement & Supplier Management
* Centralized vendor registries with GSTIN, PAN, DL, and state codes.
* Purchase order tracking, inward stock receipts, and supplier balances.

### 5. Operational Business Intelligence & Telemetry
* Live sales velocity, collection efficiency ratios, gross margins, and customer acquisition metrics.
* Instant monthly GST summaries formatted for GSTR-1 and GSTR-3B compliance filings.

---

## SaaS Subscription Plans

* **Starter**: Ideal for small retail & single-trader shops (Up to 300 invoices/month, 500 catalog items, 150 customer accounts).
* **Business**: Tailored for mid-size wholesale distributors (Up to 1,500 invoices/month, 3,000 catalog items, 1,000 customer accounts, 1 Admin + 3 Staff seats).
* **Professional**: Built for large trading houses & multi-warehouse enterprises (Unlimited invoices, unlimited catalog items, unlimited customer accounts, 1 Admin + Unlimited Staff seats).

All plans include a **14-day free trial** with zero credit card required.

---

## Technical Foundation

* **Architecture**: Stateless Node.js/Express API services, MongoDB Enterprise with ACID transactions, React 19 SPA frontend.
* **Security**: Multi-tenant data isolation, JWT authentication, `httpOnly` secure cookies, bcrypt password hashing, and role-based permissions.
* **Compliance**: Designed for Indian Goods and Services Tax (GST) compliance.
