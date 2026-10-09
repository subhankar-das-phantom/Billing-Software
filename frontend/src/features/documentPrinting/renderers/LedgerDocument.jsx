/**
 * Unified Format-Aware Ledger Document Renderer (Customer & Supplier)
 * Supports A4 & A5 Sheet Formats with Guaranteed Non-Repeating Final Summaries
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS, FORMAT_METADATA } from '../formats/documentPrintFormats';
import { PrintFirmHeader, PrintPartyBlock, PrintSignatoryBlock } from '../primitives/PrintPrimitives';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export default function LedgerDocument({
  party, // Customer or Supplier object
  partyType = 'customer', // 'customer' | 'supplier'
  ledgerEntries = [],
  summary = {},
  format = PRINT_FORMATS.A4,
  admin = null
}) {
  if (!party) return null;

  const isA5 = format === PRINT_FORMATS.A5;
  const metadata = FORMAT_METADATA[format] || FORMAT_METADATA[PRINT_FORMATS.A4];
  const isSupplier = partyType === 'supplier';

  const firm = {
    firmName: admin?.firmName || 'BHARAT ENTERPRISE',
    firmAddress: admin?.firmAddress || '',
    firmPhone: admin?.firmPhone || '',
    firmGSTIN: admin?.firmGSTIN || ''
  };

  const title = isSupplier ? 'SUPPLIER LEDGER STATEMENT' : 'CUSTOMER LEDGER STATEMENT';
  const partyTitle = isSupplier ? 'Supplier' : 'Customer';

  const totalDebit = Number(summary.totalDebit) || 0;
  const totalCredit = Number(summary.totalCredit) || 0;
  const closingBalance = Number(summary.closingBalance) || 0;
  const balanceLabel = isSupplier
    ? (closingBalance >= 0 ? '(Cr)' : '(Dr)')
    : (closingBalance > 0 ? '(Dr)' : closingBalance < 0 ? '(Cr)' : '');

  return (
    <div className={`invoice-print ${metadata.cssClass}`}>
      <div
        className={`invoice-copy bg-white flex flex-col ${isA5 ? 'text-[8.5px] p-2' : 'text-[10px] p-4'}`}
        style={{ width: '100%', color: '#000000', boxSizing: 'border-box' }}
      >
        <PrintFirmHeader firm={firm} format={format} documentTitle={title} />

        <PrintPartyBlock
          party={party}
          title={partyTitle}
          format={format}
          meta={{ 'Statement Date': formatDate(new Date()) }}
        />

        {/* Multi-Page Transaction Table */}
        <div className="w-full mb-1">
          <table
            className="print-table w-full border-collapse"
            style={{ fontSize: isA5 ? '8px' : '9px', border: '1px solid black' }}
          >
            <thead>
              <tr style={{ background: '#f0f0f0', borderBottom: '1px solid black' }}>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'left', width: '10%' }}>Date</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'left', width: '12%' }}>Type</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'left', width: '12%' }}>Ref #</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'left', width: '10%' }}>
                  {isSupplier ? 'Inv #' : 'Mode'}
                </th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'left', width: '26%' }}>Description</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'right', width: '10%' }}>Debit (₹)</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'right', width: '10%' }}>Credit (₹)</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'right', width: '10%' }}>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry, idx) => (
                <tr key={idx} style={{ borderBottom: '0.5px solid #ccc' }}>
                  <td style={{ border: '1px solid black', padding: '3px' }}>{formatDate(entry.date)}</td>
                  <td style={{ border: '1px solid black', padding: '3px', fontWeight: entry.debit > 0 ? 'bold' : 'normal' }}>
                    {entry.type}
                  </td>
                  <td style={{ border: '1px solid black', padding: '3px' }}>{entry.ref}</td>
                  <td style={{ border: '1px solid black', padding: '3px' }}>
                    {isSupplier
                      ? (entry.supplierInvoiceNumber && entry.supplierInvoiceNumber !== '-' ? entry.supplierInvoiceNumber : '')
                      : (entry.mode && entry.mode !== '-' ? entry.mode : '')}
                  </td>
                  <td style={{ border: '1px solid black', padding: '3px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                    {entry.description || '-'}
                  </td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right' }}>
                    {entry.debit > 0 ? Number(entry.debit).toFixed(2) : ''}
                  </td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right' }}>
                    {entry.credit > 0 ? Number(entry.credit).toFixed(2) : ''}
                  </td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>
                    {Math.abs(Number(entry.balance) || 0).toFixed(2)}{' '}
                    {isSupplier
                      ? ((Number(entry.balance) || 0) >= 0 ? '(Cr)' : '(Dr)')
                      : ((Number(entry.balance) || 0) > 0 ? '(Dr)' : (Number(entry.balance) || 0) < 0 ? '(Cr)' : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Standalone Final Ledger Summary Block (outside <table> to prevent pagination repetition) */}
        <div
          className="print-final-summary"
          style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '-1px' }}
        >
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: isA5 ? '8px' : '9px', border: '1px solid black' }}
          >
            <tbody>
              <tr style={{ fontWeight: 'bold', background: '#fafafa', borderBottom: '1px solid black' }}>
                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', width: '70%' }}>
                  TOTAL TRANSACTIONS
                </td>
                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', width: '10%', opacity: 0.8 }}>
                  {totalDebit.toFixed(2)}
                </td>
                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', width: '10%', opacity: 0.8 }}>
                  {totalCredit.toFixed(2)}
                </td>
                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', width: '10%', opacity: 0.8 }}>-</td>
              </tr>
              <tr style={{ fontWeight: 'bold', background: '#f0f0f0', fontSize: isA5 ? '9px' : '10px' }}>
                <td colSpan="3" style={{ border: '1px solid black', padding: '6px', textAlign: 'right', width: '90%' }}>
                  CLOSING BALANCE:
                </td>
                <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', width: '10%' }}>
                  {Math.abs(closingBalance).toFixed(2)} {balanceLabel}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatory Footer */}
        <div className="mt-auto">
          <PrintSignatoryBlock
            leftTitle={null}
            rightTitle="Authorized Signatory"
            format={format}
            notes="This is a computer-generated authoritative ledger statement."
          />
        </div>
      </div>
    </div>
  );
}
