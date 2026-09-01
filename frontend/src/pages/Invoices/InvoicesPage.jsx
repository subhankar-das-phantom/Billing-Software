import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { invoiceService } from '../../services/invoices/invoiceService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { InvoicesTableSkeleton } from './InvoicesPageSkeleton';
import ExportModal from '../../components/Common/Modals/ExportModal';
import { useToast } from '../../contexts/ToastContext';
import { invalidateCachePattern, useDebounce, useFirstVisit, useMediaQuery, useMotionConfig, useSWR } from '../../hooks';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import { VirtualizedList } from '../../components/Common/VirtualizedList';

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
  const [search] = useDebounce(searchInput);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accumulatedInvoices, setAccumulatedInvoices] = useState([]);
  const observer = useRef(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState({});
  const { success, error } = useToast();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Adaptive motion configuration
  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('invoices');
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

  // Use accumulatedInvoices once populated (after first useEffect run).
  // Fall back to data.invoices only on the very first render before useEffect seeds the list.
  const invoices = accumulatedInvoices.length > 0 ? accumulatedInvoices : (data?.invoices || []);
  const totalMatched = data?.total || 0;
  const hasMore = data?.hasMore ?? (data?.pages ? page < data.pages : false);

  // Reset page when filters/search change.
  // We intentionally do NOT clear accumulatedInvoices here — clearing it
  // causes invoices.length===0 which flashes the PageLoader even when
  // SWR has cached data. Instead, the accumulation effect below replaces
  // the list when page===1 data arrives.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
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
      const scrollParent = node.closest('main') || null;
      observer.current = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && !isValidating && hasMore) {
            setPage(prev => prev + 1);
          }
        },
        { root: scrollParent, threshold: 0.1 }
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
    if (isExporting) return;
    setIsExporting(true);

    try {
      const params = { format };
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;

      // Call export service (returns blob)
      const blob = await invoiceService.exportInvoices(params);

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

      setShowExportModal(false);
      success(`Successfully exported invoices as ${format.toUpperCase()}`);
    } catch (err) {
      error(err.message || 'Failed to export invoices');
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate export stats — exclude cancelled invoices from financial figures
  const activeForExport = invoices.filter(inv => inv.status !== 'Cancelled');
  const exportStats = {
    total: invoices.length,
    totalAmount: activeForExport.reduce((sum, inv) => sum + (inv.totals?.netTotal || 0), 0),
    cash: activeForExport.filter(inv => inv.paymentType === 'Cash').length,
    credit: activeForExport.filter(inv => inv.paymentType === 'Credit').length,
    cancelled: invoices.length - activeForExport.length
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

  // Only show full page loader on the very first load ever (no cached data at all).
  // On revisits SWR serves cached data, so invoices.length > 0 and we skip this.
  const showTableSkeleton = isLoading && invoices.length === 0 && page === 1;

  return (
    <motion.div
      variants={pageVariants}
      initial={isFirstVisit ? "hidden" : false}
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
            color: 'from-accent-500 to-accent-600',
            iconColor: 'text-accent-400',
            bgColor: 'bg-accent-500/20'
          }
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="glass-card p-6 cursor-pointer group transition-transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-white">
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor} transition-transform group-hover:rotate-[360deg] group-hover:scale-110 duration-700`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header with Filters */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg transition-transform hover:rotate-[360deg] duration-700">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
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

          <div>
            <Link to="/invoices/create" className="btn btn-primary flex items-center gap-2 active:scale-95 transition-transform">
              <Plus className="w-5 h-5" />
              New Invoice
            </Link>
          </div>
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
          <button
            onClick={() => setShowExportModal(true)}
            className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold flex items-center justify-center gap-2 px-6 py-3 shadow-lg shadow-emerald-500/30 border-0 active:scale-95 transition-transform"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <AnimatePresence mode="wait">
        {showTableSkeleton ? (
          <div key="skeleton">
            <InvoicesTableSkeleton />
          </div>
        ) : invoices.length === 0 ? (
          <div
            key={`empty-${statusFilter}`}
            className="glass-card p-12 text-center"
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6"
            >
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            <p
              className="text-slate-400 mb-6 text-lg"
            >
              {search || searchInput || startDate || endDate
                ? 'No invoices found matching your search'
                : statusFilter !== 'all'
                  ? `No ${statusFilter} invoices found`
                  : 'No invoices found. Create your first invoice!'}
            </p>
            {!search && !searchInput && !startDate && !endDate && (
              <div>
                <Link to="/invoices/create" className="btn btn-primary inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Invoice
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            {isDesktop ? (
            <div className="glass-card overflow-x-auto min-w-[800px]">
              {/* Header Row */}
              <div className="grid grid-cols-[120px_125px_minmax(210px,1.5fr)_100px_120px_115px_120px_90px_100px] items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 bg-slate-800/50">
                <div>Invoice #</div>
                <div>Date</div>
                <div>Customer</div>
                <div>Items</div>
                <div>Amount</div>
                <div>Payment</div>
                <div>Status</div>
                <div className="text-center">Printed</div>
                <div>Action</div>
              </div>
              {/* Data Rows */}
              <div>
                      <VirtualizedList
                        items={invoices}
                        estimateSize={() => 76}
                        getKey={(invoice) => invoice._id}
                        className="min-h-[76px]"
                        itemClassName="border-b border-slate-700/50"
                        renderItem={(invoice) => {
                          const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                          const PaymentIcon = paymentConfig[invoice.paymentType]?.icon || CreditCard;
                          const isCancelled = invoice.status === 'Cancelled';

                          return (
                            <div className={`grid grid-cols-[120px_125px_minmax(210px,1.5fr)_100px_120px_115px_120px_90px_100px] items-center px-4 py-3 text-sm transition-colors ${isCancelled ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-slate-700/50'}`}>
                              <div onClick={() => navigate(`/invoices/${invoice._id}`)} className={`font-medium cursor-pointer hover:underline ${isCancelled ? 'text-red-400' : 'text-blue-400 hover:text-blue-300'}`}>
                                <div className="flex items-center gap-2">
                                  <FileText className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-blue-400'}`} />
                                  {invoice.invoiceNumber}
                                </div>
                              </div>
                              <div className={isCancelled ? 'text-red-400' : 'text-slate-300'}>
                                <div className="flex items-center gap-2">
                                  <Calendar className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                                  {formatDate(invoice.invoiceDate)}
                                </div>
                              </div>
                              <div>
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
                              </div>
                              <div className={isCancelled ? 'text-red-400' : 'text-slate-300'}>
                                <div className="flex items-center gap-2">
                                  <Package className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                                  {invoice.items?.length || 0} items
                                </div>
                              </div>
                              <div className={`font-medium ${isCancelled ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                                {formatCurrency(invoice.totals?.netTotal)}
                              </div>
                              <div>
                                <span
                                  className={`badge ${paymentConfig[invoice.paymentType]?.class || 'badge-info'} inline-flex items-center gap-1.5`}
                                >
                                  <PaymentIcon className="w-3 h-3" />
                                  {invoice.paymentType}
                                </span>
                              </div>
                              <div>
                                <span
                                  className={`badge ${statusConfig[invoice.status]?.class || 'badge-info'} inline-flex items-center gap-1.5`}
                                >
                                  <StatusIcon className="w-3 h-3" />
                                  {invoice.status}
                                </span>
                              </div>
                              <div className="text-center">
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
                              </div>
                              <div>
                                <Link
                                  to={`/invoices/${invoice._id}`}
                                  className="btn btn-secondary py-1.5 px-3 text-sm inline-flex items-center gap-2 group"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </Link>
                              </div>
                            </div>
                          );
                        }}
                      />
              </div>
            </div>
            ) : (
            /* Mobile Card View */
            <VirtualizedList
              items={invoices}
              estimateSize={() => 220}
              getKey={(invoice) => invoice._id}
              gap={16}
              className="min-h-[220px]"
              renderItem={(invoice) => {
                const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                const PaymentIcon = paymentConfig[invoice.paymentType]?.icon || CreditCard;
                const isCancelled = invoice.status === 'Cancelled';

                return (
                  <div className={`glass-card p-4 flex flex-col gap-4 relative overflow-hidden transition-colors ${isCancelled ? 'bg-red-500/10 border-red-500/20' : ''}`}>
                    {/* Header: Invoice # + Date — clickable */}
                    <div onClick={() => navigate(`/invoices/${invoice._id}`)} className="flex justify-between items-start gap-3 cursor-pointer rounded-lg -m-1 p-1 hover:bg-slate-700/30 transition-colors">
                      <div className="flex gap-3 flex-1">
                        <div className={`p-2.5 rounded-xl shrink-0 h-fit ${isCancelled ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                          <FileText className={`w-5 h-5 ${isCancelled ? 'text-red-400' : 'text-blue-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-semibold text-base mb-1 ${isCancelled ? 'text-red-400' : 'text-white'}`}>
                            {invoice.invoiceNumber}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            <span className={`flex items-center gap-1.5 shrink-0 ${isCancelled ? 'text-red-400' : ''}`}>
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(invoice.invoiceDate)}
                            </span>
                            <span className={`flex items-center gap-1.5 shrink-0 ${isCancelled ? 'text-red-400' : ''}`}>
                              <Package className="w-3.5 h-3.5" />
                              {invoice.items?.length || 0} items
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Status Badge */}
                      <span className={`badge ${statusConfig[invoice.status]?.class || 'badge-info'} inline-flex items-center gap-1.5 shrink-0`}>
                        <StatusIcon className="w-3 h-3" />
                        {invoice.status}
                      </span>
                    </div>

                    {/* Customer + Amount Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50 bg-slate-800/30 -mx-4 px-4 pb-1">
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Customer</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg ${isCancelled ? 'bg-red-500/20 text-red-400 shadow-red-500/20' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'}`}>
                            {invoice.customer?.customerName?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-medium text-sm truncate ${isCancelled ? 'text-red-400' : 'text-white'}`}>
                              {invoice.customer?.customerName}
                            </p>
                            <p className={`text-[10px] flex items-center gap-1 ${isCancelled ? 'text-red-400 opacity-80' : 'text-slate-400'}`}>
                              <User className="w-2.5 h-2.5" />
                              {invoice.customer?.phone}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 flex flex-col items-end">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Amount</p>
                        <p className={`font-semibold text-sm ${isCancelled ? 'text-red-400' : 'text-emerald-400'}`}>
                          {formatCurrency(invoice.totals?.netTotal)}
                        </p>
                        <span className={`badge ${paymentConfig[invoice.paymentType]?.class || 'badge-info'} inline-flex items-center gap-1.5 px-2 py-0.5 text-xs`}>
                          <PaymentIcon className="w-3 h-3" />
                          {invoice.paymentType}
                        </span>
                      </div>
                    </div>

                    {/* Printed Toggle Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-700/50 mt-1">
                      <span className="text-xs text-slate-400 font-medium">Mark as Printed</span>
                      <label className={`inline-flex items-center ${isCancelled || statusUpdating[invoice._id] ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
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
                    </div>
                  </div>
                );
              }}
            />
            )}

            {/* Infinite Scroll Loader */}
            {(hasMore || isValidating) && (
              <div ref={lastElementRef} className="p-4 glass-card flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span className="text-sm">Loading more invoices...</span>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          if (!isExporting) setShowExportModal(false);
        }}
        data={invoices}
        stats={exportStats}
        onExport={handleExport}
        isExporting={isExporting}
        entityType="Invoices"
      />
    </motion.div>
  );
}
