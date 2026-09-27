# Bharat Enterprise — Real-Time Inventory & Movement Ledger

> Product catalog, real-time stock balance source of truth, immutable movement audit trail, and inventory health metrics.

Bharat Enterprise manages inventory using a deterministic, product-level stock architecture designed to eliminate phantom stock, lost updates, and inventory discrepancies.

---

## 1. Authoritative Single Source of Truth

The single source of truth for on-hand physical stock is the `currentStockQty` field on the `Product` document:

* **Product Catalog Attributes**:
  * Product Name, Manufacturer, HSN Code, Packaging Unit (Pieces, Boxes, Strips).
  * Old MRP, New MRP, Selling Rate, GST Tax Tier (0%, 5%, 12%, 18%, 28%).
  * Opening Stock Quantity (`openingStockQty`).
  * Current Real-Time Stock Quantity (`currentStockQty`).
  * Stock Version (`stockVersion`) for optimistic concurrency locking.

* **Atomic Stock Adjustments**: Stock modifications never compute values in memory before saving. Instead, stock is decremented or incremented atomically at the database level:
  ```javascript
  await Product.updateOne(
    { _id: productId, tenantId },
    { $inc: { currentStockQty: -deductedQuantity, stockVersion: 1 } }
  );
  ```

---

## 2. Immutable Inventory Movement Ledger (`StockMovement`)

Every single inventory event produces an immutable audit record in the dedicated `StockMovement` collection. This provides complete forensic traceability for every piece of merchandise.

### Event Types
* **`SALE`**: Stock deducted upon invoice creation. Linked to `Invoice` ID and invoice number.
* **`PURCHASE`**: Stock added upon intake from a registered supplier. Linked to `Purchase` ID.
* **`ADJUSTMENT`**: Stock corrected manually during physical warehouse stock audits (positive or negative adjustment with mandatory attribution notes).
* **`SALES_RETURN` / `INVOICE_CANCELLED`**: Stock restored to the shelf following an invoice cancellation or customer return.
* **`PURCHASE_CANCELLED`**: Stock reversed following a supplier return or purchase cancellation.

### Movement Record Structure
Each movement record logs:
* `tenantId`: Tenant data isolation.
* `productId`: Reference to the product.
* `type`: Movement classification (`SALE`, `PURCHASE`, `ADJUSTMENT`, etc.).
* `quantity`: Volume changed.
* `rate` & `totalValue`: Financial valuation at the time of movement.
* `referenceType` & `referenceId`: Associated invoice or purchase identifier.
* `createdBy`: User attribution (Admin or Employee).
* `createdAt`: Immutable ISO timestamp.

---

## 3. Inventory Health & Intelligence

The platform analyzes stock movements and product turnover velocity to surface operational indicators:
* **Low-Stock Alerts**: Proactive notifications when `currentStockQty` falls below defined buffer thresholds.
* **Out-of-Stock Protection**: Hard validation prevents creating sales invoices for zero or negative stock quantities.
* **Dead Stock / Dormant Inventory Identification**: Identifies products with zero sales velocity over 30, 60, or 90-day horizons to prevent working capital lockup.
