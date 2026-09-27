# Bharat Enterprise — Statutory GST Billing & Invoicing

> GST-compliant invoicing specifications, tax calculation logic, dual-copy printing, and invoice lifecycle management.

Bharat Enterprise provides an itemized, legally compliant invoicing engine designed in accordance with the Goods and Services Tax (GST) laws of India.

---

## 1. Invoice Numbering & Data Model

* **Standard Format**: `INV-YYYY-XXXX` (e.g., `INV-2026-0042`), maintaining continuous, unbroken numeric sequences per tenant per fiscal year.
* **Header Information**:
  * **Distributor (Supplier)**: Firm Name, Address, Phone, GSTIN, Drug License (DL), State Code, and Banking/UPI details.
  * **Customer (Recipient)**: Customer Name, Address, Phone, GSTIN, DL number, and State Code.
* **Line Item Metadata**:
  * Product Name, HSN/SAC Code, Pack format.
  * Quantity Sold, Free Quantity (Scheme bonus).
  * Rate per Unit, Maximum Retail Price (MRP).
  * Scheme Discount (%) and Discount Amount.
  * GST Rate (0%, 5%, 12%, 18%, 28%).
  * Taxable Amount, CGST, SGST, IGST, and Total Line Amount.

---

## 2. Tax Calculation & Paise Integrity

Taxes are computed strictly line-by-line without truncating paise:

$$\text{Base Amount} = \text{Quantity Sold} \times \text{Rate Per Unit}$$

$$\text{Discount Amount} = \text{Base Amount} \times \left(\frac{\text{Scheme Discount \%}}{100}\right)$$

$$\text{Taxable Amount} = \text{Base Amount} - \text{Discount Amount}$$

$$\text{Total GST} = \text{Taxable Amount} \times \left(\frac{\text{GST \%}}{100}\right)$$

* **Intra-State Transactions** (Supplier State == Customer State):
  $$\text{CGST} = \frac{\text{Total GST}}{2}, \quad \text{SGST} = \frac{\text{Total GST}}{2}, \quad \text{IGST} = 0$$
* **Inter-State Transactions** (Supplier State != Customer State):
  $$\text{IGST} = \text{Total GST}, \quad \text{CGST} = 0, \quad \text{SGST} = 0$$

All monetary totals are rounded to exactly two decimal places and converted to words (e.g. *"Rupees Twelve Thousand Three Hundred Forty-Five and Sixty Paise Only"*).

---

## 3. Invoice Lifecycle & States

1. **Created**: Invoice generated, stock atomically deducted from inventory, and customer outstanding balance debited (for Credit invoices).
2. **Printed**: Official dual-copy (Original for Recipient / Duplicate for Transporter) generated and logged.
3. **Cancelled**: Transaction reversed. Stock is atomically restored to inventory, customer balance is credited, and audit log records the cancellation. Cancelled invoices are immutably preserved for audit compliance.

---

## 4. Payment Types & Khata Integration

* **Cash**: Immediate settlement. Recorded in daybook and cash telemetry; customer debt is unaffected.
* **Credit**: Full net amount debited to the customer's khata account balance. Tracked until settled via payments or credit notes.
