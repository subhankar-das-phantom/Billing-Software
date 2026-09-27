# Bharat Enterprise Billing System

> The Operating System for Modern Indian Distribution: GST Tax Invoicing, Multi-Batch Inventory, Customer Khata Ledgers, and Operational Intelligence.

Bharat Enterprise is a cloud SaaS platform built for Indian distributors, wholesale merchants, pharmaceutical traders, and FMCG enterprises. It replaces disconnected offline workflows with a unified, real-time operating system covering billing, stock inventory, customer accounts, and GST tax reporting.

**Live Application:** https://billing-software-dev.vercel.app/landing  
**Sign In:** https://billing-software-dev.vercel.app/login  
**Register:** https://billing-software-dev.vercel.app/register

---

## Core Platform Capabilities

### 1. GST-Ready Invoicing & Billing
Generate clear itemized tax invoices with HSN details, CGST/SGST/IGST tax breakdowns, and dual-copy printing.

- HSN code and GST rate catalog mapping
- Intra-state CGST+SGST and inter-state IGST automatic tax split computation
- Dual-copy printing: Customer copy and Business/Transporter copy in one print session
- Direct credit note generation and itemized return processing
- Drug License (DL) and GSTIN registers for buyer and seller (Forms 20B/21B)

### 2. Multi-Batch Stock Management
Track stock at the individual batch level with expiry horizons, MRP, purchase cost, and selling rates.

- Batch-level stock tracking with manufacturing and expiry dates
- Proactive low-stock and near-expiry status indicators per SKU
- Unit of measure customization (bottles, boxes, rolls, strips, cartons)
- Complete inventory movement ledger: purchases, sales, returns, adjustments
- CSV/Excel export for warehouse stock audits

### 3. B2B Customer Khata & Accounts Receivable
Maintain running customer balances across invoices, payments, manual journal entries, and credit notes.

- Running outstanding balance tracking per customer account
- Record full or partial payments with mode (Cash, UPI, Cheque, NEFT/RTGS) and reference numbers
- Manual debit/credit entries for adjustments and discounts
- Exportable account statements and complete ledger statement history
- Stores customer GSTIN, Drug License (DL), phone, and address profile

### 4. Supplier & Purchase Tracking
Record purchase orders from registered suppliers and monitor cumulative procurement expenditures.

- Supplier directory with GSTIN, contact details, and payment terms
- Purchase entry with batch creation and automatic stock incrementation
- Procurement spend telemetry and monthly purchase analysis
- Status tracking across draft, ordered, and completed purchases

### 5. Executive Intelligence & Analytics
Monitor business velocity with daily sales curves, cash collection ratios, and receivables aging.

- Daily and monthly sales vs collection comparative trends
- Cash flow breakdown: collected cash vs active outstanding dues
- Average invoice value and volume metrics with Today / 7D / 30D / Month / Year filters
- Exportable GST sales registers and purchase reports (CSV & PDF)

### 6. Role-Based Access & Audit Logs
Delegate day-to-day operations to staff with granular permission controls.

- Admin and Employee role segregation
- SaaS plan entitlement gating on sensitive features
- Detailed immutable activity logs with user, timestamp, and action context
- Secure session management and authentication guards

---

## How Data Flows Through the Enterprise

1. **Stock Inward & Batches** — Procure goods from suppliers, record purchase invoices, assign batch numbers with expiry dates.
2. **Tax Invoice Generation** — Select customer, pick items from available batches, apply automatic GST calculations.
3. **Stock Deduction** — Inventory levels and batch allocations are decremented atomically with stock movement logs.
4. **Ledger Posting** — Invoice amount is posted to the customer account ledger, updating running receivables.
5. **Payment Reconciliation** — Record Cash, UPI, or bank transfer payments and issue printable receipts to settle outstanding balances.
6. **Reports & GST Registers** — Review monthly sales registers, tax breakdowns, and cash flow telemetry for accounting.

---

## Subscription Plans & Pricing

All plans include a **14-day free trial** with full access and no credit card required.

---

### Starter — ₹299/month
*Essential billing and customer management for single-location operations.*

**Included:**
- Dashboard & Overview
- Customer Directory
- Product Catalog
- Create & Print Invoices
- Invoice History & Downloads
- Basic Business Reports

---

### Business — ₹499/month *(Most Popular for Wholesalers)*
*Comprehensive workflow suite including ledger khata, collections, and purchasing.*

**Included (everything in Starter, plus):**
- Supplier Management
- Purchase Entries & Tracking
- Inventory Movement Ledger
- Collections & Payment Receipts
- Credit Notes & Returns
- Customer Khata & Ledgers
- Manual Journal Entries
- Outstanding Balance Tracking

---

### Professional — ₹699/month
*Full enterprise suite with team access, GST-ready invoicing, and business intelligence.*

**Included (everything in Business, plus):**
- Employee Management & Role-Based Access Control (RBAC)
- Employee Activity Analytics
- Administrative Activity Logs
- GST Reports & Tax Ledger Data
- Advanced Business Reporting
- Inventory Intelligence Engine

---

## Tenure-Based Subscription Discounts

Longer subscription commitments unlock significant savings. Discounts are applied to the total subscription amount at checkout:

| Billing Cycle | Duration | Discount | Effective Saving |
|---|---|---|---|
| Monthly | 1 month | 0% | — |
| Quarterly | 3 months | 5% off | Save ~1.5 months over 3 |
| Half-Yearly | 6 months | 10% off | Save ~3.6 weeks over 6 months |
| Annual | 12 months | 20% off | Save ~2.4 months over the year |

**Example — Business plan at ₹499/month:**
- Monthly: ₹499/month
- Quarterly: ₹499 × 3 = ₹1,497 → **₹1,422** (save ₹75)
- Half-Yearly: ₹499 × 6 = ₹2,994 → **₹2,694** (save ₹300)
- Annual: ₹499 × 12 = ₹5,988 → **₹4,790** (save ₹1,198)

---

## Frequently Asked Questions

**How does Bharat Enterprise calculate GST on invoices?**  
The system automatically applies CGST+SGST for intra-state transactions or IGST for inter-state, based on the customer's registered state. HSN code and applicable tax slab are stored with each product in the catalog.

**Can I track batch numbers, expiry dates, and MRP?**  
Yes. Every batch carries its own manufacturing date, expiry date, MRP, purchase cost, and selling rate. The system flags near-expiry batches proactively before dispatch.

**How does the customer ledger and khata work?**  
Every invoice, payment, credit note, or manual journal entry automatically updates the customer's running cumulative balance. Full statement history is viewable and exportable at any time.

**Can I print both customer and transporter copies?**  
Yes. The dual-copy print mode generates both the Original Recipient copy and the Transporter/Duplicate copy in a single unified print session.

**What access permissions do employees have vs administrators?**  
Administrators have full access to all features, settings, and financial data. Employee roles are restricted to day-to-day billing and inventory operations. Sensitive features (financials, settings, logs) are gated by RBAC.

**Is there a free trial?**  
Yes. All plans include a 14-day free trial with full feature access. No credit card is required to start.

**Can I export data for GST filing or accounting?**  
Yes. The platform supports CSV and PDF exports for customer statements, stock summaries, GST sales registers, and purchase ledgers.

---

## Technical Foundation

- **Architecture**: Stateless Node.js/Express API, MongoDB with ACID transactions, React 19 SPA frontend
- **Security**: Multi-tenant data isolation, JWT with `httpOnly` secure cookies, bcrypt password hashing, role-based permissions
- **Compliance**: Designed for Indian GST compliance (CGST/SGST/IGST), HSN code mapping, Drug License tracking
- **Integrations**: Razorpay payment gateway for subscription billing

---

*© 2026 Bharat Enterprise Billing System. All rights reserved.*  
[Terms of Service](https://billing-software-dev.vercel.app/terms) | [Privacy Policy](https://billing-software-dev.vercel.app/privacy-policy)
