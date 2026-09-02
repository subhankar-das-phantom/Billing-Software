import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Banknote,
  CreditCard,
  Hash,
  Calendar,
  User,
  FileText,
  Filter,
  TrendingUp,
  Wallet,
  Smartphone,
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Plus,
  PieChart
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useSWR, useMediaQuery, invalidateCachePattern } from '../../hooks';
import { CollectionsTableSkeleton } from './CollectionsPageSkeleton';
import RecordPaymentModal from '../../components/Common/Modals/RecordPaymentModal';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'];

const METHOD_ICONS = {
  'Cash': Banknote,
  'UPI': Smartphone,
  'Bank Transfer': Building2,
  'Cheque': FileText,
  'NEFT/RTGS': Building2
};

const METHOD_COLORS = {
  'Cash': 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'UPI': 'from-accent-500/20 to-accent-600/10 border-accent-500/30 text-accent-400',
  'Bank Transfer': 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  'Cheque': 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'NEFT/RTGS': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400'
};

const METHOD_BAR_COLORS = {
  'Cash': 'bg-emerald-500',
  'UPI': 'bg-accent-500',
  'Bank Transfer': 'bg-blue-500',
  'Cheque': 'bg-amber-500',
  'NEFT/RTGS': 'bg-cyan-500'
};

// For date-only strings (e.g. "2026-04-09"), JS parses as UTC midnight,
// which appears as 05:30 AM in IST. In that case, prefer createdAt for display time.
const hasExplicitTime = (dateValue) => {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getUTCHours() !== 0 ||
    d.getUTCMinutes() !== 0 ||
    d.getUTCSeconds() !== 0 ||
    d.getUTCMilliseconds() !== 0
  );
};

const formatTime = (payment) => {
  if (!payment) return '-';

  const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
  const createdAt = payment.createdAt ? new Date(payment.createdAt) : null;

  const sourceDate = hasExplicitTime(payment.paymentDate)
    ? paymentDate
    : (createdAt || paymentDate);

  if (!sourceDate || Number.isNaN(sourceDate.getTime())) return '-';

  return sourceDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Get today's date as YYYY-MM-DD
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CollectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedMethod, setSelectedMethod] = useState('');
  const [page, setPage] = useState(1);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const { data: swrData, isLoading, revalidate } = useSWR(
    `collections-${selectedDate}-${selectedMethod}-${page}`,
    async () => {
      const params = { date: selectedDate, page, limit: 50 };
      if (selectedMethod) params.paymentMethod = selectedMethod;
      const res = await api.get('/payments/collections', { params });
      return res.data;
    },
    { ttl: 5 * 60 * 1000 }
  );

  // Auto-open payment modal when arriving with ?action=record
  useEffect(() => {
    if (searchParams.get('action') === 'record') {
      setShowRecordModal(true);
      // Cleanly remove action from searchParams to avoid reopening on re-renders
      setSearchParams(prev => {
        const updated = new URLSearchParams(prev);
        updated.delete('action');
        return updated;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handlePaymentRecorded = () => {
    setShowRecordModal(false);
    invalidateCachePattern('collections');
    revalidate();
  };

  const data = swrData || { summary: null, payments: [], total: 0, pages: 1 };
  const loading = isLoading && !swrData;

  const isToday = selectedDate === getTodayStr();
  const dateLabel = isToday ? 'Today' : formatDate(selectedDate);

  const totalCollected = data.summary?.totalCollected || 0;
  const paymentCount = data.summary?.paymentCount || 0;
  const averageTicketSize = paymentCount > 0 ? totalCollected / paymentCount : 0;

  const topMethod = useMemo(() => {
    if (!data.summary?.byMethod || Object.keys(data.summary.byMethod).length === 0) return null;
    const sorted = Object.entries(data.summary.byMethod).sort(([, a], [, b]) => b.total - a.total);
    if (!sorted[0] || sorted[0][1].total <= 0) return null;
    const [method, info] = sorted[0];
    const share = totalCollected > 0 ? ((info.total / totalCollected) * 100).toFixed(1) : '0.0';
    return { method, total: info.total, count: info.count, share };
  }, [data.summary?.byMethod, totalCollected]);

  const methodDistribution = useMemo(() => {
    if (!data.summary?.byMethod) return [];
    return Object.entries(data.summary.byMethod)
      .map(([method, info]) => {
        const share = totalCollected > 0 ? (info.total / totalCollected) * 100 : 0;
        return {
          method,
          total: info.total,
          count: info.count,
          share: parseFloat(share.toFixed(1)),
          icon: METHOD_ICONS[method] || CreditCard,
          colorClass: METHOD_COLORS[method] || 'from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-400'
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [data.summary?.byMethod, totalCollected]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            Collections
          </h1>
          <p className="text-slate-400 text-sm mt-1">Daily cash flow and payment tracking</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Showing: <span className="text-white font-medium">{dateLabel}</span>
          </div>

          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 font-medium text-sm transition-all hover:scale-[1.02] active:scale-95"
            id="record-payment-header-btn"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-400">
              {loading ? '...' : formatCurrency(totalCollected)}
            </p>
            <p className="text-sm text-slate-400 mt-1">Total Collected</p>
          </div>
        </div>

        {/* Payments Received */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20">
                <Hash className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-400">
              {loading ? '...' : paymentCount}
            </p>
            <p className="text-sm text-slate-400 mt-1">Payments Received</p>
          </div>
        </div>

        {/* Average Payment Size */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20">
                <Wallet className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-400">
              {loading ? '...' : formatCurrency(averageTicketSize)}
            </p>
            <p className="text-sm text-slate-400 mt-1">Average Payment Size</p>
          </div>
        </div>

        {/* Top Payment Method */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-teal-500/20">
                <CreditCard className="w-5 h-5 text-teal-400" />
              </div>
              {topMethod && (
                <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-semibold">
                  {topMethod.share}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white truncate">
              {loading ? '...' : topMethod ? topMethod.method : 'None'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {topMethod ? `${formatCurrency(topMethod.total)} collected` : 'No collections'}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Payment Method Distribution & Breakdown */}
      {!loading && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                Payment Method Analytics
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Channel-wise distribution and volume share for {dateLabel}
              </p>
            </div>
            {topMethod && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium self-start sm:self-auto">
                Leading Channel: <strong>{topMethod.method}</strong> ({topMethod.share}%)
              </span>
            )}
          </div>

          {/* Visual Share Bar */}
          {totalCollected > 0 && methodDistribution.length > 0 ? (
            <div className="space-y-3">
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                {methodDistribution.map((item) => (
                  <div
                    key={item.method}
                    style={{ width: `${item.share}%` }}
                    className={`${METHOD_BAR_COLORS[item.method] || 'bg-slate-500'} h-full transition-all duration-500`}
                    title={`${item.method}: ${formatCurrency(item.total)} (${item.share}%)`}
                  />
                ))}
              </div>

              {/* Method Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                {methodDistribution.map((item) => {
                  const MethodIcon = item.icon;
                  return (
                    <div
                      key={item.method}
                      className={`p-3 rounded-xl border bg-gradient-to-br ${item.colorClass} transition-transform hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <MethodIcon className="w-4 h-4" />
                          <span className="text-xs font-semibold text-white">{item.method}</span>
                        </div>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/30">
                          {item.share}%
                        </span>
                      </div>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(item.total)}
                      </p>
                      <p className="text-[11px] opacity-75 mt-0.5">
                        {item.count} {item.count === 1 ? 'payment' : 'payments'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-5 px-5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <p className="text-sm font-medium text-white">No collections recorded for {dateLabel}</p>
                <p className="text-xs text-slate-400 mt-0.5">Start logging customer cash receipts, UPI, or bank transfers</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Payment
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filters Bar */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              id="collections-date-filter"
            />
            {!isToday && (
              <button
                onClick={() => { setSelectedDate(getTodayStr()); setPage(1); }}
                className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
              >
                Today
              </button>
            )}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <select
              value={selectedMethod}
              onChange={(e) => { setSelectedMethod(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              id="collections-method-filter"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {selectedMethod && (
              <button
                onClick={() => { setSelectedMethod(''); setPage(1); }}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Details Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            Payment Details
            {!loading && <span className="text-sm font-normal text-slate-400 ml-2">({data.total} total)</span>}
          </h2>
        </div>

        {loading ? (
          <CollectionsTableSkeleton />
        ) : data.payments.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4"
            >
              <Banknote className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-400">No payments found for {dateLabel}</p>
            <p className="text-sm text-slate-500 mt-1">Try selecting a different date or record a new payment</p>
            <button
              onClick={() => setShowRecordModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Record First Payment
            </button>
          </div>
        ) : isDesktop ? (
          <div className="table-container">
            <table className="table" id="collections-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => {
                  const MethodIcon = METHOD_ICONS[payment.paymentMethod] || CreditCard;
                  const methodColor = METHOD_COLORS[payment.paymentMethod] || '';
                  return (
                    <tr
                      key={payment._id}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatTime(payment)}
                        </div>
                      </td>
                      <td className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          {payment.customer?.customerName || 'Unknown'}
                        </div>
                      </td>
                      <td>
                        {payment.invoice ? (
                          <Link
                            to={`/invoices/${payment.invoice._id}`}
                            className="text-blue-400 hover:text-blue-300 hover:underline transition-colors flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {payment.invoice.invoiceNumber || payment.invoiceSnapshot?.invoiceNumber || '-'}
                          </Link>
                        ) : payment.isManualEntry ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent-500/20 text-accent-400 border border-accent-500/30">
                            Manual Entry
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="text-emerald-400 font-semibold">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border bg-gradient-to-br ${methodColor}`}>
                            <MethodIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm text-slate-300">
                            {payment.paymentMethod}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {data.payments.map((payment) => {
              const MethodIcon = METHOD_ICONS[payment.paymentMethod] || CreditCard;
              const methodColor = METHOD_COLORS[payment.paymentMethod] || '';
              return (
                <div key={payment._id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span className="font-medium text-white">
                        {payment.customer?.customerName || 'Unknown'}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold text-lg">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {formatTime(payment)}
                    </div>
                    {payment.invoice ? (
                      <Link
                        to={`/invoices/${payment.invoice._id}`}
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {payment.invoice.invoiceNumber || payment.invoiceSnapshot?.invoiceNumber || '-'}
                      </Link>
                    ) : payment.isManualEntry ? (
                      <span className="text-accent-400">Manual Entry</span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <div className={`p-1 rounded border bg-gradient-to-br ${methodColor}`}>
                      <MethodIcon className="w-3 h-3" />
                    </div>
                    <span className="text-xs text-slate-300">
                      {payment.paymentMethod}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="p-4 border-t border-slate-700 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Page {data.page} of {data.pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSuccess={handlePaymentRecorded}
      />
    </div>
  );
}
