import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  ArrowRight,
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
  Clock,
  AlertCircle,
  Download,
  Loader2
} from 'lucide-react';
import { formatCurrency, formatDate, formatPaymentTime } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PrintDialog from '../../features/documentPrinting/components/PrintDialog';
import CloseoutDocument from '../../features/documentPrinting/renderers/CloseoutDocument';
import { resolveDocumentPrintFormat, DOCUMENT_TYPES } from '../../features/documentPrinting/formats/documentPrintFormats';

const CANONICAL_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'];

const METHOD_ICONS = {
  'Cash': Banknote,
  'UPI': Smartphone,
  'Bank Transfer': Building2,
  'Cheque': FileText,
  'NEFT/RTGS': Building2
};

const getISTDateStr = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
};

export default function DailyCloseoutPrintModal({
  isOpen,
  onClose,
  initialDate,
  isMultiDay = false,
  activeScopeLabel = '',
  initialSummary = null,
  initialPayments = [],
  onOpenExport
}) {
  const { admin } = useAuth();
  const todayStr = getISTDateStr(0);
  const yesterdayStr = getISTDateStr(1);

  // Strictly single-day target date state
  const [selectedDay, setSelectedDay] = useState(todayStr);
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // Sync state whenever modal opens or initialDate changes
  useEffect(() => {
    if (isOpen) {
      const target = initialDate || todayStr;
      setSelectedDay(target);
      setShowPrintDialog(false);
    }
  }, [isOpen, initialDate, todayStr]);

  // Fetch dedicated single-day collection data if selectedDay differs or arrived from multi-day
  useEffect(() => {
    if (!isOpen) return;

    // If viewing single day directly from CollectionsPage with existing data, reuse it
    if (!isMultiDay && selectedDay === initialDate && initialSummary) {
      setDayData({
        summary: initialSummary,
        payments: initialPayments
      });
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    api.get('/payments/collections', {
      params: { date: selectedDay, limit: 100 }
    })
      .then((res) => {
        if (!isMounted) return;
        setDayData({
          summary: res.data?.summary || null,
          payments: res.data?.payments || []
        });
      })
      .catch((err) => {
        console.error('Failed to load closeout data for', selectedDay, err);
        if (!isMounted) return;
        setDayData({ summary: null, payments: [] });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedDay, initialDate, isMultiDay, initialSummary, initialPayments]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const summary = dayData?.summary || null;
  const payments = dayData?.payments || [];

  const totalCollected = summary?.totalCollected || 0;
  const paymentCount = summary?.paymentCount || 0;
  const cashCollected = summary?.cashCollected || 0;
  const cashCount = summary?.cashCount || 0;
  const nonCashCollected = summary?.nonCashCollected || 0;
  const nonCashCount = summary?.nonCashCount || 0;
  const byMethod = summary?.byMethod || {};

  const cashShare = totalCollected > 0 ? ((cashCollected / totalCollected) * 100).toFixed(1) : '0.0';
  const nonCashShare = totalCollected > 0 ? ((nonCashCollected / totalCollected) * 100).toFixed(1) : '0.0';

  const configuredFormat = resolveDocumentPrintFormat(admin?.preferences, DOCUMENT_TYPES.DAILY_CLOSEOUT);

  const handlePrint = () => {
    setShowPrintDialog(true);
  };

  const closeoutDateLabel = selectedDay === todayStr 
    ? `Today (${formatDate(selectedDay)})` 
    : (selectedDay === yesterdayStr ? `Yesterday (${formatDate(selectedDay)})` : formatDate(selectedDay));

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
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto h-[88vh] max-h-[88vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 sm:hidden rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                title="Back to Collections"
                aria-label="Back to Collections"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-100">Daily Cashier Closeout & Reconciliation</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Business Date: <span className="text-slate-100 font-medium">{closeoutDateLabel}</span> · Strictly Single-Day Scope
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Multi-Day Warning Banner (when opened while viewing 7D, Month, or All Time) */}
          {isMultiDay && (
            <div className="mx-4 sm:mx-6 mt-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5 text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-200">Daily Closeout Strictly Reconciles a Single Day</p>
                  <p className="text-amber-400/80 mt-0.5">
                    Showing register reconciliation for <strong>{closeoutDateLabel}</strong>. For multi-day period analysis ({activeScopeLabel}), please use Collections Export.
                  </p>
                </div>
              </div>
              {onOpenExport && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenExport();
                  }}
                  className="btn btn-secondary text-xs px-3.5 py-1.5 shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-300" />
                  <span>Export {activeScopeLabel}</span>
                </button>
              )}
            </div>
          )}

          {/* Single-Day Selector & Scope Bar */}
          <div className="px-4 sm:px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Reconcile Day:</span>
              <div className="inline-flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectedDay(todayStr)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedDay === todayStr 
                      ? 'bg-blue-600 text-white font-semibold shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDay(yesterdayStr)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedDay === yesterdayStr 
                      ? 'bg-blue-600 text-white font-semibold shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Yesterday
                </button>
              </div>

              <div className="relative">
                <input
                  type="date"
                  value={selectedDay}
                  max={todayStr}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDay(e.target.value);
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  title="Choose specific single day"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {loading && (
                <span className="text-slate-400 text-xs inline-flex items-center gap-1 font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  Updating...
                </span>
              )}
              {onOpenExport && !isMultiDay && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenExport();
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                >
                  <span>Need multi-day report? Open Export</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
            {/* Executive KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
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
                <p className="text-2xl font-bold text-slate-100 font-mono">
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
                          <td className="py-2.5 font-sans flex items-center gap-2 text-slate-100 font-medium">
                            <MethodIcon className="w-3.5 h-3.5 text-slate-400" />
                            {method}
                          </td>
                          <td className="py-2.5 text-center text-slate-300">{info.count}</td>
                          <td className="py-2.5 text-right font-bold text-slate-100">{formatCurrency(info.total)}</td>
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
                  Itemized Collection Log ({payments.length} entries for {closeoutDateLabel})
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
                        <td className="py-2 px-3 text-slate-100 font-medium whitespace-nowrap">{p.customer?.name || 'Unknown'}</td>
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
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-slate-500 font-sans">
                          No collection transactions recorded for this business day.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Printable sheet strictly formatted for A4 single-day cashier sign-off.
            </span>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                Print {closeoutDateLabel} Closeout
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <PrintDialog
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        documentType={DOCUMENT_TYPES.DAILY_CLOSEOUT}
        title={`Print Cashier Closeout: ${closeoutDateLabel}`}
        initialFormat={configuredFormat}
        renderDocument={(activeFormat) => (
          <CloseoutDocument
            summary={summary}
            payments={payments}
            selectedDay={selectedDay}
            closeoutDateLabel={closeoutDateLabel}
            generatedTimestamp={generatedTimestamp}
            format={activeFormat}
            admin={admin}
          />
        )}
      />
    </>,
    document.body
  );
}
