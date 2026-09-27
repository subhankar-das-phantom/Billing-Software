# Bharat Enterprise — Payments & Collections

> Payment recording, multi-mode settlements, reference tracking, and reconciliation workflows.

Bharat Enterprise provides comprehensive payment and collection management to record receipts, link settlements to specific invoices or open accounts, and maintain accurate cash flow telemetry.

---

## 1. Supported Payment Modes

1. **UPI (Unified Payments Interface)**:
   * Instant settlements via Google Pay, PhonePe, Paytm, or BHIM.
   * UTR / Transaction Reference tracking with deduplication guards.
2. **Bank Transfer (NEFT / RTGS / IMPS)**:
   * Direct wire transfers with bank reference numbers and branch details.
3. **Cheque / Demand Draft**:
   * Cheque number, issuing bank, clearing date, and clearing status (Pending, Cleared, Bounced).
4. **Cash**:
   * On-the-spot physical cash collections with immediate receipt generation.

---

## 2. Settlement Workflows

* **Invoice-Linked Payment**:
  * A payment can be directly applied to one or more specific invoices.
  * The invoice's `paidAmount` is incremented atomically, and its `paymentStatus` transitions:
    * `paidAmount == 0`: **`Unpaid`**
    * `0 < paidAmount < netTotal`: **`Partial`**
    * `paidAmount >= netTotal`: **`Paid`**
* **Account-Level (On-Account) Payment**:
  * For customers with recurring credit, payments can be credited directly to the customer's khata account without immediate line-item invoice linking, reducing the overall outstanding balance.

---

## 3. Financial Auditability & Attribution

* **Employee Attribution**: Every recorded payment captures `recordedBy` (Admin or Employee user ID), allowing distributors to audit field collection agents.
* **Non-Destructive Adjustments**: Recorded payments cannot be silently edited or deleted. Adjustments require explicit audit reasons to protect financial accounting integrity.
