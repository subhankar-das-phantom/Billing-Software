import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Calendar,
  User,
  Package,
  DollarSign,
  CreditCard,
  Printer,
  XCircle,
  Eye,
  Search,
  Filter,
  Download,
  TrendingUp,
  Clock,
  Loader2
} from 'lucide-react';
import { invoiceService } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import ExportModal from '../components/Common/ExportModal';
import { useToast } from '../context/ToastContext';
import { invalidateCachePattern, useMotionConfig, useSWR } from '../hooks';
import RefreshIndicator from '../components/Common/RefreshIndicator';

// Factory functions for adaptive variants
const createPageVariants = (isMobile, shouldStagger) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: shouldStagger ? 0.1 : 0,
      delayChildren: isMobile ? 0 : 0.1
    }
  }
});

const createCardVariants = (isMobile) => ({
  hidden: { opacity: 0, y: isMobile ? 15 : 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: isMobile 
      ? { type: 'tween', duration: 0.25, ease: 'easeOut' }
      : { type: 'spring', stiffness: 300, damping: 24 }
  }
});

const createTableRowVariants = (isMobile, shouldStagger) => ({
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: shouldStagger ? i * 0.03 : 0,
      type: isMobile ? 'tween' : 'spring',
      duration: isMobile ? 0.2 : undefined,
      stiffness: isMobile ? undefined : 300,
      damping: isMobile ? undefined : 24
    }
  })
});

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accumulatedInvoices, setAccumulatedInvoices] = useState([]);
  const observer = useRef(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState({});
  const { success, error } = useToast();
  
  // Adaptive motion configuration
  const motionConfig = useMotionConfig();
  const pageVariants = useMemo(() => createPageVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);
  const cardVariants = useMemo(() => createCardVariants(motionConfig.isMobile), [motionConfig.isMobile]);
  const tableRowVariants = useMemo(() => createTableRowVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);

  // SWR: Invoice list (server-side filters + infinite scroll)
  const { data, isLoading, isValidating } = useSWR(
    `invoices-page-${search}-${statusFilter}-${startDate}-${endDate}-${page}`,
    () => {
      const params = {
        page,
        limit: 20,
        prefix: true,
        fuzzy: true
      };

      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      return invoiceService.getInvoices(params);
    },
    { ttl: 5 * 60 * 1000 } // 5 minute cache
  );

  // SWR: Global invoice stats for cards (not affected by search/filter)
  const { data: invoiceStatsData } = useSWR(
    'invoices-stats',
    () => invoiceService.getInvoiceStats(),
    { ttl: 5 * 60 * 1000 }
  );

  const invoices = accumulatedInvoices;
  const totalMatched = data?.total || 0;
  const hasMore = data?.hasMore ?? (data?.pages ? page < data.pages : false);

  // Debounced search to avoid API spam
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset infinite list when filters/search change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    setAccumulatedInvoices([]);
  }, [search, statusFilter, startDate, endDate]);

  // Accumulate invoices as pages arrive
  useEffect(() => {
    if (!data?.invoices) return;

    if (page === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccumulatedInvoices(data.invoices);
      return;
    }

    setAccumulatedInvoices(prev => {
      const existingIds = new Set(prev.map(inv => inv._id));
      const newInvoices = data.invoices.filter(inv => !existingIds.has(inv._id));
      return [...prev, ...newInvoices];
    });
  }, [data, page]);

  // Infinite Scroll Observer
  const lastElementRef = useCallback((node) => {
    if (isValidating) return;
    if (observer.current) observer.current.disconnect();

    if (node) {
      observer.current = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && !isValidating && hasMore) {
            setPage(prev => prev + 1);
          }
        },
        { threshold: 0.1 }
      );
      observer.current.observe(node);
    }
  }, [isValidating, hasMore]);

  const stats = {
    total: invoiceStatsData?.stats?.totalInvoices || 0,
    today: invoiceStatsData?.stats?.todayInvoices || 0,
    thisMonth: invoiceStatsData?.stats?.thisMonthInvoices || 0
  };

  const handleExport = async ({ format, dateRange }) => {
    try {
      let dataToExport = invoices;
      const parseDateBoundary = (dateStr, endOfDay = false) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
        const [year, month, day] = parts;
        return endOfDay
          ? new Date(year, month - 1, day, 23, 59, 59, 999)
          : new Date(year, month - 1, day, 0, 0, 0, 0);
      };

      // Filter by date range if specified
      if (dateRange.startDate && dateRange.endDate) {
        const start = parseDateBoundary(dateRange.startDate, false);
        const end = parseDateBoundary(dateRange.endDate, true);

        if (start && end) {
          dataToExport = dataToExport.filter(invoice => {
            const invoiceDate = new Date(invoice.invoiceDate);
            return invoiceDate >= start && invoiceDate <= end;
          });
        }
      }

      if (dataToExport.length === 0) {
        error('No invoices found for the selected date range');
        return;
      }

      // Call export service (returns blob)
      const blob = await invoiceService.exportInvoices({ 
        format,
        invoices: dataToExport.map(inv => inv._id),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Map format to proper file extension
      const extensionMap = { excel: 'xlsx', pdf: 'pdf', csv: 'csv' };
      const extension = extensionMap[format] || 'xlsx';
      
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      link.download = `invoices_export_${y}-${m}-${d}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      success(`Successfully exported ${dataToExport.length} invoices as ${format.toUpperCase()}`);
    } catch (err) {
      error(err.response?.data?.message || 'Failed to export invoices');
    }
  };

  // Calculate export stats
  const exportStats = {
    total: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.totals?.netTotal || 0), 0),
    cash: invoices.filter(inv => inv.paymentType === 'Cash').length,
    credit: invoices.filter(inv => inv.paymentType === 'Credit').length
  };


  const statusConfig = {
    Created: { icon: FileText, class: 'badge-info', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    Printed: { icon: Printer, class: 'badge-success', color: 'text-green-400', bg: 'bg-green-500/20' },
    Cancelled: { icon: XCircle, class: 'badge-danger', color: 'text-red-400', bg: 'bg-red-500/20' }
  };

  const paymentConfig = {
    Cash: { icon: DollarSign, class: 'badge-success', color: 'text-green-400' },
    Credit: { icon: CreditCard, class: 'badge-info', color: 'text-blue-400' }
  };

  const handlePrintedToggle = async (invoiceId, checked) => {
    setStatusUpdating(prev => ({ ...prev, [invoiceId]: true }));
    const nextStatus = checked ? 'Printed' : 'Created';

    try {
      await invoiceService.updateStatus(invoiceId, nextStatus);

      setAccumulatedInvoices(prev => prev.filter(inv => {
        if (inv._id !== invoiceId) return true;
        if (statusFilter === 'all') return true;
        return nextStatus === statusFilter;
      }).map(inv => (
        inv._id === invoiceId ? { ...inv, status: nextStatus } : inv
      )));

      invalidateCachePattern('invoices');
      success(`Invoice marked as ${nextStatus.toLowerCase()}`);
    } catch (err) {
      console.error('Failed to update invoice status:', err);
      error('Failed to update print status');
    } finally {
      setStatusUpdating(prev => ({ ...prev, [invoiceId]: false }));
    }
  };

  // Only show full page loader on first load with no cached data
  if (isLoading && invoices.length === 0 && page === 1) {
    return <PageLoader />;
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { 
            label: 'Total Invoices', 
            value: stats.total, 
            icon: FileText,
            color: 'from-blue-500 to-blue-600',
            iconColor: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
          },
          { 
            label: "Today's Invoices", 
            value: stats.today, 
            icon: Clock,
            color: 'from-emerald-500 to-emerald-600',
            iconColor: 'text-emerald-400',
            bgColor: 'bg-emerald-500/20'
          },
          { 
            label: 'This Month', 
            value: stats.thisMonth, 
            icon: TrendingUp,
            color: 'from-purple-500 to-purple-600',
            iconColor: 'text-purple-400',
            bgColor: 'bg-purple-500/20'
          }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            variants={cardVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            className="glass-card p-6 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <motion.p 
                  className="text-3xl font-bold text-white"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.1, type: 'spring', stiffness: 200 }}
                >
                  {stat.value}
                </motion.p>
              </div>
              <motion.div
                className={`p-3 rounded-xl ${stat.bgColor}`}
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
              >
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Header with Filters */}
      <motion.div variants={cardVariants} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-blue-500/20 rounded-lg"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <FileText className="w-5 h-5 text-blue-400" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">All Invoices</h2>
                <RefreshIndicator isRefreshing={isValidating} size="sm" />
              </div>
              <p className="text-sm text-slate-400 mt-1">
                  Showing {invoices.length} of {totalMatched || invoices.length} invoices
                </p>
              </div>
          </div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/invoices/create" className="btn btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Invoice
            </Link>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search invoice # or customer..."
              className="input pl-10 w-full"
            />
            <AnimatePresence>
              {searchInput && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  whileHover={{ rotate: 90 }}
                >
                  <XCircle className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select pl-10 w-full"
            >
              <option value="all">All Status</option>
              <option value="Created">Created</option>
              <option value="Printed">Printed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date From */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Date To */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Export Button */}
          <motion.button
            onClick={() => setShowExportModal(true)}
            className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold flex items-center justify-center gap-2 px-6 py-3 shadow-lg shadow-emerald-500/30 border-0"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download className="w-5 h-5" />
            Export
          </motion.button>
        </div>
      </motion.div>

      {/* Invoices Table */}
      <AnimatePresence mode="wait">
        {invoices.length === 0 ? (
          <motion.div
            key={`empty-${statusFilter}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="glass-card p-12 text-center"
          >
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            >
              <FileText className="w-10 h-10 text-slate-400" />
            </motion.div>
            <motion.p
              className="text-slate-400 mb-6 text-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {search || searchInput || startDate || endDate
                ? 'No invoices found matching your search' 
                : statusFilter !== 'all' 
                  ? `No ${statusFilter} invoices found`
                  : 'No invoices found. Create your first invoice!'}
            </motion.p>
            {!search && !searchInput && !startDate && !endDate && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Link to="/invoices/create" className="btn btn-primary inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Invoice
                </Link>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`table-${statusFilter}-${search}-${startDate}-${endDate}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="glass-card overflow-x-auto"
          >
            <table className="table min-w-[800px]">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th className="text-center w-20">Printed</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                    {invoices.map((invoice, index) => {
                      const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                      const PaymentIcon = paymentConfig[invoice.paymentType]?.icon || CreditCard;

                      const isCancelled = invoice.status === 'Cancelled';

                      return (
                        <tr
                          key={invoice._id}
                          className={`transition-colors ${isCancelled ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-slate-700/50'}`}
                        >
                          <td className={`font-medium ${isCancelled ? 'text-red-400' : 'text-white'}`}>
                            <div className="flex items-center gap-2">
                              <FileText className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-blue-400'}`} />
                              {invoice.invoiceNumber}
                            </div>
                          </td>
                          <td className={isCancelled ? 'text-red-400' : 'text-slate-300'}>
                            <div className="flex items-center gap-2">
                              <Calendar className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                              {formatDate(invoice.invoiceDate)}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg ${isCancelled ? 'bg-red-500/20 text-red-400 shadow-red-500/20' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'}`}
                              >
                                {invoice.customer?.customerName?.charAt(0)}
                              </div>
                              <div>
                                <p className={`font-medium ${isCancelled ? 'text-red-400' : 'text-white'}`}>{invoice.customer?.customerName}</p>
                                <p className={`text-xs flex items-center gap-1 ${isCancelled ? 'text-red-400 opacity-80' : 'text-slate-400'}`}>
                                  <User className="w-3 h-3" />
                                  {invoice.customer?.phone}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className={isCancelled ? 'text-red-400' : 'text-slate-300'}>
                            <div className="flex items-center gap-2">
                              <Package className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                              {invoice.items?.length || 0} items
                            </div>
                          </td>
                          <td className={`font-medium ${isCancelled ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                            {formatCurrency(invoice.totals?.netTotal)}
                          </td>
                          <td>
                            <span
                              className={`badge ${paymentConfig[invoice.paymentType]?.class || 'badge-info'} inline-flex items-center gap-1.5`}
                            >
                              <PaymentIcon className="w-3 h-3" />
                              {invoice.paymentType}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${statusConfig[invoice.status]?.class || 'badge-info'} inline-flex items-center gap-1.5`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {invoice.status}
                            </span>
                          </td>
                          <td className="text-center">
                            <label className={`inline-flex items-center justify-center ${isCancelled || statusUpdating[invoice._id] ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                aria-label={`Mark invoice ${invoice.invoiceNumber} as printed`}
                                className="sr-only"
                                checked={invoice.status === 'Printed'}
                                disabled={isCancelled || statusUpdating[invoice._id]}
                                onChange={(e) => handlePrintedToggle(invoice._id, e.target.checked)}
                              />
                              <div className={`relative w-10 h-5 rounded-full transition-colors shadow-inner ${invoice.status === 'Printed' ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${invoice.status === 'Printed' ? 'translate-x-5' : 'translate-x-0'}`} />
                              </div>
                            </label>
                          </td>
                          <td>
                            <Link
                              to={`/invoices/${invoice._id}`}
                              className="btn btn-secondary py-1.5 px-3 text-sm inline-flex items-center gap-2 group"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
            </table>

            {/* Infinite Scroll Loader */}
            {(hasMore || isValidating) && (
              <div ref={lastElementRef} className="p-4 border-t border-slate-700 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span className="text-sm">Loading more invoices...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          data={invoices}
          stats={exportStats}
          onExport={handleExport}
          entityType="Invoices"
      />
    </motion.div>
  );
}
