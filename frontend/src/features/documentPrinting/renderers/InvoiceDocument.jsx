/**
 * Format-Aware Enterprise Invoice Document Renderer
 * Supports A4 (Single / Double Copy), A5, Thermal 80mm, Thermal 58mm
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS, FORMAT_METADATA } from '../formats/documentPrintFormats';
import { PrintFirmHeader, PrintPartyBlock, PrintNotesBlock, PrintSignatoryBlock } from '../primitives/PrintPrimitives';

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

/** Defensive item extraction helpers for populated and flat structures */
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

function getInvoiceItemGst(item) {
  return Number(item.product?.gstPercentage ?? item.gstPercentage ?? item.gstPercent ?? item.gstRate ?? 0);
}

function getInvoiceItemTaxable(item) {
  if (item.taxableAmount != null) return Number(item.taxableAmount);
  if (item.baseAmount != null) return Number(item.baseAmount);
  const qty = getInvoiceItemQty(item);
  const rate = getInvoiceItemRate(item);
  const discount = Number(item.schemeDiscount ?? item.discountPercentage ?? 0);
  return qty * rate * (1 - discount / 100);
}

function getInvoiceItemTotal(item) {
  if (item.totalAmount != null) return Number(item.totalAmount);
  if (item.amount != null) return Number(item.amount);
  const qty = getInvoiceItemQty(item);
  const rate = getInvoiceItemRate(item);
  return qty * rate;
}

/**
 * Standard Sheet Invoice (A4 and A5)
 */
function SheetInvoiceCopy({ invoice, format = PRINT_FORMATS.A4, admin = null, customerOutstanding = 0, isDoubleCopy = false, copyTitle = null }) {
  const isA5 = format === PRINT_FORMATS.A5;
  const netTotal = Math.round(invoice.totals?.netTotal || 0);
  const rawNet = invoice.totals?.netTotal || 0;
  const roundDiff = netTotal - rawNet;
  const roundSign = roundDiff >= 0 ? `+₹${roundDiff.toFixed(2)}` : `-₹${Math.abs(roundDiff).toFixed(2)}`;

  const firm = {
    firmName: admin?.firmName || invoice.distributor?.firmName || 'BHARAT ENTERPRISE',
    firmAddress: admin?.firmAddress || invoice.distributor?.firmAddress || '',
    firmPhone: admin?.firmPhone || invoice.distributor?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || invoice.distributor?.firmGSTIN || '',
    firmDL: admin?.firmDL || invoice.distributor?.firmDL || ''
  };

  const invoiceMeta = {
    'Invoice No': invoice.invoiceNumber,
    'Date': formatDate(invoice.invoiceDate),
    'Bill Type': invoice.paymentType?.toUpperCase() || 'CREDIT'
  };

  return (
    <div
      className={`invoice-copy bg-white flex flex-col ${isA5 ? 'text-[9px] p-2 min-h-[110mm]' : isDoubleCopy ? 'text-[10px] p-2 min-h-[125mm]' : 'text-[11px] p-3 min-h-[140mm]'}`}
      style={{
        width: '100%',
        color: '#000000',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <PrintFirmHeader
        firm={firm}
        format={format}
        documentTitle={invoice.status === 'Cancelled' ? 'TAX INVOICE (CANCELLED)' : 'TAX INVOICE'}
        subtitle={copyTitle}
      />

      {/* Buyer & Invoice Meta */}
      <PrintPartyBlock
        party={invoice.customer}
        title="Billed To"
        format={format}
        meta={invoiceMeta}
      />

      {/* Line Items Table */}
      <div className="flex-1 mb-1">
        <table className="w-full border-collapse" style={{ border: '0.5px solid black', fontSize: isA5 ? '8px' : '9px' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid black', background: '#f5f5f5' }}>
              <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '4%' }}>SN</th>
              <th className="border-r border-black p-0.5 text-left font-bold" style={{ width: '38%' }}>Item Description</th>
              <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '6%' }}>Qty</th>
              {invoice.items?.some(i => i.freeQuantity > 0) && (
                <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '6%' }}>Free</th>
              )}
              <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '10%' }}>Rate</th>
              <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '7%' }}>GST%</th>
              <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '12%' }}>Taxable</th>
              <th className="p-0.5 text-right font-bold" style={{ width: '13%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, idx) => {
              const name = getInvoiceItemName(item);
              const qty = getInvoiceItemQty(item);
              const rate = getInvoiceItemRate(item);
              const gst = getInvoiceItemGst(item);
              const taxable = getInvoiceItemTaxable(item);
              const total = getInvoiceItemTotal(item);
              const batchInfo = getInvoiceItemBatchInfo(item);
              const hsn = getInvoiceItemHsn(item);

              return (
                <tr key={idx} style={{ borderBottom: idx < invoice.items.length - 1 ? '0.5px solid #ddd' : 'none' }}>
                  <td className="border-r border-black p-0.5 text-center">{idx + 1}</td>
                  <td className="border-r border-black p-0.5 font-bold">
                    <div className="break-words">{name}</div>
                    {(hsn || batchInfo) && (
                      <div className="text-[7.5px] font-normal text-gray-600 flex gap-2">
                        {hsn && <span>HSN: {hsn}</span>}
                        {batchInfo && <span>{batchInfo}</span>}
                      </div>
                    )}
                  </td>
                  <td className="border-r border-black p-0.5 text-center font-bold">{qty}</td>
                  {invoice.items?.some(i => i.freeQuantity > 0) && (
                    <td className="border-r border-black p-0.5 text-center">{item.freeQuantity || '-'}</td>
                  )}
                  <td className="border-r border-black p-0.5 text-right">{rate.toFixed(2)}</td>
                  <td className="border-r border-black p-0.5 text-center">{gst}%</td>
                  <td className="border-r border-black p-0.5 text-right">{taxable.toFixed(2)}</td>
                  <td className="p-0.5 text-right font-bold">{total.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dynamic Notes */}
      <PrintNotesBlock notes={invoice.notes} label="Notes" format={format} />

      {/* Totals & Signatory */}
      <div className="mt-auto" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div className="text-[9.5px]">
            <p className="font-bold">
              Current Outstanding: {customerOutstanding > 0 ? formatCurrency(customerOutstanding) : '₹0.00'}
            </p>
            <div className="border-t border-black mt-1 pt-0.5">
              <p className="font-bold mb-0.5 text-[8.5px] uppercase text-gray-600">Amount in Words:</p>
              <p className="uppercase font-semibold text-[9px] leading-tight">
                {invoice.totals?.amountInWords || 'Rupees Zero Only'}
              </p>
            </div>
          </div>
          <div>
            <table className="w-full text-[9.5px]">
              <tbody>
                <tr>
                  <td className="py-0">Taxable:</td>
                  <td className="text-right font-semibold">₹{(Number(invoice.totals?.totalTaxable) || 0).toFixed(2)}</td>
                </tr>
                {invoice.totals?.totalDiscount > 0 && (
                  <tr>
                    <td className="py-0">Discount:</td>
                    <td className="text-right text-red-600">-₹{(Number(invoice.totals?.totalDiscount) || 0).toFixed(2)}</td>
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
                <tr className="border-t border-black font-bold text-[11px]">
                  <td className="py-0.5">NET PAYABLE:</td>
                  <td className="text-right">₹{netTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <PrintSignatoryBlock rightTitle="Authorized Signatory" format={format} />
      </div>
    </div>
  );
}

/**
 * 3-Inch Thermal Roll Invoice (80mm / ~72mm usable width)
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
      className="invoice-copy bg-white text-black p-1 font-mono text-[9px]"
      style={{ width: '100%', maxWidth: '74mm', margin: '0 auto', boxSizing: 'border-box' }}
    >
      <PrintFirmHeader firm={firm} format={PRINT_FORMATS.THERMAL_80} documentTitle="TAX INVOICE" />

      {/* Metadata */}
      <div className="py-1 border-b border-dashed border-black text-[8.5px] space-y-0.5">
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
      <div className="py-1 border-b border-dashed border-black">
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
              <div className="font-bold break-words leading-tight text-[9px] text-black">
                {name}
              </div>
              <div className="flex justify-between text-gray-800 text-[8.5px] mt-0.5">
                <span style={{ width: '48%' }} className="truncate">
                  {metaString}
                </span>
                <span style={{ width: '14%' }} className="text-center font-medium">{qty}</span>
                <span style={{ width: '18%' }} className="text-right">{rate.toFixed(2)}</span>
                <span style={{ width: '20%' }} className="text-right font-bold text-black">
                  {total.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals Summary */}
      <div className="py-1 border-b border-dashed border-black space-y-0.5 text-[8.5px]">
        <div className="flex justify-between">
          <span>Taxable Amount:</span>
          <span>₹{(Number(invoice.totals?.totalTaxable) || 0).toFixed(2)}</span>
        </div>
        {invoice.totals?.totalDiscount > 0 && (
          <div className="flex justify-between text-red-600">
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
        <div className="flex justify-between font-bold text-[11px] pt-1 border-t border-black">
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
      className="invoice-copy bg-white text-black p-0.5 font-mono text-[8px]"
      style={{ width: '100%', maxWidth: '52mm', margin: '0 auto', boxSizing: 'border-box' }}
    >
      <PrintFirmHeader firm={firm} format={PRINT_FORMATS.THERMAL_58} documentTitle="TAX INVOICE" />

      {/* Metadata */}
      <div className="py-0.5 border-b border-dashed border-black text-[7.5px] space-y-0.2">
        <div className="flex justify-between">
          <span>#{invoice.invoiceNumber}</span>
          <span>{formatDate(invoice.invoiceDate)}</span>
        </div>
        <div className="truncate font-semibold">
          To: {invoice.customer?.customerName || 'Walk-in'}
        </div>
      </div>

      {/* Items */}
      <div className="py-0.5 border-b border-dashed border-black">
        {invoice.items?.map((item, idx) => {
          const name = getInvoiceItemName(item);
          const qty = getInvoiceItemQty(item);
          const rate = getInvoiceItemRate(item);
          const total = getInvoiceItemTotal(item);

          return (
            <div key={idx} className="py-0.5 border-b border-gray-100">
              <div className="font-bold break-words text-[8px] text-black leading-tight">{name}</div>
              <div className="flex justify-between text-gray-800 text-[7.5px] mt-0.5">
                <span>{qty} × ₹{rate.toFixed(2)}</span>
                <span className="font-bold text-black">₹{total.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="py-0.5 border-b border-dashed border-black space-y-0.2 text-[8px]">
        <div className="flex justify-between">
          <span>Taxable:</span>
          <span>₹{(Number(invoice.totals?.totalTaxable) || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxes:</span>
          <span>₹{((Number(invoice.totals?.totalCGST) || 0) + (Number(invoice.totals?.totalSGST) || 0)).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-[10px] pt-0.5 border-t border-black">
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
  isSingleCopy = false,
  admin = null,
  customerOutstanding = 0
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

  // A5 Sheet
  if (format === PRINT_FORMATS.A5) {
    return (
      <div className={`invoice-print print-format-a5 ${metadata.cssClass}`}>
        <SheetInvoiceCopy
          invoice={invoice}
          format={PRINT_FORMATS.A5}
          admin={admin}
          customerOutstanding={customerOutstanding}
          isDoubleCopy={false}
        />
      </div>
    );
  }

  // A4 Sheet (Default) — Preserves 1x Single vs 2x Double Copy
  const isDouble = !isSingleCopy;

  return (
    <div className={`invoice-print print-format-a4 ${metadata.cssClass}`}>
      <SheetInvoiceCopy
        invoice={invoice}
        format={PRINT_FORMATS.A4}
        admin={admin}
        customerOutstanding={customerOutstanding}
        isDoubleCopy={isDouble}
        copyTitle={isDouble ? 'Customer Copy' : null}
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
          />
        </>
      )}
    </div>
  );
}
