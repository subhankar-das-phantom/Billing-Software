/**
 * Format-Aware Enterprise Invoice Document Renderer
 * Supports A4 / A5 Sheet (Single / Double Copy), Thermal 80mm, Thermal 58mm
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS, FORMAT_METADATA, INVOICE_COPY_MODES } from '../formats/documentPrintFormats';
import { PrintNotesBlock, PrintSignatoryBlock } from '../primitives/PrintPrimitives';
import { resolveActiveColumns, getBatchGroups } from './invoiceColumns';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Defensive item extraction helpers for thermal roll layouts */
function getInvoiceItemName(item) {
  return (
    item.product?.productName ||
    item.productName ||
    item.product?.name ||
    item.name ||
    item.product?.title ||
    item.title ||
    'Unknown Product'
  );
}

function getInvoiceItemHsn(item) {
  return item.product?.hsnCode || item.hsnCode || item.hsn || null;
}

function getInvoiceItemBatchInfo(item) {
  if (item.batchAllocations?.length > 0) {
    const valid = item.batchAllocations
      .map(b => (b.batchNo && b.batchNo !== 'UNNAMED' ? b.batchNo : ''))
      .filter(Boolean);
    if (valid.length > 0) return `Batch: ${valid.join(', ')}`;
  }
  const bNo = item.product?.batchNo ?? item.batchNumber ?? item.batchNo;
  if (bNo && bNo !== 'UNNAMED') return `Batch: ${bNo}`;
  return null;
}

function getInvoiceItemQty(item) {
  return Number(item.quantitySold ?? item.quantity ?? 0);
}

function getInvoiceItemRate(item) {
  return Number(item.ratePerUnit ?? item.rate ?? 0);
}

function getInvoiceItemTotal(item) {
  if (item.totalAmount != null) return Number(item.totalAmount);
  if (item.amount != null) return Number(item.amount);
  const qty = getInvoiceItemQty(item);
  const rate = getInvoiceItemRate(item);
  return qty * rate;
}

/**
 * Standard Sheet Invoice (A4 / A5 Sheet)
 * Restores 100% parity with legacy invoice layout and conditional details.
 */
function SheetInvoiceCopy({
  invoice,
  format = PRINT_FORMATS.A4,
  admin = null,
  customerOutstanding = 0,
  isDoubleCopy = false,
  copyTitle = null,
  columns = null,
  enableBatchTracking = false
}) {
  const netTotal = Math.round(invoice.totals?.netTotal || 0);
  const rawNet = invoice.totals?.netTotal || 0;
  const roundDiff = netTotal - rawNet;
  const roundSign = roundDiff >= 0 ? `+₹${roundDiff.toFixed(2)}` : `-₹${Math.abs(roundDiff).toFixed(2)}`;

  // Resolve dynamic active columns (12 configurable columns)
  const activeColumns = resolveActiveColumns(columns, { enableBatchTracking });

  const firmName = admin?.firmName || invoice.distributor?.firmName || 'BHARAT ENTERPRISES';
  const firmAddress = admin?.firmAddress || invoice.distributor?.firmAddress || 'Address Line 1, City, State - PIN';
  const firmPhone = admin?.firmPhone || invoice.distributor?.firmPhone || '';
  const firmDL = admin?.firmDL || invoice.distributor?.firmDL || '';
  const firmGSTIN = admin?.firmGSTIN || invoice.distributor?.firmGSTIN || '';
  const paymentInfo = invoice.distributor?.paymentInformation;

  return (
    <div
      className={`invoice-copy bg-white flex flex-col ${
        isDoubleCopy
          ? 'text-[10px] p-2 print:p-0 min-h-[120mm]'
          : 'text-[11px] p-4 sm:p-5 print:p-0 min-h-[265mm]'
      }`}
      style={{
        width: '100%',
        color: '#000000',
        boxSizing: 'border-box'
      }}
    >
      {/* ─── Header: Firm Info & Optional Payment Box ───────────────────── */}
      <div
        className={`grid grid-cols-2 gap-2 border-b border-black ${isDoubleCopy ? 'pb-1 mb-1' : 'pb-2 mb-2'}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '1px solid black',
          paddingBottom: isDoubleCopy ? '4px' : '8px',
          marginBottom: isDoubleCopy ? '4px' : '8px'
        }}
      >
        <div className="text-left">
          <h1
            className="font-bold mb-0.5 tracking-tight"
            style={{ fontSize: isDoubleCopy ? '17px' : '22px', margin: 0, lineHeight: 1.15 }}
          >
            {firmName}
          </h1>
          <p className="text-[11px] leading-tight text-gray-800" style={{ margin: '2px 0 0 0' }}>
            {firmAddress}
          </p>
        </div>
        <div
          className="flex justify-end text-[11px] leading-tight"
          style={{ display: 'flex', justifyContent: 'flex-end', textAlign: 'right' }}
        >
          {paymentInfo?.enabled && (
            <div
              className="text-left border-l border-r border-black px-2 mr-2"
              style={{
                borderLeft: '1px solid black',
                borderRight: '1px solid black',
                padding: '0 8px',
                marginRight: '8px',
                textAlign: 'left'
              }}
            >
              {paymentInfo.upiId && <p style={{ margin: '1px 0' }}>UPI: {paymentInfo.upiId}</p>}
              {paymentInfo.accountNumber && <p style={{ margin: '1px 0' }}>A/C: {paymentInfo.accountNumber}</p>}
              {paymentInfo.ifscCode && <p style={{ margin: '1px 0' }}>IFSC: {paymentInfo.ifscCode}</p>}
            </div>
          )}
          <div className="text-left" style={{ textAlign: 'left' }}>
            {firmPhone && <p style={{ margin: '1px 0' }}>Phone: {firmPhone}</p>}
            {firmDL && <p style={{ margin: '1px 0' }}>DL No: {firmDL}</p>}
            {firmGSTIN && <p style={{ margin: '1px 0' }}>GSTIN: {firmGSTIN}</p>}
          </div>
        </div>
      </div>

      {/* ─── Buyer & Invoice Details (3-Column Layout) ─────────────────── */}
      <div
        className={`grid grid-cols-3 gap-2 text-[11px] ${isDoubleCopy ? 'mb-1' : 'mb-2'}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          marginBottom: isDoubleCopy ? '4px' : '8px'
        }}
      >
        <div>
          <p className="font-bold mb-0.5">
            M/s {invoice.customer?.customerName || invoice.customer?.name || 'Walk-in Customer'}
          </p>
          <p className="leading-tight text-gray-800">{invoice.customer?.address || 'Address not provided'}</p>
          <p className="mt-0.5">Ph: {invoice.customer?.phone || '-'}</p>
        </div>
        <div
          className="border-l border-black pl-2"
          style={{ borderLeft: '1px solid black', paddingLeft: '8px' }}
        >
          {invoice.customer?.gstin && <p>GSTIN: {invoice.customer.gstin}</p>}
          {invoice.customer?.dlNo && <p>DL No: {invoice.customer.dlNo}</p>}
        </div>
        <div className="text-right" style={{ textAlign: 'right' }}>
          <p className="font-bold">Invoice No: {invoice.invoiceNumber || '-'}</p>
          <p>
            <span className="font-bold">Date:</span> {formatDate(invoice.invoiceDate)}
          </p>
          <p>
            <span className="font-bold">Bill Type:</span> {invoice.paymentType?.toUpperCase() || 'CREDIT'}
          </p>
          {copyTitle && (
            <p className="font-semibold text-[10px] text-gray-700 uppercase mt-0.5 tracking-wider">
              {copyTitle}
            </p>
          )}
        </div>
      </div>

      {/* ─── Line Items Table: Configurable Columns & Continuous Vertical Lines ─ */}
      <div className={`flex-1 flex flex-col ${isDoubleCopy ? 'mb-1' : 'mb-2'}`}>
        <table
          className="w-full flex-1 border-collapse"
          style={{
            border: '0.5px solid black',
            fontSize: isDoubleCopy ? '9px' : '10px',
            height: '100%'
          }}
        >
          <thead>
            <tr style={{ borderBottom: '0.5px solid black', background: '#f5f5f5' }}>
              {activeColumns.map((col, i) => (
                <th
                  key={col.key}
                  className={`${i < activeColumns.length - 1 ? 'border-r border-black' : ''} ${isDoubleCopy ? 'p-0.5' : 'py-1 px-1.5'} font-bold text-${col.align}`}
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, index) => (
              <tr
                key={index}
                style={{
                  height: '1px',
                  borderBottom: '0.5px solid #ddd',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid'
                }}
              >
                {activeColumns.map((col, i) => (
                  <td
                    key={col.key}
                    className={`${i < activeColumns.length - 1 ? 'border-r border-black' : ''} ${isDoubleCopy ? 'p-0.5' : 'py-1 px-1.5'} font-bold text-${col.align}`}
                  >
                    {col.renderCell ? col.renderCell(item) : col.render(item, { enableBatchTracking })}
                  </td>
                ))}
              </tr>
            ))}
            {/* Expanding filler row to continue vertical column lines down to the bottom border */}
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
          </tbody>
        </table>
      </div>

      {/* ─── Dynamic Notes / Remarks ─────────────────────────────────────── */}
      <PrintNotesBlock notes={invoice.notes} label="Notes" format={format} />

      {/* ─── Summary, Current Dues, Amount in Words & Signatory ──────────── */}
      <div className="mt-auto" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div className={`grid grid-cols-2 gap-2 ${isDoubleCopy ? 'mb-1' : 'mb-2'}`}>
          <div className={isDoubleCopy ? 'text-[10px]' : 'text-[11px]'}>
            <p className="font-bold">
              Current Dues: {customerOutstanding > 0 ? formatCurrency(customerOutstanding) : '₹0.00'}
            </p>
            <div className="border-t border-black mt-1 pt-0.5">
              <p className="font-bold mb-0.5">Amount in Words:</p>
              <p className="uppercase leading-tight font-semibold">
                {invoice.totals?.amountInWords || 'Rupees Zero Only'}
              </p>
            </div>
          </div>
          <div className={isDoubleCopy ? 'text-[10px]' : 'text-[11px]'}>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-0">Taxable:</td>
                  <td className="text-right font-semibold">₹{(Number(invoice.totals?.totalTaxable) || 0).toFixed(2)}</td>
                </tr>
                {invoice.totals?.totalDiscount > 0 && (
                  <tr>
                    <td className="py-0">Discount:</td>
                    <td className="text-right" style={{ color: '#dc2626' }}>
                      -₹{(Number(invoice.totals?.totalDiscount) || 0).toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-0">CGST:</td>
                  <td className="text-right">₹{(Number(invoice.totals?.totalCGST) || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">SGST:</td>
                  <td className="text-right">₹{(Number(invoice.totals?.totalSGST) || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">Round Off:</td>
                  <td className="text-right">{roundSign}</td>
                </tr>
                <tr className="border-t border-black">
                  <td className="py-0.5 font-bold">NET:</td>
                  <td className={`text-right font-bold ${isDoubleCopy ? 'text-[12px]' : 'text-[14px]'}`}>₹{netTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={`border-t border-black ${isDoubleCopy ? 'pt-1 text-[10px]' : 'pt-2 text-[11px]'}`}>
          <div className="flex justify-between items-end">
            <div>
              <p>E & O E</p>
            </div>
            <div className="text-center">
              <div className={isDoubleCopy ? 'h-6' : 'h-10'}></div>
              <p className="border-t border-black pt-0.5 font-semibold">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 3-Inch Thermal Roll Invoice (80mm / ~72mm usable width)
 * Independent POS receipt layout — untouched by sheet column toggles.
 */
function Thermal80Invoice({ invoice, admin, customerOutstanding }) {
  const netTotal = Math.round(invoice.totals?.netTotal || 0);

  const firm = {
    firmName: admin?.firmName || invoice.distributor?.firmName || 'BHARAT ENTERPRISE',
    firmAddress: admin?.firmAddress || invoice.distributor?.firmAddress || '',
    firmPhone: admin?.firmPhone || invoice.distributor?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || invoice.distributor?.firmGSTIN || ''
  };

  return (
    <div
      className="invoice-copy bg-white p-1 font-mono text-[9px]"
      style={{
        width: '100%',
        maxWidth: '74mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        color: '#000000',
        backgroundColor: '#ffffff'
      }}
    >
      <div className="text-center pb-1 mb-1 border-b border-black" style={{ color: '#000000' }}>
        <h1 className="text-xs font-bold uppercase tracking-tight">{firm.firmName}</h1>
        {firm.firmAddress && <p className="text-[8.5px] leading-tight mt-0.5">{firm.firmAddress}</p>}
        <div className="flex justify-center gap-2 text-[8.5px] mt-0.5">
          {firm.firmPhone && <span>Ph: {firm.firmPhone}</span>}
          {firm.firmGSTIN && <span>GSTIN: {firm.firmGSTIN}</span>}
        </div>
        <div className="mt-1 pt-0.5 border-t border-dashed border-black font-bold uppercase text-[9px]">
          TAX INVOICE
        </div>
      </div>

      {/* Metadata */}
      <div className="py-1 border-b border-dashed border-black text-[8.5px] space-y-0.5" style={{ color: '#000000' }}>
        <div className="flex justify-between">
          <span>Inv: <strong>{invoice.invoiceNumber}</strong></span>
          <span>{formatDate(invoice.invoiceDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer: <strong>{invoice.customer?.customerName || 'Walk-in'}</strong></span>
          {invoice.customer?.phone && <span>Ph: {invoice.customer.phone}</span>}
        </div>
      </div>

      {/* Item List */}
      <div className="py-1 border-b border-dashed border-black" style={{ color: '#000000' }}>
        <div className="flex justify-between font-bold border-b border-black pb-0.5 mb-1 text-[8px] uppercase">
          <span style={{ width: '48%' }}>Item</span>
          <span style={{ width: '14%' }} className="text-center">Qty</span>
          <span style={{ width: '18%' }} className="text-right">Rate</span>
          <span style={{ width: '20%' }} className="text-right">Total</span>
        </div>
        {invoice.items?.map((item, idx) => {
          const name = getInvoiceItemName(item);
          const qty = getInvoiceItemQty(item);
          const rate = getInvoiceItemRate(item);
          const total = getInvoiceItemTotal(item);
          const free = item.freeQuantity > 0 ? item.freeQuantity : 0;
          const batchInfo = getInvoiceItemBatchInfo(item);
          const hsn = getInvoiceItemHsn(item);
          const metaParts = [
            hsn ? `HSN:${hsn}` : '',
            batchInfo ? batchInfo.replace('Batch: ', 'B:') : '',
            free > 0 ? `(+${free} Free)` : ''
          ].filter(Boolean);
          const metaString = metaParts.join(' ');

          return (
            <div key={idx} className="py-1 border-b border-gray-200">
              <div className="font-bold break-words leading-tight text-[9px]" style={{ color: '#000000' }}>
                {name}
              </div>
              <div className="flex justify-between text-[8.5px] mt-0.5" style={{ color: '#000000' }}>
                <span style={{ width: '48%' }} className="truncate">
                  {metaString}
                </span>
                <span style={{ width: '14%' }} className="text-center font-medium">{qty}</span>
                <span style={{ width: '18%' }} className="text-right">{rate.toFixed(2)}</span>
                <span style={{ width: '20%', color: '#000000' }} className="text-right font-bold">
                  {total.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals Summary */}
      <div className="py-1 border-b border-dashed border-black space-y-0.5 text-[8.5px]" style={{ color: '#000000' }}>
        <div className="flex justify-between">
          <span>Taxable Amount:</span>
          <span>₹{(Number(invoice.totals?.totalTaxable) || 0).toFixed(2)}</span>
        </div>
        {invoice.totals?.totalDiscount > 0 && (
          <div className="flex justify-between" style={{ color: '#dc2626' }}>
            <span>Discount:</span>
            <span>-₹{(Number(invoice.totals?.totalDiscount) || 0).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>CGST:</span>
          <span>₹{(Number(invoice.totals?.totalCGST) || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>SGST:</span>
          <span>₹{(Number(invoice.totals?.totalSGST) || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-[11px] pt-1 border-t border-black" style={{ color: '#000000' }}>
          <span>NET AMOUNT:</span>
          <span>₹{netTotal}</span>
        </div>
      </div>

      {/* Notes & Dues */}
      <PrintNotesBlock notes={invoice.notes} label="Remarks" format={PRINT_FORMATS.THERMAL_80} />

      {customerOutstanding > 0 && (
        <div className="py-1 text-[8px] text-center border-b border-dashed border-black">
          <span>Total Balance Due: <strong>{formatCurrency(customerOutstanding)}</strong></span>
        </div>
      )}

      <PrintSignatoryBlock rightTitle="Cashier / Authorized" format={PRINT_FORMATS.THERMAL_80} />
    </div>
  );
}

/**
 * 2-Inch Thermal Roll Invoice (58mm / ~48mm usable width)
 * Independent POS receipt layout — untouched by sheet column toggles.
 */
function Thermal58Invoice({ invoice, admin }) {
  const netTotal = Math.round(invoice.totals?.netTotal || 0);

  const firm = {
    firmName: admin?.firmName || invoice.distributor?.firmName || 'BHARAT ENTERPRISE',
    firmPhone: admin?.firmPhone || invoice.distributor?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || invoice.distributor?.firmGSTIN || ''
  };

  return (
    <div
      className="invoice-copy bg-white p-0.5 font-mono text-[8px]"
      style={{
        width: '100%',
        maxWidth: '52mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        color: '#000000',
        backgroundColor: '#ffffff'
      }}
    >
      <div className="text-center pb-0.5 mb-0.5 border-b border-black" style={{ color: '#000000' }}>
        <h1 className="text-[10px] font-bold uppercase tracking-tight">{firm.firmName}</h1>
        {firm.firmPhone && <p className="text-[7.5px] mt-0.5">Ph: {firm.firmPhone}</p>}
        {firm.firmGSTIN && <p className="text-[7.5px]">GSTIN: {firm.firmGSTIN}</p>}
        <div className="mt-0.5 pt-0.5 border-t border-dashed border-black font-bold uppercase text-[8px]">
          TAX INVOICE
        </div>
      </div>

      {/* Metadata */}
      <div className="py-0.5 border-b border-dashed border-black text-[7.5px] space-y-0.2" style={{ color: '#000000' }}>
        <div className="flex justify-between">
          <span>#{invoice.invoiceNumber}</span>
          <span>{formatDate(invoice.invoiceDate)}</span>
        </div>
        <div className="truncate font-semibold">
          To: {invoice.customer?.customerName || 'Walk-in'}
        </div>
      </div>

      {/* Items */}
      <div className="py-0.5 border-b border-dashed border-black" style={{ color: '#000000' }}>
        {invoice.items?.map((item, idx) => {
          const name = getInvoiceItemName(item);
          const qty = getInvoiceItemQty(item);
          const rate = getInvoiceItemRate(item);
          const total = getInvoiceItemTotal(item);

          return (
            <div key={idx} className="py-0.5 border-b border-gray-100">
              <div className="font-bold break-words text-[8px] leading-tight" style={{ color: '#000000' }}>{name}</div>
              <div className="flex justify-between text-[7.5px] mt-0.5" style={{ color: '#000000' }}>
                <span>{qty} × ₹{rate.toFixed(2)}</span>
                <span className="font-bold" style={{ color: '#000000' }}>₹{total.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="py-0.5 border-b border-dashed border-black space-y-0.2 text-[8px]" style={{ color: '#000000' }}>
        <div className="flex justify-between">
          <span>Taxable:</span>
          <span>₹{(Number(invoice.totals?.totalTaxable) || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxes:</span>
          <span>₹{((Number(invoice.totals?.totalCGST) || 0) + (Number(invoice.totals?.totalSGST) || 0)).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-[10px] pt-0.5 border-t border-black" style={{ color: '#000000' }}>
          <span>NET:</span>
          <span>₹{netTotal}</span>
        </div>
      </div>

      <PrintNotesBlock notes={invoice.notes} label="Note" format={PRINT_FORMATS.THERMAL_58} />
      <PrintSignatoryBlock rightTitle="Authorized" format={PRINT_FORMATS.THERMAL_58} />
    </div>
  );
}

/**
 * Master Format-Aware Invoice Document
 */
export default function InvoiceDocument({
  invoice,
  format = PRINT_FORMATS.A4,
  copyMode = undefined,
  isSingleCopy = false,
  admin = null,
  customerOutstanding = 0,
  columns = null,
  enableBatchTracking = false
}) {
  if (!invoice) return null;

  const metadata = FORMAT_METADATA[format] || FORMAT_METADATA[PRINT_FORMATS.A4];

  // Thermal 80mm
  if (format === PRINT_FORMATS.THERMAL_80) {
    return (
      <div className={`invoice-print print-format-thermal-80 ${metadata.cssClass}`}>
        <Thermal80Invoice invoice={invoice} admin={admin} customerOutstanding={customerOutstanding} />
      </div>
    );
  }

  // Thermal 58mm
  if (format === PRINT_FORMATS.THERMAL_58) {
    return (
      <div className={`invoice-print print-format-thermal-58 ${metadata.cssClass}`}>
        <Thermal58Invoice invoice={invoice} admin={admin} />
      </div>
    );
  }

  // A4 / A5 Sheet (Default) — Supports 1x Full Page (single), 2x Half Sheet (double), and 1x Half Sheet (half)
  const resolvedMode = copyMode || (isSingleCopy ? INVOICE_COPY_MODES.FULL : INVOICE_COPY_MODES.DOUBLE);
  const isDouble = resolvedMode === INVOICE_COPY_MODES.DOUBLE;
  const isSingleHalf = resolvedMode === INVOICE_COPY_MODES.HALF;

  return (
    <div className={`invoice-print print-format-a4 ${metadata.cssClass}`}>
      <SheetInvoiceCopy
        invoice={invoice}
        format={PRINT_FORMATS.A4}
        admin={admin}
        customerOutstanding={customerOutstanding}
        isDoubleCopy={isDouble || isSingleHalf}
        copyTitle={isDouble ? 'Customer Copy' : null}
        columns={columns}
        enableBatchTracking={enableBatchTracking}
      />

      {isDouble && (
        <>
          <div className="flex items-center my-2" style={{ borderTop: '1px dashed #000' }}>
            <span className="text-[9px] text-gray-600 mx-auto bg-white px-2" style={{ marginTop: '-10px' }}>
              Cut Here
            </span>
          </div>
          <SheetInvoiceCopy
            invoice={invoice}
            format={PRINT_FORMATS.A4}
            admin={admin}
            customerOutstanding={customerOutstanding}
            isDoubleCopy={true}
            copyTitle="Dealer Copy"
            columns={columns}
            enableBatchTracking={enableBatchTracking}
          />
        </>
      )}
    </div>
  );
}
export { getBatchGroups };
