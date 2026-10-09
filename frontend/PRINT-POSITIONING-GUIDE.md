# 📄 Document Print & Positioning Architecture Guide
**Bharat Enterprise Billing System (v2.10.0)**

Comprehensive engineering guide for document layout, print margins, paper format modes, table column grid extension, and hardware printer positioning across A4 sheets, half-sheet cut vouchers, and continuous thermal receipt rolls.

---

## 🎯 Architecture Overview

Document printing is governed by a modular, format-aware subsystem located under **`frontend/src/features/documentPrinting/`**:

```text
frontend/src/features/documentPrinting/
├── formats/
│   └── documentPrintFormats.js      # Canonical format definitions (A4, A5, Thermal 80mm, Thermal 58mm)
├── transport/
│   └── PrintTransport.js            # 8-step lifecycle orchestrator & dynamic @page CSS injector
├── renderers/
│   ├── InvoiceDocument.jsx          # Full-page A4, 2x half-sheet cut, and thermal roll invoices
│   ├── LedgerDocument.jsx           # Customer & Supplier ledger statements (isolated terminal summaries)
│   ├── ReceiptDocument.jsx          # Payment receipt vouchers (A4, A5, Thermal)
│   ├── CreditNoteDocument.jsx       # Sales return credit note documents
│   └── DailyCloseoutDocument.jsx    # Cash drawer / register daily audit closeout sheets
├── primitives/
│   └── PrintPrimitives.jsx          # Reusable firm headers, party cards, notes, and signatory blocks
└── components/
    ├── PrintDialog.jsx              # Unified interactive print modal with real-time scaling
    └── PrintFormatSelector.jsx      # Format switching radio bar
```

---

## 📐 Print Margin Engine & Browser Dialog Settings

Positioning is designed around standard **A4 portrait paper (210mm × 297mm)** with dynamic `@page` injection managed by `PrintTransport.js`.

### 1. The `@page` Rule (`PrintTransport.js`)
```javascript
function getFormatPageCss(format) {
  switch (format) {
    case PRINT_FORMATS.THERMAL_80:
      return `@page { size: 80mm auto; margin: 2mm; }`;
    case PRINT_FORMATS.THERMAL_58:
      return `@page { size: 58mm auto; margin: 2mm; }`;
    case PRINT_FORMATS.A4:
    default:
      return `@page { size: A4 portrait; margin: 6mm; }`;
  }
}
```

### 2. Browser Print Dialog Margin Modes
When `window.print()` opens in Chrome, Edge, or Chromium browsers:

| Margin Option in Print Dialog | Resulting Behavior |
|------------------------------|--------------------|
| **"Default"** *(Standard)* | Browser applies the stylesheet `@page` margin of **6mm** on all 4 sides. The invoice renders centered with balanced 6mm margins, clean top header offset (~61px down), and comfortable breathing room at the bottom. |
| **"None"** *(Edge-to-Edge)* | Browser explicitly overrides `@page` and sets margins to **0mm**. Because `.print-format-a4` has `max-width: 100%` and `.invoice-copy` has `print:p-0`, the invoice expands edge-to-edge across the page width with **zero artificial padding**. |
| **"Minimum"** | Browser applies the hardware printer's mechanical feed limit (~3mm–4mm). |
| **"Custom"** | Allows the user to drag top, bottom, left, and right margins interactively in the browser preview. |

---

## 📏 Continuous Vertical Table Column Grid Lines

In traditional billing software (Tally, Busy, Marg ERP), invoices with few items do not leave an awkward empty void between the item rows and the footer totals. The column grid lines continue down to the totals box.

### Implementation Architecture (`InvoiceDocument.jsx`)
1. **100% Height Flex Container**:
   The table wrapper uses `flex-1 flex flex-col` so it fills all available vertical space between the firm header and bottom totals.
2. **Table Dimensions**:
   The `<table>` uses `className="w-full flex-1 border-collapse"` with `style={{ height: '100%', border: '0.5px solid black' }}`.
3. **Compact Data Rows**:
   Data rows use `style={{ height: '1px' }}` so the browser table layout engine renders each product row at its minimal natural height without stretching item rows vertically.
4. **Auto-Stretching Filler Row**:
   A dedicated filler row is placed at the bottom of `<tbody>`:
   ```jsx
   <tr className="filler-row" style={{ height: 'auto' }}>
     {activeColumns.map((col, i) => (
       <td
         key={`filler-${col.key}`}
         className={`${i < activeColumns.length - 1 ? 'border-r border-black' : ''} p-0`}
         style={{ width: col.width }}
       >
         &nbsp;
       </td>
     ))}
   </tr>
   ```
   The browser table engine automatically allocates 100% of remaining vertical height to this row, seamlessly extending every vertical column separator line down to the bottom border of the table.

---

## 📄 Invoice Layout Modes

Invoices support three sheet workflows plus thermal POS rolls:

### 1. `1x Full Page (A4)` — Single Enterprise Copy
- **Container Height**: `min-h-[265mm]` inside the 285mm printable height.
- **Header**: Dual-column firm identity card and payment details (UPI, A/C, IFSC, DL, GSTIN).
- **Sub-Header**: 3-column party card (Billed To, GSTIN/DL, Invoice Meta).
- **Table**: 12 configurable columns with extended vertical column lines.
- **Footer**: Current Outstanding Dues, Taxable, CGST, SGST, Round Off, Net Payable, Amount in Words, and Authorized Signatory.

### 2. `2x Half Sheet (A5 Cut)` — Double Copy (Customer + Dealer)
- **Container Height**: Two identical compact copies with `min-h-[120mm]`.
- **Divider**: Centered dashed line with `"Cut Here"` indicator.
- Designed for users who print two copies on one physical A4 sheet and cut the paper in half for the customer and office archive.

### 3. `1x Half Sheet` — Single Compact Copy
- **Container Height**: Exactly one compact copy with `min-h-[120mm]`.
- **Divider**: None (no dashed line, no duplicate dealer copy).
- Designed for businesses printing directly on pre-cut A5 paper or businesses wanting a single compact receipt on standard A4 paper without generating an unneeded duplicate copy.

### 4. Thermal POS Rolls (80mm & 58mm)
- **Thermal 80mm**: 3-inch roll format (`@page { size: 80mm auto; margin: 2mm; }`, usable width ~72mm).
- **Thermal 58mm**: 2-inch roll format (`@page { size: 58mm auto; margin: 2mm; }`, usable width ~50mm).
- Independent receipt layouts with compact item descriptions (`HSN`, `Batch`, `(+1 Free)`), dashed totals lines, and solid black `#000000` text contrast.

---

## 📊 Canonical 12-Column Layout & PDFKit Parity

Both the browser print sheet (`InvoiceDocument.jsx`) and the server-side PDFKit export engine (`invoiceExportController.ts`, `publicShareController.ts`) share the exact same 12-column canonical sequence:

```text
1. Qty        — Quantity sold
2. Fr         — Free / scheme bonus quantity
3. Product    — Product Name & pack size
4. HSN        — Harmonized System of Nomenclature code
5. Batch      — Batch lot number (grouped multi-batch allocation)
6. Expiry     — Expiry date (MM/YY)
7. MRP        — Maximum Retail Price
8. Rate       — Billed unit rate (exclusive of GST)
9. Net        — GST-inclusive derived rate (Rate × (1 + GST%))
10. Disc%     — Scheme discount percentage
11. GST%      — Applicable Goods & Services Tax percentage
12. Amount    — Final line item payable amount
```

---

## 📋 Ledger Statement Printing Architecture (`LedgerDocument.jsx`)

Customer and supplier ledgers support dense, multi-page transactional statements:
- **Terminal Summary Block**: Summary totals (`TOTAL TRANSACTIONS` and `CLOSING BALANCE`) and signatory blocks are rendered inside a dedicated `.print-final-summary` container outside the data `<table>`. This eliminates browser `tfoot` bugs that cause summary rows to repeat on every printed page.
- **Format Awareness**: Dynamically evaluates `const isA5 = format === PRINT_FORMATS.A5;` to apply compact `8px` typography for half-sheet statements and `9px` typography for full A4 statements.

---

## 🛡️ Print Isolation & UI Concealment (`.no-print`)

All screen-only UI elements are hidden automatically during print:
```css
@media print {
  .no-print,
  .no-print *,
  .toast-container,
  .subscription-banner,
  [role="alert"],
  [role="dialog"],
  aside, header, nav, button {
    display: none !important;
  }
}
```

### Dark Mode Text Contrast Protection
All printable documents enforce solid `#000000` text on white paper, regardless of whether the user has light mode or dark mode active on their screen:
```css
html.dark .invoice-print,
html.dark .invoice-print *,
html.dark .invoice-copy {
  color: #000000 !important;
  background-color: #ffffff !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

---

## 🔧 Quick Adjustment Reference

| To Change... | Edit File | Property / Setting |
|-------------|-----------|--------------------|
| **Default page margins** | `PrintTransport.js` | `@page { size: A4 portrait; margin: 6mm; }` |
| **Full-page invoice height** | `InvoiceDocument.jsx` | `min-h-[265mm]` on `.invoice-copy` |
| **Half-sheet cut height** | `InvoiceDocument.jsx` | `min-h-[120mm]` on `.invoice-copy` |
| **Thermal 80mm roll width** | `index.css` & `PrintTransport.js` | `74mm` in CSS, `80mm auto; margin: 2mm;` in `@page` |
| **Thermal 58mm roll width** | `index.css` & `PrintTransport.js` | `52mm` in CSS, `58mm auto; margin: 2mm;` in `@page` |
| **Table filler row style** | `InvoiceDocument.jsx` | `<tr className="filler-row" style={{ height: 'auto' }}>` |
| **Ledger font size** | `LedgerDocument.jsx` | `fontSize: isA5 ? '8px' : '9px'` |
