# Bharat Enterprise — B2B Customer Khata & Accounts Receivable

> Customer credit management, ledger accounting, running balance tracking, and debt aging audits.

In Indian B2B distribution and wholesale trade, credit sales ("Khata") are central to business relationships. Bharat Enterprise maintains an automated, double-entry-style customer ledger with visual parity down to the exact paisa.

---

## 1. Customer Account Profile

Each customer record maintains:
* **Contact & Identity**: Customer Name, Trade Name, Phone, Email, Delivery/Billing Address, State Code.
* **Tax Identifiers**: GSTIN (15-character GST identification number) and Drug License (DL) number.
* **Credit Parameters**: Credit Limit (₹), Credit Period (Days), and Account Status (Active/Inactive).
* **Summary Totals**:
  * `totalPurchases`: Lifetime invoice purchase volume.
  * `outstandingBalance`: Current net unpaid debt.
  * `invoiceCount`: Cumulative number of invoices.
  * `lastInvoiceDate` & `lastPaymentDate`: Recent activity timestamps.

---

## 2. Dynamic Ledger & Query Parity

To eliminate data discrepancies between customer list views and individual customer profile statements:
* **Live Dynamic Computation**: Outstanding balance is calculated dynamically from unpaid or partially paid invoices, manual credit/debit entries, and credit notes.
* **Asynchronous Self-Healing**: If a background drift occurs between stored summary counters and live ledger sums, the backend self-heals the customer document asynchronously without blocking HTTP response latency.
* **Indian Currency Standard**: Monetary figures are formatted with `decimals={2}` in the `'en-IN'` locale (e.g., `₹1,23,456.78`).

---

## 3. Khata Ledger Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Customer Khata                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     DEBIT (+)                             CREDIT (-)
┌─────────────────────────┐           ┌─────────────────────────┐
│ • Credit Invoice Issued │           │ • Payment Received      │
│ • Manual Debit Note     │           │ • Sales Return/Credit   │
│ • Cheque Bounce Penalty │           │ • Cash / UPI Discount   │
└─────────────────────────┘           └─────────────────────────┘
```

* **Debit Transaction**: Increases the customer's debt (`outstandingBalance += amount`).
* **Credit Transaction**: Reduces the customer's debt (`outstandingBalance -= amount`).

---

## 4. Accounts Receivable Aging & Risk Management

* **Current (0–30 Days)**: Normal trading window within standard payment terms.
* **Overdue (31–60 Days)**: Flagged for collection reminders; alert banners in the dashboard.
* **Critical (60+ Days)**: High-risk accounts; billing can be paused or restricted based on credit limit policies.
