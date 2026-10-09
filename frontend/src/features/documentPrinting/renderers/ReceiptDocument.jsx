/**
 * Format-Aware Payment Receipt Voucher Renderer
 * Supports A4, A5, Thermal 80mm, Thermal 58mm
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS, FORMAT_METADATA } from '../formats/documentPrintFormats';
import { PrintFirmHeader, PrintNotesBlock, PrintSignatoryBlock } from '../primitives/PrintPrimitives';

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

/**
 * Standard Sheet Receipt Voucher (A4 & A5)
 */
function SheetReceipt({ payment, format = PRINT_FORMATS.A4, admin = null, amountInWords = '' }) {
  const isA5 = format === PRINT_FORMATS.A5;
  const firm = {
    firmName: admin?.firmName || 'BHARAT ENTERPRISE',
    firmAddress: admin?.firmAddress || '',
    firmPhone: admin?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || ''
  };

  const displayId = payment.id
    ? (payment.id.startsWith('#') ? payment.id : `#PMT-${payment.id.slice(-8).toUpperCase()}`)
    : '#PMT-RECEIPT';

  return (
    <div
      className={`invoice-copy bg-white flex flex-col ${isA5 ? 'text-[9px] p-3 min-h-[90mm]' : 'text-[11px] p-6 min-h-[120mm]'}`}
      style={{ width: '100%', color: '#000000', boxSizing: 'border-box' }}
    >
      <PrintFirmHeader
        firm={firm}
        format={format}
        documentTitle="PAYMENT RECEIPT VOUCHER"
        subtitle={`Official Voucher · ${displayId}`}
      />

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 py-2 border-b border-black text-[10px]">
        <div className="space-y-1">
          <p><strong>Receipt ID:</strong> {displayId}</p>
          <p><strong>Date &amp; Time:</strong> {formatDate(payment.paymentDate)} at {formatTime(payment.paymentDate)}</p>
          <p><strong>Payment Mode:</strong> {payment.paymentMethod || 'Cash'}</p>
          {payment.referenceNumber && <p><strong>UTR / Cheque Ref:</strong> {payment.referenceNumber}</p>}
        </div>
        <div className="text-right space-y-1">
          <p><strong>Received From:</strong> M/s {payment.customer?.name || payment.customer?.customerName || 'Walk-in Customer'}</p>
          {payment.customer?.phone && <p><strong>Phone:</strong> {payment.customer.phone}</p>}
          <p><strong>Settled Against:</strong> {payment.invoice?.invoiceNumber || (payment.entryType ? 'Manual Adjustment' : 'Account Settlement')}</p>
          <p><strong>Recorded By:</strong> {payment.recordedBy?.name || 'Authorized Cashier'}</p>
        </div>
      </div>

      {/* Amount Box */}
      <div className="my-4 p-4 text-center border border-black bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-600">Total Amount Received</span>
        <p className={`${isA5 ? 'text-2xl' : 'text-3xl'} font-bold mt-1 font-mono`}>{formatCurrency(payment.amount)}</p>
        {amountInWords && (
          <p className="text-[10px] italic mt-1 font-medium text-gray-800">{amountInWords}</p>
        )}
      </div>

      {/* Dynamic Remarks */}
      <PrintNotesBlock notes={payment.notes} label="Remarks / Notes" format={format} />

      {/* Dual Signature Block */}
      <div className="mt-auto">
        <PrintSignatoryBlock leftTitle="Customer Signature" rightTitle="Authorized Cashier" format={format} />
      </div>
    </div>
  );
}

/**
 * Thermal Roll Receipt (80mm & 58mm)
 */
function ThermalReceipt({ payment, format = PRINT_FORMATS.THERMAL_80, admin = null, amountInWords = '' }) {
  const is58 = format === PRINT_FORMATS.THERMAL_58;
  const firm = {
    firmName: admin?.firmName || 'BHARAT ENTERPRISE',
    firmPhone: admin?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || ''
  };

  const displayId = payment.id
    ? (payment.id.startsWith('#') ? payment.id : `#PMT-${payment.id.slice(-8).toUpperCase()}`)
    : '#PMT-RECEIPT';

  return (
    <div
      className={`invoice-copy bg-white text-black p-1.5 font-mono ${is58 ? 'text-[8px] max-w-[52mm]' : 'text-[9px] max-w-[74mm]'}`}
      style={{ width: '100%', margin: '0 auto', boxSizing: 'border-box' }}
    >
      <PrintFirmHeader firm={firm} format={format} documentTitle="PAYMENT RECEIPT" />

      <div className="py-1 border-b border-dashed border-black text-[8px] space-y-0.5">
        <div className="flex justify-between">
          <span>{displayId}</span>
          <span>{formatDate(payment.paymentDate)}</span>
        </div>
        <div className="truncate font-semibold">
          From: {payment.customer?.name || payment.customer?.customerName || 'Customer'}
        </div>
        <div className="flex justify-between">
          <span>Mode: {payment.paymentMethod || 'Cash'}</span>
          {payment.referenceNumber && <span>Ref: {payment.referenceNumber}</span>}
        </div>
      </div>

      {/* Amount Callout */}
      <div className="py-2 my-1 text-center border-t border-b border-black bg-gray-50">
        <span className="text-[8px] uppercase tracking-wide">Amount Received</span>
        <p className="text-base font-bold font-mono mt-0.5">{formatCurrency(payment.amount)}</p>
        {amountInWords && (
          <p className="text-[7.5px] italic text-gray-700 leading-tight mt-0.5">{amountInWords}</p>
        )}
      </div>

      <PrintNotesBlock notes={payment.notes} label="Remarks" format={format} />
      <PrintSignatoryBlock rightTitle="Authorized Cashier" format={format} />
    </div>
  );
}

export default function ReceiptDocument({ payment, format = PRINT_FORMATS.A4, admin = null, amountInWords = '' }) {
  if (!payment) return null;
  const metadata = FORMAT_METADATA[format] || FORMAT_METADATA[PRINT_FORMATS.A4];

  if (format === PRINT_FORMATS.THERMAL_80 || format === PRINT_FORMATS.THERMAL_58) {
    return (
      <div className={`invoice-print ${metadata.cssClass}`}>
        <ThermalReceipt payment={payment} format={format} admin={admin} amountInWords={amountInWords} />
      </div>
    );
  }

  return (
    <div className={`invoice-print ${metadata.cssClass}`}>
      <SheetReceipt payment={payment} format={format} admin={admin} amountInWords={amountInWords} />
    </div>
  );
}
