/**
 * Format-Aware Enterprise Credit Note Document Renderer
 * Supports A4, A5, Thermal 80mm, Thermal 58mm
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

/** Defensive item extraction helpers for Credit Note */
function getCNItemName(item) {
  return (
    item.product?.productName ||
    item.productName ||
    item.product?.name ||
    item.name ||
    'Returned Product'
  );
}

function getCNItemQty(item) {
  return Number(item.quantityReturned ?? item.quantity ?? 0);
}

function getCNItemRate(item) {
  return Number(item.ratePerUnit ?? item.rate ?? 0);
}

function getCNItemGst(item) {
  return Number(item.product?.gstPercentage ?? item.gstPercentage ?? item.gstPercent ?? item.gstRate ?? 0);
}

function getCNItemTaxable(item) {
  if (item.taxableAmount != null) return Number(item.taxableAmount);
  return getCNItemQty(item) * getCNItemRate(item);
}

function getCNItemTotal(item) {
  if (item.totalAmount != null) return Number(item.totalAmount);
  const taxable = getCNItemTaxable(item);
  const gst = getCNItemGst(item);
  return taxable * (1 + gst / 100);
}

/**
 * Standard Sheet Layout (A4 & A5)
 */
function SheetCreditNote({ creditNote, format = PRINT_FORMATS.A4, admin = null }) {
  const isA5 = format === PRINT_FORMATS.A5;

  const firm = {
    firmName: admin?.firmName || creditNote.distributor?.firmName || 'BHARAT ENTERPRISE',
    firmAddress: admin?.firmAddress || creditNote.distributor?.firmAddress || '',
    firmPhone: admin?.firmPhone || creditNote.distributor?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || creditNote.distributor?.firmGSTIN || '',
    firmDL: admin?.firmDL || creditNote.distributor?.firmDL || ''
  };

  const meta = {
    'Credit Note No': creditNote.creditNoteNumber,
    'Date': formatDate(creditNote.createdAt),
    'Against Invoice': creditNote.invoiceNumber || '-'
  };

  return (
    <div
      className={`invoice-copy bg-white flex flex-col ${isA5 ? 'text-[9px] p-2.5 min-h-[105mm]' : 'text-[10px] p-4 min-h-[130mm]'}`}
      style={{ width: '100%', color: '#000000', boxSizing: 'border-box' }}
    >
      <PrintFirmHeader
        firm={firm}
        format={format}
        documentTitle="CREDIT NOTE"
        subtitle="GST Section 34 Return"
      />

      <PrintPartyBlock
        party={creditNote.customer}
        title="Credit Issued To"
        format={format}
        meta={meta}
      />

      {/* Dynamic Reason */}
      {creditNote.reason && (
        <div className="py-1 mb-1 text-[9px] border-b border-dashed border-gray-400">
          <span className="font-bold">Return Reason: </span>
          <span className="italic">{creditNote.reason}</span>
        </div>
      )}

      {/* Items Table */}
      <div className="flex-1 mb-1">
        <table className="w-full border-collapse" style={{ border: '0.5px solid black', fontSize: isA5 ? '8px' : '9px' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid black', background: '#f5f5f5' }}>
              <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '5%' }}>SN</th>
              <th className="border-r border-black p-0.5 text-left font-bold" style={{ width: '40%' }}>Product Name</th>
              <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '8%' }}>Qty</th>
              <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '11%' }}>Rate</th>
              <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '7%' }}>GST%</th>
              <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '13%' }}>Taxable</th>
              <th className="p-0.5 text-right font-bold" style={{ width: '16%' }}>Credit Total</th>
            </tr>
          </thead>
          <tbody>
            {creditNote.items?.map((item, idx) => {
              const name = getCNItemName(item);
              const qty = getCNItemQty(item);
              const rate = getCNItemRate(item);
              const gst = getCNItemGst(item);
              const taxable = getCNItemTaxable(item);
              const total = getCNItemTotal(item);

              return (
                <tr key={idx} style={{ borderBottom: idx < creditNote.items.length - 1 ? '0.5px solid #ddd' : 'none' }}>
                  <td className="border-r border-black p-0.5 text-center">{idx + 1}</td>
                  <td className="border-r border-black p-0.5 font-bold break-words">{name}</td>
                  <td className="border-r border-black p-0.5 text-center font-bold">{qty}</td>
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

      {/* Summary & Signatory */}
      <div className="mt-auto" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div className="text-[9px] text-gray-700">
            <p className="mt-1">This is a system-generated Credit Note as per GST Section 34.</p>
            <p className="mt-0.5 font-medium">Stock has been returned to inventory.</p>
          </div>
          <div>
            <table className="w-full text-[9.5px]">
              <tbody>
                <tr>
                  <td className="py-0">Total Taxable:</td>
                  <td className="text-right font-semibold">₹{(Number(creditNote.totals?.totalTaxable) || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">CGST:</td>
                  <td className="text-right">₹{(Number(creditNote.totals?.totalCGST) || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">SGST:</td>
                  <td className="text-right">₹{(Number(creditNote.totals?.totalSGST) || 0).toFixed(2)}</td>
                </tr>
                <tr className="border-t border-black font-bold text-[11px]">
                  <td className="py-0.5">NET CREDIT:</td>
                  <td className="text-right">₹{(Number(creditNote.totals?.netTotal) || 0).toFixed(2)}</td>
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
 * Thermal Roll Layout (80mm & 58mm)
 */
function ThermalCreditNote({ creditNote, format = PRINT_FORMATS.THERMAL_80, admin = null }) {
  const is58 = format === PRINT_FORMATS.THERMAL_58;
  const firm = {
    firmName: admin?.firmName || creditNote.distributor?.firmName || 'BHARAT ENTERPRISE',
    firmPhone: admin?.firmPhone || creditNote.distributor?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || creditNote.distributor?.firmGSTIN || ''
  };

  return (
    <div
      className={`invoice-copy bg-white text-black p-1.5 font-mono ${is58 ? 'text-[8px] max-w-[52mm]' : 'text-[9px] max-w-[74mm]'}`}
      style={{ width: '100%', margin: '0 auto', boxSizing: 'border-box' }}
    >
      <PrintFirmHeader firm={firm} format={format} documentTitle="CREDIT NOTE" />

      <div className="py-1 border-b border-dashed border-black text-[8px] space-y-0.5">
        <div className="flex justify-between">
          <span>CN: <strong>{creditNote.creditNoteNumber}</strong></span>
          <span>{formatDate(creditNote.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Against Inv: <strong>{creditNote.invoiceNumber}</strong></span>
        </div>
        <div className="font-semibold truncate">
          To: {creditNote.customer?.customerName || 'Customer'}
        </div>
        {creditNote.reason && (
          <div className="text-[7.5px] italic text-gray-800 break-words">
            Reason: {creditNote.reason}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="py-1 border-b border-dashed border-black">
        {creditNote.items?.map((item, idx) => {
          const name = getCNItemName(item);
          const qty = getCNItemQty(item);
          const rate = getCNItemRate(item);
          const total = getCNItemTotal(item);

          return (
            <div key={idx} className="py-0.5 border-b border-gray-100">
              <div className="font-bold break-words">{name}</div>
              <div className="flex justify-between text-gray-700 text-[8px]">
                <span>Return Qty: {qty} × ₹{rate.toFixed(2)}</span>
                <span className="font-bold text-black">₹{total.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="py-1 border-b border-dashed border-black space-y-0.5 text-[8.5px]">
        <div className="flex justify-between">
          <span>Taxable:</span>
          <span>₹{(Number(creditNote.totals?.totalTaxable) || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxes:</span>
          <span>₹{((Number(creditNote.totals?.totalCGST) || 0) + (Number(creditNote.totals?.totalSGST) || 0)).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-[10px] pt-0.5 border-t border-black">
          <span>CREDIT TOTAL:</span>
          <span>₹{(Number(creditNote.totals?.netTotal) || 0).toFixed(2)}</span>
        </div>
      </div>

      <PrintSignatoryBlock rightTitle="Authorized Signatory" format={format} />
    </div>
  );
}

export default function CreditNoteDocument({ creditNote, format = PRINT_FORMATS.A4, admin = null }) {
  if (!creditNote) return null;
  const metadata = FORMAT_METADATA[format] || FORMAT_METADATA[PRINT_FORMATS.A4];

  if (format === PRINT_FORMATS.THERMAL_80 || format === PRINT_FORMATS.THERMAL_58) {
    return (
      <div className={`invoice-print ${metadata.cssClass}`}>
        <ThermalCreditNote creditNote={creditNote} format={format} admin={admin} />
      </div>
    );
  }

  return (
    <div className={`invoice-print ${metadata.cssClass}`}>
      <SheetCreditNote creditNote={creditNote} format={format} admin={admin} />
    </div>
  );
}
