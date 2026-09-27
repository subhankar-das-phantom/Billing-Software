# Bharat Enterprise — Product Overview

> The Cloud Operating System for Modern Indian Distribution, Wholesale Commerce, and Retail Enterprises.

Bharat Enterprise is a high-performance, multi-tenant cloud operations platform built specifically for Indian businesses—including wholesale distributors, pharmaceutical stockists, FMCG traders, hardware dealers, and manufacturers. It replaces disconnected offline spreadsheets and legacy desktop accounting tools with a unified, real-time operating system covering GST-compliant invoicing, live stock management, B2B customer khata ledgers, purchase workflows, and financial business intelligence.

---

## Target Audience & Industry Verticals

* **FMCG & Consumer Goods Distributors**: High-volume, rapid-turnover trading businesses requiring sub-second invoice generation, scheme discount calculations, and immediate stock synchronization.
* **Pharmaceutical & Medical Stockists**: Regulated distributors managing HSN/SAC codes, drug license numbers (DL), and statutory GST compliance.
* **Wholesale & Building Material Traders**: Enterprises managing multi-tier customer credit, running khata ledgers, outstanding debt tracking, and partial settlement workflows.
* **Manufacturers & Assemblers**: Operations tracking raw procurement, supplier invoices, sales returns, and central inventory audit logs.

---

## Core Operational Modules

1. **Statutory GST Billing & Invoicing**:
   * Fully compliant tax invoices with automatic CGST, SGST, and IGST breakdowns.
   * Standard HSN/SAC code classification, reverse charge flags, and rate-per-unit calculations.
   * Dual-copy and triplicate print layouts (Original for Recipient, Duplicate for Transporter, Triplicate for Supplier).
   * Idempotent invoice creation with client-side deduplication keys.

2. **Real-Time Inventory Control**:
   * Single source of truth for stock quantities via `Product.currentStockQty`.
   * Complete, immutable audit log of all stock movements (`StockMovement`) tracking sales deductions, purchase additions, and physical reconciliations.
   * Real-time low-stock alerts and inventory intelligence metrics.

3. **B2B Customer Khata & Accounts Receivable**:
   * Digital running ledger for every customer with exact visual parity down to the paisa (`decimals={2}`).
   * Real-time outstanding debt tracking, credit limits, and aging receivables audits.
   * Linked invoice settlements, credit notes, and manual balance adjustments.

4. **Procurement & Supplier Management**:
   * Comprehensive vendor registries with GSTIN, PAN, DL, and state codes.
   * Purchase order tracking, stock intake receipts, and supplier payment balances.

5. **Operational Telemetry & Business Intelligence**:
   * Real-time sales velocity, collection efficiency ratios, gross margins, and customer acquisition indicators.
   * Daily and monthly GST summary reports ready for GSTR-1 and GSTR-3B filings.

---

## Key Technical Characteristics

* **Multi-Tenant SaaS Architecture**: Strict data isolation enforced at the database query level via `tenantId` indexed fields.
* **Stateless API Backend**: Node.js and Express REST services designed for horizontal scalability.
* **Fast Single-Page Application (SPA)**: Built with React 19, Vite, Tailwind CSS, and TanStack React Query for instantaneous local navigation.
* **Zero Financial Truncation**: All monetary values are processed and displayed with 2 decimal places using Indian numbering formatting (`en-IN`).
