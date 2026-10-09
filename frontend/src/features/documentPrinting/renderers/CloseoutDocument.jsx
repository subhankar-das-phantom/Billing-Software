/**
 * Format-Aware Daily Cashier Closeout & Reconciliation Statement Renderer
 * Supports A4 & A5 Sheet Formats
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS, FORMAT_METADATA } from '../formats/documentPrintFormats';
import { PrintFirmHeader } from '../primitives/PrintPrimitives';

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CANONICAL_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

export default function CloseoutDocument({
  summary = {},
  payments = [],
  selectedDay = '',
  closeoutDateLabel = '',
  generatedTimestamp = '',
  format = PRINT_FORMATS.A4,
  admin = null
}) {
  const isA5 = format === PRINT_FORMATS.A5;
  const metadata = FORMAT_METADATA[format] || FORMAT_METADATA[PRINT_FORMATS.A4];

  const totalCollected = summary?.totalCollected || 0;
  const paymentCount = summary?.paymentCount || 0;
  const cashCollected = summary?.cashCollected || 0;
  const cashCount = summary?.cashCount || 0;
  const nonCashCollected = summary?.nonCashCollected || 0;
  const nonCashCount = summary?.nonCashCount || 0;
  const byMethod = summary?.byMethod || {};

  const cashShare = totalCollected > 0 ? ((cashCollected / totalCollected) * 100).toFixed(1) : '0.0';
  const nonCashShare = totalCollected > 0 ? ((nonCashCollected / totalCollected) * 100).toFixed(1) : '0.0';

  const firm = {
    firmName: admin?.firmName || 'BHARAT ENTERPRISE',
    firmAddress: admin?.firmAddress || '',
    firmPhone: admin?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || ''
  };

  return (
    <div className={`invoice-print ${metadata.cssClass}`}>
      <div
        className={`invoice-copy bg-white flex flex-col ${isA5 ? 'text-[8.5px] p-2' : 'text-[10px] p-4'}`}
        style={{ width: '100%', color: '#000000', boxSizing: 'border-box' }}
      >
        <PrintFirmHeader
          firm={firm}
          format={format}
          documentTitle="DAILY CASHIER CLOSEOUT STATEMENT"
          subtitle={`Business Date: ${closeoutDateLabel} · Audit Run: ${generatedTimestamp}`}
        />

        {/* 1. Cashier Reconciliation Summary Box */}
        <div className="my-2 border border-black p-2 bg-gray-50 text-[9px]" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h3 className="font-bold uppercase border-b border-gray-400 pb-1 mb-1.5 text-[9.5px]">
            1. Cashier Reconciliation Summary
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-gray-600">Total Cash Collections:</p>
              <p className="text-sm font-bold font-mono">{formatCurrency(cashCollected)}</p>
              <p className="text-[8px] text-gray-500">{cashCount} receipts ({cashShare}%)</p>
            </div>
            <div>
              <p className="text-gray-600">Total Digital &amp; Non-Cash:</p>
              <p className="text-sm font-bold font-mono">{formatCurrency(nonCashCollected)}</p>
              <p className="text-[8px] text-gray-500">{nonCashCount} receipts ({nonCashShare}%)</p>
            </div>
            <div>
              <p className="text-gray-600">Total Register Collections:</p>
              <p className="text-sm font-bold font-mono">{formatCurrency(totalCollected)}</p>
              <p className="text-[8px] text-gray-500">{paymentCount} transactions (100%)</p>
            </div>
          </div>
        </div>

        {/* 2. Payment Method Ledger Breakdown */}
        <div className="my-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h3 className="font-bold uppercase mb-1 text-[9.5px]">
            2. Payment Method Ledger Breakdown
          </h3>
          <table className="w-full border-collapse border border-black" style={{ fontSize: isA5 ? '8px' : '9px' }}>
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="border border-black p-1 text-left">Method</th>
                <th className="border border-black p-1 text-center">Receipts</th>
                <th className="border border-black p-1 text-right">Total Amount</th>
                <th className="border border-black p-1 text-right">Avg / Receipt</th>
                <th className="border border-black p-1 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {CANONICAL_METHODS.map((method) => {
                const info = byMethod[method] || { count: 0, total: 0 };
                const share = totalCollected > 0 ? ((info.total / totalCollected) * 100).toFixed(1) : '0.0';
                const avg = info.count > 0 ? info.total / info.count : 0;
                return (
                  <tr key={method} className="border-b border-black">
                    <td className="border border-black p-1 font-medium">{method}</td>
                    <td className="border border-black p-1 text-center font-mono">{info.count}</td>
                    <td className="border border-black p-1 text-right font-mono font-bold">{formatCurrency(info.total)}</td>
                    <td className="border border-black p-1 text-right font-mono">{formatCurrency(avg)}</td>
                    <td className="border border-black p-1 text-right font-mono">{share}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. Itemized Receipt Register */}
        <div className="my-2">
          <h3 className="font-bold uppercase mb-1 text-[9.5px]">
            3. Itemized Receipt Register ({payments.length} entries for {closeoutDateLabel})
          </h3>
          <table className="print-table w-full border-collapse border border-black" style={{ fontSize: isA5 ? '7.5px' : '8.5px' }}>
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="border border-black p-1 text-left" style={{ width: '15%' }}>Time</th>
                <th className="border border-black p-1 text-left" style={{ width: '25%' }}>Customer</th>
                <th className="border border-black p-1 text-left" style={{ width: '20%' }}>Invoice / Ref</th>
                <th className="border border-black p-1 text-left" style={{ width: '15%' }}>Method</th>
                <th className="border border-black p-1 text-left" style={{ width: '12%' }}>UTR / Ref</th>
                <th className="border border-black p-1 text-right" style={{ width: '13%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-300">
                  <td className="border border-black p-1 font-mono">
                    {p.paymentDate ? new Date(p.paymentDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                  </td>
                  <td className="border border-black p-1 font-medium">{p.customer?.name || 'Unknown'}</td>
                  <td className="border border-black p-1 font-mono">{p.invoice?.invoiceNumber || (p.entryType ? 'Manual Entry' : '-')}</td>
                  <td className="border border-black p-1">{p.paymentMethod}</td>
                  <td className="border border-black p-1 font-mono">{p.referenceNumber || '—'}</td>
                  <td className="border border-black p-1 text-right font-mono font-bold">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification & Sign-off Block */}
        <div className="mt-auto pt-4 border-t-2 border-black grid grid-cols-2 gap-8 text-[9px]" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div>
            <p className="text-gray-600 mb-6">Cashier / Operator Verification:</p>
            <div className="border-t border-black w-44 pt-1">
              <p className="font-bold">Authorized Cashier</p>
              <p className="text-[8px] text-gray-500">Date: {closeoutDateLabel}</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-gray-600 mb-6">Manager / Branch Auditor Sign-off:</p>
            <div className="border-t border-black w-44 pt-1 text-right">
              <p className="font-bold">Store / Branch Manager</p>
              <p className="text-[8px] text-gray-500">Register Reconciled &amp; Audited</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
