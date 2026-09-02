# 📘 Bharat Enterprise - User Guide (Version 2.0.0)

> 💡 **Tip:** The system is fully optimized for mobile devices with edge swipe gestures. Swipe right from the left screen edge to open the navigation drawer, and swipe left anywhere to close it.

---

## 1. Introduction

Bharat Enterprise Billing System is an all-in-one cloud business operations platform. It combines high-speed sales invoicing with **inward purchase recording, dual-mode inventory with automated FIFO & manual batch tracking, customer/supplier ledgers, operational reports, and granular employee permissions**.

Designed to eliminate stock mismatches, manual calculation errors, and lost bills, it operates smoothly across phones, tablets, and desktop workstations.

---

## 2. Core Navigation & Layout

- **Header Bar**: Displays current tenant firm details, quick action shortcuts, global search, and profile settings.
- **Sidebar Drawer**:
  - **Billing & Invoices**: Create sales bills, view invoice history, issue credit notes.
  - **Purchases & Suppliers**: Record vendor bills, manage supplier profiles, track vendor payables.
  - **Inventory & Batches**: Inspect products, view batch lots, track stock movements.
  - **Ledger & Collections**: Unified customer ledgers, daily collections by payment mode (Cash, UPI, Bank).
  - **Reports & Intelligence**: Procurement summaries, inward flow, expiry risk horizons, and GST reports.
  - **Team Management**: Staff provisioning and role-based permissions (Admin only).
  - **Subscription & Billing**: Plan overview, upgrade options, and referral dashboard.
- **Mobile Gestures**:
  - **Swipe Right** from the left edge of the screen to open the sidebar.
  - **Swipe Left** or tap outside to close it.

---

## 3. Inventory Tracking Modes (Batch ON vs. Batch OFF)

The system supports two flexible inventory models configurable per business preference under **Settings → Preferences**:

### Mode A: Standard Stock Tracking (Batch OFF)
- Inventory is tracked as a single pooled quantity (`currentStockQty`).
- Adding stock increases product quantity directly; selling decreases it.
- Best for businesses that do not require tracking distinct manufacturing dates or lot numbers.

### Mode B: Batch & FIFO Tracking (Batch ON)
- Inventory is tracked across distinct batch lot numbers with individual expiry dates and purchase rates.
- **Automated FIFO Allocation**: During invoice creation, the system automatically allocates the oldest received/unexpired batch lots first to minimize product expiration waste.
- **Manual Batch Allocation**: In the invoice creation screen, tap any item's batch badge to open the Batch Selection Modal. You can pick specific lot numbers or split a single item's quantity across multiple distinct batches.
- **Lazy Migration**: If you transition a product from Batch OFF to Batch ON, existing quantities transition seamlessly without requiring database migrations.

---

## 4. Inward Purchases (`DRAFT → COMPLETED → CANCELLED`)

To record new incoming stock from distributors or manufacturers:

1. Navigate to **Purchases → New Purchase**.
2. Select or create a **Supplier**. Enter their invoice reference number and billing date.
3. Add products:
   - Enter **Quantity** and **Free Quantity** (if applicable).
   - Enter **Purchase Rate**, **Selling Rate**, and **MRP**.
   - Enter **Batch Lot Number** and **Expiry Date** (for batch-tracked products).
4. Save the Purchase:
   - **Save as Draft**: Allows editing or reviewing later without changing warehouse inventory.
   - **Complete Purchase**: Immediately marks the bill as **COMPLETED**, atomically increases product stock, generates batch records, and creates an immutable `PURCHASE` movement entry in the inventory ledger.
5. **Cancelling a Purchase**:
   - If a completed purchase had an error, authorized personnel can cancel it.
   - The system creates a compensating `PURCHASE_RETURN` movement and atomically decrements inventory.
   - *Safety Guard:* If warehouse stock has already been sold and insufficient stock remains to reverse the purchase, cancellation is rejected to prevent negative inventory corruption.

---

## 5. Sales Invoicing & Billing

Creating an invoice is instantaneous:

1. Click **New Invoice** (or press keyboard shortcut `Alt + N` on desktop).
2. Select your **Customer** (auto-populates address, phone, GSTIN, and current balance).
3. Search and select **Products** (with optimistic instant insertion).
4. Review batch allocation:
   - The system automatically assigns lots using FIFO.
   - Tap the batch pill to manually select lots or adjust batch splits if needed.
5. Enter payment details (Full Payment, Partial Payment, or Credit).
6. Click **Save & Print** (supports standard A4 tax invoice or thermal 80mm POS formats).

### Smart & Safe Invoice Editing
If an invoice needs modification after creation:
- Changing quantities automatically calculates the **delta difference** (`newQty - oldQty`).
- Increasing a quantity deducts only the difference from stock.
- Decreasing a quantity restores only the excess back to stock.
- Eliminates common double-deduction and concurrency bugs.

---

## 6. Returns & Credit Notes

To process returned goods:
1. Open the original invoice from **Invoice History**.
2. Click **Create Return (Credit Note)**.
3. Select the returned items and quantities.
4. Saving generates an official GST credit note:
   - Restores stock back to inventory atomically.
   - Credits the customer's balance for future bill offsets.

---

## 7. Customer & Supplier Ledgers

### Customer Ledger
- View complete transactional history (Invoices, Receipts, Credit Notes, Opening Balances).
- Shows real-time running debit/credit balances.
- Export or print PDF ledger statements for customer account reconciliation.

### Daily Collections
- Real-time dashboard showing all payments collected today.
- Breaks down totals by payment channel: Cash, UPI, and Bank Transfer.

---

## 8. Reports & Inventory Intelligence

- **Supplier Procurement Reports**: Track total procurement spend, volume, and tax paid per supplier over any date range.
- **Product Inward Reports**: Audit incoming product volumes, average purchase rates, and suppliers.
- **Stock Movement Ledger**: Immutable chronological audit trail of all warehouse movements (`PURCHASE`, `SALE`, `SALE_RETURN`, `PURCHASE_RETURN`, `ADJUSTMENT`).
- **Inventory Intelligence (Professional Tier)**:
  - **Expiry Horizon**: Early warnings for batches expiring within 30, 60, or 90 days.
  - **Stock Risk & Velocity**: Identifies fast-moving lines vs. stagnant lines at risk of spoilage.

> ℹ️ *Note: Operational reports provide inventory flow visibility and do not replace statutory chartered accounting, COGS certification, or tax filing advice.*

---

## 9. Team Management & Granular RBAC (Professional Tier)

Admins can create employee logins with granular permission toggles:
- Restrict access to discrete modules (Purchases, Invoices, Customers, Products, Reports).
- Separate read vs. create/edit/delete write access.
- Complete action audit logs attribute every transaction to the logged-in staff member.

---

## 10. Frequently Asked Questions

**Q: Can I use the system without batch numbers or expiry dates?**  
*A:* Yes. Products work seamlessly without batch numbers or expiry dates. The system automatically assigns safe fallbacks ("No Batch") and standard pooled stock logic.

**Q: What happens if our subscription expires?**  
*A:* All business data remains 100% intact. An automatic 7-day grace period is granted. After grace, account capabilities transition to read-only mode until renewed. No records or purchases are ever deleted upon expiration or plan downgrade.

**Q: How do referral bonus days work?**  
*A:* Share your referral code from **Subscription → Referrals**. When a new business registers with your code and activates, bonus subscription days are automatically credited to your account.
