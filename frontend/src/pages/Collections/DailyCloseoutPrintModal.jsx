import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Building2,
  ShieldCheck,
  Banknote,
  Smartphone,
  CreditCard,
  FileText,
  Clock
} from 'lucide-react';
import { formatCurrency, formatDate, formatPaymentTime } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const CANONICAL_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'];

const METHOD_ICONS = {
  'Cash': Banknote,
  'UPI': Smartphone,
  'Bank Transfer': Building2,
  'Cheque': FileText,
  'NEFT/RTGS': Building2
};

export default function DailyCloseoutPrintModal({
  isOpen,
  onClose,
  dateLabel,
  summary,
  payments = []
}) {
  const { admin } = useAuth();

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const firmName = admin?.firmName || admin?.name || 'Bharat Enterprise';
  const firmGstin = admin?.gstin || '';
  const firmAddress = admin?.address || '';
  const firmPhone = admin?.phone || '';

  const totalCollected = summary?.totalCollected || 0;
  const paymentCount = summary?.paymentCount || 0;
  const cashCollected = summary?.cashCollected || 0;
  const cashCount = summary?.cashCount || 0;
  const nonCashCollected = summary?.nonCashCollected || 0;
  const nonCashCount = summary?.nonCashCount || 0;
  const byMethod = summary?.byMethod || {};

  const cashShare = totalCollected > 0 ? ((cashCollected / totalCollected) * 100).toFixed(1) : '0.0';
  const nonCashShare = totalCollected > 0 ? ((nonCashCollected / totalCollected) * 100).toFixed(1) : '0.0';

  const handlePrint = () => {
    window.print();
  };

  const generatedTimestamp = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(new Date());

  return createPortal(
    <>
      {/* On-Screen Closeout Modal (no-print) */}
      <div
        className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 sm:hidden rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Back to Collections"
                aria-label="Back to Collections"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">Daily Cashier Closeout & Reconciliation</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Business Date: <span className="text-white font-medium">{dateLabel}</span> · Complete Day Scope
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scope Notice */}
          <div className="px-6 py-2.5 bg-slate-850 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>Closeout Scope:</strong> All collections recorded for <strong>{dateLabel}</strong> (independent of active table search filters).
              </span>
            </div>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              Audit Run: {generatedTimestamp}
            </span>
          </div>

          {/* Scrollable Content */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Executive KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Recorded Cash Collections */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Recorded Cash Collections
                </span>
                <p className="text-2xl font-bold text-emerald-400 font-mono">
                  {formatCurrency(cashCollected)}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                  <span>{cashCount} cash receipts</span>
                  <span className="font-mono text-emerald-400 font-semibold">{cashShare}% of total</span>
                </div>
              </div>

              {/* Non-Cash Collections */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Non-Cash Collections
                </span>
                <p className="text-2xl font-bold text-cyan-400 font-mono">
                  {formatCurrency(nonCashCollected)}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                  <span>{nonCashCount} receipts (UPI/Bank/Cheque)</span>
                  <span className="font-mono text-cyan-400 font-semibold">{nonCashShare}% of total</span>
                </div>
              </div>

              {/* Total Collections */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Net Collections
                </span>
                <p className="text-2xl font-bold text-white font-mono">
                  {formatCurrency(totalCollected)}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                  <span>{paymentCount} total transactions</span>
                  <span className="font-mono text-slate-300">100% accounted</span>
                </div>
              </div>
            </div>

            {/* Payment Method Distribution Breakdown */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                Payment Method Ledger Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-medium">Channel</th>
                      <th className="pb-2 font-medium text-center">Receipts</th>
                      <th className="pb-2 font-medium text-right">Volume</th>
                      <th className="pb-2 font-medium text-right">Average Ticket</th>
                      <th className="pb-2 font-medium text-right">Volume Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {CANONICAL_METHODS.map((method) => {
                      const info = byMethod[method] || { count: 0, total: 0 };
                      const share = totalCollected > 0 ? ((info.total / totalCollected) * 100).toFixed(1) : '0.0';
                      const avg = info.count > 0 ? info.total / info.count : 0;
                      const MethodIcon = METHOD_ICONS[method] || CreditCard;

                      return (
                        <tr key={method} className="hover:bg-slate-800/30">
                          <td className="py-2.5 font-sans flex items-center gap-2 text-white font-medium">
                            <MethodIcon className="w-3.5 h-3.5 text-slate-400" />
                            {method}
                          </td>
                          <td className="py-2.5 text-center text-slate-300">{info.count}</td>
                          <td className="py-2.5 text-right font-bold text-white">{formatCurrency(info.total)}</td>
                          <td className="py-2.5 text-right text-slate-400">{formatCurrency(avg)}</td>
                          <td className="py-2.5 text-right text-slate-300">{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Complete Transaction Audit Log Preview */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Itemized Collection Log ({payments.length} entries)
                </h3>
              </div>
              <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Invoice / Ref</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">UTR / Ref</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">
                          {formatPaymentTime(p)}
                        </td>
                        <td className="py-2 px-3 text-white font-medium whitespace-nowrap">{p.customer?.name || 'Unknown'}</td>
                        <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">
                          {p.invoice?.invoiceNumber || (p.entryType ? 'Manual Entry' : '-')}
                        </td>
                        <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{p.paymentMethod}</td>
                        <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">{p.referenceNumber || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400">
              Printable sheet formatted for A4 & POS register sign-off.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Closeout Report
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Printable Closeout Document (strictly visible in @media print) */}
      <div className="hidden print:block invoice-print p-6 text-black bg-white w-full max-w-[210mm]">
          <div className="text-center pb-4 border-b-2 border-black">
            <h1 className="text-xl font-bold uppercase">{firmName}</h1>
            {firmGstin && <p className="text-xs">GSTIN: {firmGstin}</p>}
            {firmAddress && <p className="text-xs">{firmAddress}</p>}
            {firmPhone && <p className="text-xs">Phone: {firmPhone}</p>}
            <h2 className="text-sm font-bold uppercase tracking-wider mt-3 bg-gray-100 py-1 inline-block px-6 border border-black">
              Daily Cashier Closeout & Reconciliation Statement
            </h2>
            <p className="text-xs mt-1">
              <strong>Business Date:</strong> {dateLabel} · <strong>Generated:</strong> {generatedTimestamp}
            </p>
          </div>

          {/* Cashier Reconciliation Summary Box */}
          <div className="my-4 border border-black p-3 bg-gray-50 text-xs">
            <h3 className="font-bold uppercase text-xs border-b border-gray-400 pb-1 mb-2">
              1. Cashier Reconciliation Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-[11px] uppercase font-semibold">Recorded Cash Collections:</span>
                <p className="text-lg font-bold">{formatCurrency(cashCollected)}</p>
                <p className="text-[10px] text-gray-600">({cashCount} cash receipts · {cashShare}%)</p>
              </div>
              <div>
                <span className="text-[11px] uppercase font-semibold">Non-Cash Collections:</span>
                <p className="text-lg font-bold">{formatCurrency(nonCashCollected)}</p>
                <p className="text-[10px] text-gray-600">({nonCashCount} receipts · {nonCashShare}%)</p>
              </div>
              <div>
                <span className="text-[11px] uppercase font-semibold">Total Collections Accounted:</span>
                <p className="text-lg font-bold">{formatCurrency(totalCollected)}</p>
                <p className="text-[10px] text-gray-600">({paymentCount} total transactions)</p>
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown Table */}
          <div className="my-4">
            <h3 className="font-bold uppercase text-xs mb-1">2. Payment Method Audit Breakdown</h3>
            <table className="w-full text-xs border border-black border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-black">
                  <th className="p-1.5 text-left border-r border-black">Payment Channel</th>
                  <th className="p-1.5 text-center border-r border-black">Receipt Count</th>
                  <th className="p-1.5 text-right border-r border-black">Total Volume</th>
                  <th className="p-1.5 text-right border-r border-black">Average Ticket</th>
                  <th className="p-1.5 text-right">Volume Share</th>
                </tr>
              </thead>
              <tbody>
                {CANONICAL_METHODS.map((method) => {
                  const info = byMethod[method] || { count: 0, total: 0 };
                  const share = totalCollected > 0 ? ((info.total / totalCollected) * 100).toFixed(1) : '0.0';
                  const avg = info.count > 0 ? info.total / info.count : 0;
                  return (
                    <tr key={method} className="border-b border-gray-300">
                      <td className="p-1.5 font-medium border-r border-gray-300">{method}</td>
                      <td className="p-1.5 text-center border-r border-gray-300">{info.count}</td>
                      <td className="p-1.5 text-right font-bold border-r border-gray-300">{formatCurrency(info.total)}</td>
                      <td className="p-1.5 text-right border-r border-gray-300">{formatCurrency(avg)}</td>
                      <td className="p-1.5 text-right">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Complete Itemized Ledger */}
          <div className="my-4">
            <h3 className="font-bold uppercase text-xs mb-1">3. Detailed Collections Transaction Ledger</h3>
            <table className="w-full text-[11px] border border-black border-collapse print-table">
              <thead>
                <tr className="bg-gray-100 border-b border-black">
                  <th className="p-1 text-left border-r border-black">Time</th>
                  <th className="p-1 text-left border-r border-black">Customer Name</th>
                  <th className="p-1 text-left border-r border-black">Phone</th>
                  <th className="p-1 text-left border-r border-black">Invoice / Settlement</th>
                  <th className="p-1 text-left border-r border-black">Method</th>
                  <th className="p-1 text-left border-r border-black">UTR / Ref No</th>
                  <th className="p-1 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="p-1 border-r border-gray-200 whitespace-nowrap">
                      {formatPaymentTime(p)}
                    </td>
                    <td className="p-1 font-medium border-r border-gray-200">{p.customer?.name || 'Walk-in Customer'}</td>
                    <td className="p-1 border-r border-gray-200 font-mono">{p.customer?.phone || '—'}</td>
                    <td className="p-1 border-r border-gray-200 font-mono">{p.invoice?.invoiceNumber || (p.entryType ? 'Manual Entry' : 'Settlement')}</td>
                    <td className="p-1 border-r border-gray-200">{p.paymentMethod}</td>
                    <td className="p-1 border-r border-gray-200 font-mono">{p.referenceNumber || '—'}</td>
                    <td className="p-1 text-right font-bold font-mono">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t-2 border-black">
                  <td colSpan={6} className="p-1.5 text-right uppercase border-r border-black">
                    Grand Total Collections Accounted:
                  </td>
                  <td className="p-1.5 text-right font-mono font-extrabold text-xs">
                    {formatCurrency(totalCollected)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cashier & Store Manager Sign-off Blocks */}
          <div className="pt-10 mt-8 border-t-2 border-black grid grid-cols-2 gap-12 text-xs">
            <div>
              <p className="border-t border-black pt-1 font-bold">Cashier / Prepared By:</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Signature & Date</p>
              <p className="text-[11px] text-gray-600 mt-3">Physical Cash Count Handed Over: ₹_______________</p>
            </div>
            <div>
              <p className="border-t border-black pt-1 font-bold">Store Manager / Verified By:</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Signature & Date</p>
              <p className="text-[11px] text-gray-600 mt-3">Drawer Discrepancy (if any): ₹_______________</p>
            </div>
          </div>
        </div>
    </>,
    document.body
  );
}
