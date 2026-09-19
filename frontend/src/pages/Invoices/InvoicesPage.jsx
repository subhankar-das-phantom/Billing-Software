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
import { useAuth } from '../../contexts/AuthContext';
import { invalidateCachePattern, useDebounce, useFirstVisit, useMediaQuery, useMotionConfig, useSWR } from '../../hooks';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import { VirtualizedList } from '../../components/Common/VirtualizedList';
import CollapsibleMobileCard from '../../components/Common/Cards/CollapsibleMobileCard';
import { findScrollParent, INFINITE_SCROLL_THRESHOLD, INFINITE_SCROLL_ROOT_MARGIN } from '../../utils/scrollUtils';

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
  const { user } = useAuth();

  // Mobile card density preference with Frame-0 cache pre-seeding
  const storedDensity = typeof window !== 'undefined' ? localStorage.getItem('bharat_mobile_card_density') : null;
  const initialDensity = storedDensity === 'expanded' || storedDensity === 'compact' ? storedDensity : 'compact';
  const mobileCardDensity = user?.preferences?.mobileCardDensity || initialDensity;

  // Adaptive motion configuration
  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('invoices');
  const pageVariants = useMemo(() => createPageVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);
  const cardVariants = useMemo(() => createCardVariants(motionConfig.isMobile), [motionConfig.isMobile]);
  const tableRowVariants = useMemo(() => createTableRowVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);

  const currentQueryKey = `${search}-${statusFilter}-${startDate}-${endDate}`;
  const activeQueryKeyRef = useRef(currentQueryKey);

  const isFetchingRef = useRef(false);
  const pendingPageRef = useRef(null);

  // State synchronization refs for stable observer
  const hasMoreRef = useRef(false);
  const isValidatingRef = useRef(false);
  const loadNextPageRef = useRef(null);
  const sentinelRef = useRef(null);
  const [scrollRoot, setScrollRoot] = useState(null);

  // SWR: Invoice list (server-side filters + infinite scroll)
  const { data, isLoading, isValidating, error: swrError } = useSWR(
    `invoices-page-${currentQueryKey}-${page}`,
    async () => {
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

      const res = await invoiceService.getInvoices(params);
      return { ...res, _queryKey: currentQueryKey, _page: page };
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

  // Keep synchronization refs up-to-date
  hasMoreRef.current = hasMore;
  isValidatingRef.current = isValidating;

  // Reset page and advance active query key when filters/search change.
  useEffect(() => {
    setPage(1);
    pendingPageRef.current = null;
    isFetchingRef.current = false;
    activeQueryKeyRef.current = currentQueryKey;
  }, [currentQueryKey]);

  // Accumulate invoices as pages arrive (guarded by query provenance)
  useEffect(() => {
    if (!data?.invoices) return;

    // Provenance Verification: Drop responses belonging to an obsolete filter generation
    if (data._queryKey && data._queryKey !== activeQueryKeyRef.current) {
      return;
    }

    if (page === 1) {
      setAccumulatedInvoices(data.invoices);
    } else {
      setAccumulatedInvoices(prev => {
        const existingIds = new Set(prev.map(inv => inv._id));
        const newInvoices = data.invoices.filter(inv => !existingIds.has(inv._id));
        return [...prev, ...newInvoices];
      });
    }

    // Release lock only after the specific requested page has completed successfully
    if (pendingPageRef.current !== null && (data._page === pendingPageRef.current || data.page === pendingPageRef.current)) {
      isFetchingRef.current = false;
      pendingPageRef.current = null;
    }
  }, [data, page]);

  // Failure Path: Release lock on request error so infinite scroll is not permanently disabled
  useEffect(() => {
    if (swrError && pendingPageRef.current !== null) {
      isFetchingRef.current = false;
      pendingPageRef.current = null;
    }
  }, [swrError]);

  // Dedicated load trigger function controlling pagination and synchronous request lock
  const loadNextPage = useCallback(() => {
    if (isFetchingRef.current || isValidatingRef.current || !hasMoreRef.current) return;
    isFetchingRef.current = true;
    pendingPageRef.current = page + 1;
    setPage(p => p + 1);
  }, [page]);
  loadNextPageRef.current = loadNextPage;

  // Dynamic Scroll Root State: Re-resolves ONLY on viewport resize or layout changes
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const updateRoot = () => {
      const resolvedRoot = findScrollParent(node);
      setScrollRoot(prev => (prev !== resolvedRoot ? resolvedRoot : prev));
    };

    updateRoot();
    window.addEventListener('resize', updateRoot);
    return () => window.removeEventListener('resize', updateRoot);
  }, [isDesktop]);

  // Truly Stable IntersectionObserver: Only recreates if the genuine scroll root element changes
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !scrollRoot) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current && !isValidatingRef.current && !isFetchingRef.current) {
          loadNextPageRef.current?.();
        }
      },
      { root: scrollRoot, threshold: INFINITE_SCROLL_THRESHOLD, rootMargin: INFINITE_SCROLL_ROOT_MARGIN }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRoot]);

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
                <p className="text-3xl font-bold text-slate-100">
                  {stat.value}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800 text-slate-400 group-hover:text-slate-200 border border-slate-700/60 transition-colors">
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header with Filters */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 border border-slate-700/60 rounded-lg text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-100">All Invoices</h2>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
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
            className="btn bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 px-6 py-3 shadow-xs border-0 active:scale-[0.98] transition-all"
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
            <div className="glass-card w-full overflow-x-auto" data-horizontal-table-scroll="true">
              <div className="min-w-[800px]">
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
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold border ${isCancelled ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800 text-slate-200 border-slate-700/60 group-hover:text-emerald-400 group-hover:border-emerald-500/30'} transition-colors`}
                                  >
                                    {invoice.customer?.customerName?.charAt(0)}
                                  </div>
                                  <div>
                                    <p className={`font-medium ${isCancelled ? 'text-red-400' : 'text-slate-100'}`}>{invoice.customer?.customerName}</p>
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
            </div>
            ) : (
            /* Mobile Card View */
            <VirtualizedList
              items={invoices}
              estimateSize={() => (mobileCardDensity === 'compact' ? 78 : 220)}
              getKey={(invoice) => invoice._id}
              gap={12}
              className="min-h-[220px]"
              renderItem={(invoice) => {
                const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                const PaymentIcon = paymentConfig[invoice.paymentType]?.icon || CreditCard;
                const isCancelled = invoice.status === 'Cancelled';

                return (
                  <CollapsibleMobileCard
                    id={invoice._id}
                    entityType="invoice"
                    isCancelled={isCancelled}
                    defaultExpanded={mobileCardDensity === 'expanded'}
                    summary={
                      <div className="space-y-1">
                        {/* Line 1: Primary ID + Net Amount */}
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/invoices/${invoice._id}`}
                            className={`font-semibold text-sm truncate hover:underline ${
                              isCancelled ? 'text-red-400' : 'text-slate-100 hover:text-blue-400'
                            }`}
                          >
                            {invoice.invoiceNumber}
                          </Link>
                          <span
                            className={`font-mono font-bold text-sm shrink-0 ${
                              isCancelled ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {formatCurrency(invoice.totals?.netTotal)}
                          </span>
                        </div>

                        {/* Line 2: Customer Name + Date + Status Badge */}
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="truncate max-w-[150px] sm:max-w-[200px]" title={invoice.customer?.customerName}>
                            {invoice.customer?.customerName || 'Walk-in Customer'}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] text-slate-400">
                              {formatDate(invoice.invoiceDate)}
                            </span>
                            <span
                              className={`badge ${
                                statusConfig[invoice.status]?.class || 'badge-info'
                              } inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5`}
                            >
                              <StatusIcon className="w-2.5 h-2.5" />
                              {invoice.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    }
                  >
                    {/* Expanded Details */}
                    <div className="space-y-3 text-xs">
                      {/* Customer Phone & Items Count */}
                      <div className="flex items-center justify-between text-slate-300">
                        {invoice.customer?.phone ? (
                          <span className="flex items-center gap-1 font-mono text-slate-400">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            {invoice.customer.phone}
                          </span>
                        ) : (
                          <span className="text-slate-500">No phone</span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          {invoice.items?.length || 0} items
                        </span>
                      </div>

                      {/* Payment Method Badge & View Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                        <span
                          className={`badge ${
                            paymentConfig[invoice.paymentType]?.class || 'badge-info'
                          } inline-flex items-center gap-1 px-2 py-0.5 text-xs`}
                        >
                          <PaymentIcon className="w-3 h-3" />
                          {invoice.paymentType}
                        </span>
                        <Link
                          to={`/invoices/${invoice._id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Details
                        </Link>
                      </div>

                      {/* Printed Toggle Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                        <span className="text-slate-400 font-medium">Mark as Printed</span>
                        <label
                          className={`inline-flex items-center ${
                            isCancelled || statusUpdating[invoice._id]
                              ? 'cursor-not-allowed opacity-50'
                              : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Mark invoice ${invoice.invoiceNumber} as printed`}
                            className="sr-only"
                            checked={invoice.status === 'Printed'}
                            disabled={isCancelled || statusUpdating[invoice._id]}
                            onChange={(e) => handlePrintedToggle(invoice._id, e.target.checked)}
                          />
                          <div
                            className={`relative w-9 h-5 rounded-full transition-colors shadow-inner ${
                              invoice.status === 'Printed' ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                invoice.status === 'Printed' ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  </CollapsibleMobileCard>
                );
              }}
            />
            )}

            {/* Persistent Sentinel Container (stays mounted in DOM; visibility toggles smoothly) */}
            <div
              ref={sentinelRef}
              className={`w-full flex items-center justify-center p-4 min-h-[48px] my-2 transition-all ${
                !hasMore ? 'hidden pointer-events-none' : ''
              }`}
            >
              {isValidating ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span className="text-sm font-medium">Loading more invoices...</span>
                </div>
              ) : (
                <div className="h-6 w-full opacity-0 pointer-events-none" aria-hidden="true" />
              )}
            </div>
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
