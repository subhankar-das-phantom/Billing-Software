import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  X
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useMotionConfig } from '../hooks';

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
  'UPI': 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  'Bank Transfer': 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  'Cheque': 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'NEFT/RTGS': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400'
};

// Format time from date
const formatTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Get today's date as YYYY-MM-DD
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CollectionsPage() {
  const motionConfig = useMotionConfig();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ summary: null, payments: [], total: 0, pages: 1 });
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedMethod, setSelectedMethod] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadCollections();
  }, [selectedDate, selectedMethod, page]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate, page, limit: 50 };
      if (selectedMethod) params.paymentMethod = selectedMethod;
      const res = await api.get('/payments/collections', { params });
      setData(res.data);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const isToday = selectedDate === getTodayStr();
  const dateLabel = isToday ? 'Today' : formatDate(selectedDate);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: motionConfig.shouldAnimate ? 0.08 : 0 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: motionConfig.isMobile ? 'tween' : 'spring',
        duration: motionConfig.isMobile ? 0.18 : undefined,
        stiffness: motionConfig.isMobile ? undefined : 300,
        damping: motionConfig.isMobile ? undefined : 24
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            Collections
          </h1>
          <p className="text-slate-400 text-sm mt-1">Daily cash flow and payment tracking</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="w-4 h-4" />
          Showing: <span className="text-white font-medium">{dateLabel}</span>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <motion.div
          className="glass-card p-5 relative overflow-hidden group"
          whileHover={motionConfig.shouldHover ? { scale: 1.02, y: -2 } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-400">
              {loading ? '...' : formatCurrency(data.summary?.totalCollected || 0)}
            </p>
            <p className="text-sm text-slate-400 mt-1">Total Collected</p>
          </div>
        </motion.div>

        {/* Payment Count */}
        <motion.div
          className="glass-card p-5 relative overflow-hidden group"
          whileHover={motionConfig.shouldHover ? { scale: 1.02, y: -2 } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20">
                <Hash className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-400">
              {loading ? '...' : data.summary?.paymentCount || 0}
            </p>
            <p className="text-sm text-slate-400 mt-1">Payments Received</p>
          </div>
        </motion.div>

        {/* Method Breakdown Cards — show top 2 methods */}
        {!loading && data.summary?.byMethod && Object.entries(data.summary.byMethod)
          .sort(([,a], [,b]) => b.total - a.total)
          .slice(0, 2)
          .map(([method, info]) => {
            const MethodIcon = METHOD_ICONS[method] || CreditCard;
            const colorClass = METHOD_COLORS[method] || 'from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-400';
            return (
              <motion.div
                key={method}
                className={`glass-card p-5 relative overflow-hidden group`}
                whileHover={motionConfig.shouldHover ? { scale: 1.02, y: -2 } : undefined}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${colorClass.split(' ').slice(0, 2).join(' ')} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorClass.split(' ').slice(0, 2).join(' ')}`}>
                      <MethodIcon className={`w-5 h-5 ${colorClass.split(' ').pop()}`} />
                    </div>
                    <span className="text-xs text-slate-500">{info.count} txns</span>
                  </div>
                  <p className={`text-2xl font-bold ${colorClass.split(' ').pop()}`}>
                    {formatCurrency(info.total)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">{method}</p>
                </div>
              </motion.div>
            );
          })
        }

        {/* If no payments, show placeholder cards */}
        {!loading && (!data.summary?.byMethod || Object.keys(data.summary.byMethod).length === 0) && (
          <>
            <div className="glass-card p-5">
              <div className="p-2.5 rounded-xl bg-slate-700/50 w-fit mb-3">
                <Wallet className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-slate-500">₹0</p>
              <p className="text-sm text-slate-500 mt-1">Cash</p>
            </div>
            <div className="glass-card p-5">
              <div className="p-2.5 rounded-xl bg-slate-700/50 w-fit mb-3">
                <Smartphone className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-slate-500">₹0</p>
              <p className="text-sm text-slate-500 mt-1">UPI</p>
            </div>
          </>
        )}
      </motion.div>

      {/* All Method Breakdown (if more than 2 methods) */}
      {!loading && data.summary?.byMethod && Object.keys(data.summary.byMethod).length > 2 && (
        <motion.div variants={itemVariants} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Payment Method Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(data.summary.byMethod).map(([method, info]) => {
              const MethodIcon = METHOD_ICONS[method] || CreditCard;
              const colorClass = METHOD_COLORS[method] || 'from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-400';
              return (
                <div key={method} className={`p-3 rounded-xl border bg-gradient-to-br ${colorClass}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <MethodIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">{method}</span>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(info.total)}</p>
                  <p className="text-xs opacity-70">{info.count} payments</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={itemVariants} className="glass-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
          </div>

          {/* Date Picker */}
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
      </motion.div>

      {/* Payments Table */}
      <motion.div variants={itemVariants} className="glass-card overflow-hidden">
        <div className="p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            Payment Details
            {!loading && <span className="text-sm font-normal text-slate-400 ml-2">({data.total} total)</span>}
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-slate-400">Loading collections...</p>
          </div>
        ) : data.payments.length === 0 ? (
          <div className="text-center py-16">
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <Banknote className="w-8 h-8 text-slate-400" />
            </motion.div>
            <p className="text-slate-400">No payments found for {dateLabel}</p>
            <p className="text-sm text-slate-500 mt-1">Try selecting a different date</p>
          </div>
        ) : (
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
                {data.payments.map((payment, index) => {
                  const MethodIcon = METHOD_ICONS[payment.paymentMethod] || CreditCard;
                  const methodColor = METHOD_COLORS[payment.paymentMethod] || '';
                  return (
                    <motion.tr
                      key={payment._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: motionConfig.shouldAnimate ? Math.min(index * 0.02, 0.15) : 0 }}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatTime(payment.paymentDate)}
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
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
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
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                          methodColor ? methodColor.split(' ').slice(2).join(' ') : 'border-slate-600 text-slate-300'
                        } bg-gradient-to-r ${methodColor ? methodColor.split(' ').slice(0, 2).join(' ') : 'from-slate-700/50 to-slate-800/50'}`}>
                          <MethodIcon className="w-3 h-3" />
                          {payment.paymentMethod}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
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
      </motion.div>
    </motion.div>
  );
}
