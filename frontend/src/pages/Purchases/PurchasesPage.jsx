import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Plus,
  Calendar,
  Truck,
  Building2,
  Package,
  DollarSign,
  CreditCard,
  XCircle,
  CheckCircle,
  Trash2,
  Eye,
  Search,
  Filter,
  Download,
  TrendingUp,
  Clock,
  Loader2
} from 'lucide-react';
import purchaseService from '../../services/purchaseService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import ExportModal from '../../components/Common/Modals/ExportModal';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  invalidateCachePattern, 
  useDebounce, 
  useFirstVisit, 
  useMediaQuery, 
  useMotionConfig, 
  useSWR 
} from '../../hooks';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import { VirtualizedList } from '../../components/Common/VirtualizedList';

// Factory functions for adaptive motion variants
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

export default function PurchasesPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search] = useDebounce(searchInput);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accumulatedPurchases, setAccumulatedPurchases] = useState([]);
  const observer = useRef(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const { showToast } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Adaptive motion configuration
  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('purchases');
  const pageVariants = useMemo(() => createPageVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);
  const cardVariants = useMemo(() => createCardVariants(motionConfig.isMobile), [motionConfig.isMobile]);
  const tableRowVariants = useMemo(() => createTableRowVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);

  // SWR: Purchase list with server-side filtering and infinite scrolling
  const { data, isLoading, isValidating, mutate } = useSWR(
    `purchases-page-${search}-${statusFilter}-${startDate}-${endDate}-${page}`,
    () => {
      const params = {
        page,
        limit: 20
      };

      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      return purchaseService.getPurchases(params);
    },
    { ttl: 5 * 60 * 1000 }
  );

  // SWR: Global purchase stats for cards
  const { data: statsData } = useSWR(
    'purchases-stats',
    () => purchaseService.getPurchaseStats(),
    { ttl: 5 * 60 * 1000 }
  );

  const purchases = accumulatedPurchases.length > 0 ? accumulatedPurchases : (data?.purchases || []);
  const totalMatched = data?.total || 0;
  const hasMore = data?.pages ? page < data.pages : false;

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, startDate, endDate]);

  // Accumulate purchases as pages arrive
  useEffect(() => {
    if (!data?.purchases) return;

    if (page === 1) {
      setAccumulatedPurchases(data.purchases);
      return;
    }

    setAccumulatedPurchases(prev => {
      const existingIds = new Set(prev.map(p => p._id));
      const newPurchases = data.purchases.filter(p => !existingIds.has(p._id));
      return [...prev, ...newPurchases];
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
    total: statsData?.stats?.totalPurchases ?? purchases.length,
    today: statsData?.stats?.todayPurchases ?? 0,
    thisMonth: statsData?.stats?.thisMonthPurchases ?? 0,
    totalSpend: statsData?.stats?.totalSpend ?? 0
  };

  const statusConfig = {
    COMPLETED: { icon: CheckCircle, class: 'badge-success', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    DRAFT: { icon: ShoppingBag, class: 'badge-info', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    CANCELLED: { icon: XCircle, class: 'badge-danger', color: 'text-rose-400', bg: 'bg-rose-500/20' }
  };

  const paymentConfig = {
    Cash: { icon: DollarSign, class: 'badge-success' },
    Credit: { icon: CreditCard, class: 'badge-info' },
    'Bank Transfer': { icon: CreditCard, class: 'badge-purple' },
    UPI: { icon: CreditCard, class: 'badge-teal' },
    Cheque: { icon: CreditCard, class: 'badge-amber' }
  };

  const handleComplete = async (purchaseId) => {
    if (!window.confirm('Completing this purchase will permanently receive stock. Continue?')) return;
    setActionLoading(prev => ({ ...prev, [purchaseId]: true }));
    try {
      await purchaseService.completePurchase(purchaseId);
      showToast('Purchase completed successfully. Inventory updated.', 'success');
      invalidateCachePattern('purchases');
      invalidateCachePattern('products');
      invalidateCachePattern('batches');
      mutate();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error completing purchase', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [purchaseId]: false }));
    }
  };

  const handleCancel = async (purchaseId) => {
    if (!window.confirm('Cancelling this purchase will reverse the inventory received from it. Continue?')) return;
    setActionLoading(prev => ({ ...prev, [purchaseId]: true }));
    try {
      await purchaseService.cancelPurchase(purchaseId);
      showToast('Purchase cancelled successfully. Inventory reversed.', 'success');
      invalidateCachePattern('purchases');
      invalidateCachePattern('products');
      invalidateCachePattern('batches');
      mutate();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error cancelling purchase', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [purchaseId]: false }));
    }
  };

  const handleDelete = async (purchaseId) => {
    if (!window.confirm('Are you sure you want to delete this draft purchase?')) return;
    setActionLoading(prev => ({ ...prev, [purchaseId]: true }));
    try {
      await purchaseService.deletePurchase(purchaseId);
      showToast('Purchase deleted successfully', 'success');
      invalidateCachePattern('purchases');
      mutate();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error deleting purchase', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [purchaseId]: false }));
    }
  };

  const handleExport = async ({ format, dateRange }) => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const params = { format };
      if (dateRange?.startDate) params.startDate = dateRange.startDate;
      if (dateRange?.endDate) params.endDate = dateRange.endDate;
      if (statusFilter !== 'all') params.status = statusFilter;

      const blob = await purchaseService.exportPurchases(params);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const extensionMap = { excel: 'xlsx', pdf: 'pdf', csv: 'csv' };
      const extension = extensionMap[format] || 'xlsx';

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      link.download = `purchases_export_${y}-${m}-${d}.${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setShowExportModal(false);
      showToast(`Successfully exported purchases as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to export purchases', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const showSkeleton = isLoading && purchases.length === 0 && page === 1;

  return (
    <motion.div
      variants={pageVariants}
      initial={isFirstVisit ? "hidden" : false}
      animate="visible"
      className="p-6 max-w-7xl mx-auto space-y-8"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Purchases',
            value: stats.total,
            icon: ShoppingBag,
            color: 'from-blue-500 to-blue-600',
            iconColor: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
          },
          {
            label: "Today's Purchases",
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
          },
          {
            label: 'Total Spend',
            value: formatCurrency(stats.totalSpend),
            icon: DollarSign,
            color: 'from-teal-500 to-teal-600',
            iconColor: 'text-teal-400',
            bgColor: 'bg-teal-500/20'
          }
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-card p-6 cursor-pointer group transition-transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">
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
      <div className="glass-card p-6 relative z-10">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg transition-transform hover:rotate-[360deg] duration-700">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">All Purchases</h2>
                <RefreshIndicator isRefreshing={isValidating} size="sm" />
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Showing {purchases.length} of {totalMatched || purchases.length} purchases
              </p>
            </div>
          </div>

          <div>
            <Link 
              to="/purchases/new" 
              className="btn btn-primary flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5" />
              New Purchase
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
              placeholder="Search purchase #, supplier, bill..."
              className="input pl-10 w-full"
            />
            <AnimatePresence>
              {searchInput && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  onClick={() => setSearchInput('')}
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
              <option value="COMPLETED">Completed</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
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
            type="button"
            onClick={() => setShowExportModal(true)}
            className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold flex items-center justify-center gap-2 px-6 py-3 shadow-lg shadow-emerald-500/30 border-0 active:scale-95 transition-transform"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Purchases Table / Cards */}
      <AnimatePresence mode="wait">
        {showSkeleton ? (
          <div key="skeleton" className="glass-card p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
            <p>Loading purchases...</p>
          </div>
        ) : purchases.length === 0 ? (
          <div key={`empty-${statusFilter}`} className="glass-card p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6">
              <ShoppingBag className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-400 mb-6 text-lg">
              {search || searchInput || startDate || endDate
                ? 'No purchases found matching your search'
                : statusFilter !== 'all'
                  ? `No ${statusFilter} purchases found`
                  : 'No purchases found. Create your first purchase entry!'}
            </p>
            {!search && !searchInput && !startDate && !endDate && (
              <div>
                <Link to="/purchases/new" className="btn btn-primary inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  New Purchase
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
                <div className="grid grid-cols-[130px_120px_minmax(200px,1.5fr)_90px_130px_120px_120px_140px] items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 bg-slate-800/50">
                  <div>Purchase #</div>
                  <div>Date</div>
                  <div>Supplier</div>
                  <div>Items</div>
                  <div>Amount</div>
                  <div>Payment</div>
                  <div>Status</div>
                  <div className="text-right">Actions</div>
                </div>

                {/* Data Rows */}
                <div>
                  <VirtualizedList
                    items={purchases}
                    estimateSize={() => 76}
                    getKey={(purchase) => purchase._id}
                    className="min-h-[76px]"
                    itemClassName="border-b border-slate-700/50"
                    renderItem={(purchase) => {
                      const StatusIcon = statusConfig[purchase.status]?.icon || ShoppingBag;
                      const PaymentIcon = paymentConfig[purchase.paymentType]?.icon || CreditCard;
                      const isCancelled = purchase.status === 'CANCELLED';

                      return (
                        <div 
                          className={`grid grid-cols-[130px_120px_minmax(200px,1.5fr)_90px_130px_120px_120px_140px] items-center px-4 py-3 text-sm transition-colors ${
                            isCancelled ? 'bg-rose-500/10 hover:bg-rose-500/20' : 'hover:bg-slate-700/50'
                          }`}
                        >
                          <div 
                            onClick={() => navigate(`/purchases/${purchase._id}`)} 
                            className={`font-medium cursor-pointer hover:underline ${isCancelled ? 'text-rose-400' : 'text-blue-400 hover:text-blue-300'}`}
                          >
                            <div className="flex items-center gap-2">
                              <ShoppingBag className={`w-4 h-4 ${isCancelled ? 'text-rose-400' : 'text-blue-400'}`} />
                              {purchase.purchaseNumber}
                            </div>
                          </div>

                          <div className={isCancelled ? 'text-rose-400' : 'text-slate-300'}>
                            <div className="flex items-center gap-2">
                              <Calendar className={`w-4 h-4 ${isCancelled ? 'text-rose-400' : 'text-slate-500'}`} />
                              {formatDate(purchase.purchaseDate)}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg ${
                                isCancelled ? 'bg-rose-500/20 text-rose-400 shadow-rose-500/20' : 'bg-gradient-to-br from-blue-500 to-teal-600 shadow-blue-500/30'
                              }`}>
                                {purchase.supplierId?.name ? purchase.supplierId.name.charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-medium truncate ${isCancelled ? 'text-rose-400' : 'text-white'}`}>
                                  {purchase.supplierId?.name || 'Unknown Supplier'}
                                </p>
                                <p className={`text-xs flex items-center gap-1 ${isCancelled ? 'text-rose-400 opacity-80' : 'text-slate-400'}`}>
                                  {purchase.supplierId?.gstin || purchase.supplierId?.phone || purchase.supplierInvoiceNumber || ''}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className={isCancelled ? 'text-rose-400' : 'text-slate-300'}>
                            <div className="flex items-center gap-2">
                              <Package className={`w-4 h-4 ${isCancelled ? 'text-rose-400' : 'text-slate-500'}`} />
                              {purchase.items?.length || 0} items
                            </div>
                          </div>

                          <div className={`font-medium ${isCancelled ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                            {formatCurrency(purchase.totals?.grandTotal || 0)}
                          </div>

                          <div>
                            <span className={`badge ${paymentConfig[purchase.paymentType]?.class || 'badge-info'} inline-flex items-center gap-1.5`}>
                              <PaymentIcon className="w-3 h-3" />
                              {purchase.paymentType || 'Credit'}
                            </span>
                          </div>

                          <div>
                            <span className={`badge ${statusConfig[purchase.status]?.class || 'badge-info'} inline-flex items-center gap-1.5`}>
                              <StatusIcon className="w-3 h-3" />
                              {purchase.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/purchases/${purchase._id}`)}
                              className="btn btn-secondary py-1 px-2 text-xs inline-flex items-center gap-1 group"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>

                            {purchase.status === 'DRAFT' && (
                              <>
                                {(isAdmin || hasPermission('purchases', 'edit')) && (
                                  <button
                                    type="button"
                                    onClick={() => handleComplete(purchase._id)}
                                    disabled={actionLoading[purchase._id]}
                                    className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                    title="Complete & receive stock"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                {(isAdmin || hasPermission('purchases', 'edit')) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(purchase._id)}
                                    disabled={actionLoading[purchase._id]}
                                    className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                    title="Delete draft"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}

                            {purchase.status === 'COMPLETED' && (isAdmin || hasPermission('purchases', 'cancel')) && (
                              <button
                                type="button"
                                onClick={() => handleCancel(purchase._id)}
                                disabled={actionLoading[purchase._id]}
                                className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="Cancel purchase & reverse stock"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
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
                items={purchases}
                estimateSize={() => 220}
                getKey={(purchase) => purchase._id}
                gap={16}
                className="min-h-[220px]"
                renderItem={(purchase) => {
                  const StatusIcon = statusConfig[purchase.status]?.icon || ShoppingBag;
                  const PaymentIcon = paymentConfig[purchase.paymentType]?.icon || CreditCard;
                  const isCancelled = purchase.status === 'CANCELLED';

                  return (
                    <div className={`glass-card p-4 flex flex-col gap-4 relative overflow-hidden transition-colors ${
                      isCancelled ? 'bg-rose-500/10 border-rose-500/20' : ''
                    }`}>
                      {/* Header */}
                      <div 
                        onClick={() => navigate(`/purchases/${purchase._id}`)} 
                        className="flex justify-between items-start gap-3 cursor-pointer rounded-lg -m-1 p-1 hover:bg-slate-700/30 transition-colors"
                      >
                        <div className="flex gap-3 flex-1">
                          <div className={`p-2.5 rounded-xl shrink-0 h-fit ${isCancelled ? 'bg-rose-500/20' : 'bg-blue-500/20'}`}>
                            <ShoppingBag className={`w-5 h-5 ${isCancelled ? 'text-rose-400' : 'text-blue-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <h3 className={`font-semibold text-base mb-1 ${isCancelled ? 'text-rose-400' : 'text-white'}`}>
                              {purchase.purchaseNumber}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(purchase.purchaseDate)}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Package className="w-3.5 h-3.5" />
                                {purchase.items?.length || 0} items
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={`badge ${statusConfig[purchase.status]?.class || 'badge-info'} shrink-0 text-xs`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {purchase.status}
                        </span>
                      </div>

                      {/* Supplier & Amount */}
                      <div className="flex justify-between items-center py-2 border-y border-slate-700/50 text-sm">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-200 font-medium truncate">
                            {purchase.supplierId?.name || 'Unknown Supplier'}
                          </span>
                        </div>
                        <div className="text-right shrink-0 font-bold text-emerald-400 text-base">
                          {formatCurrency(purchase.totals?.grandTotal || 0)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className={`badge ${paymentConfig[purchase.paymentType]?.class || 'badge-info'} text-xs`}>
                          <PaymentIcon className="w-3 h-3 mr-1" />
                          {purchase.paymentType || 'Credit'}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/purchases/${purchase._id}`)}
                            className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>

                          {purchase.status === 'DRAFT' && (isAdmin || hasPermission('purchases', 'edit')) && (
                            <button
                              type="button"
                              onClick={() => handleComplete(purchase._id)}
                              disabled={actionLoading[purchase._id]}
                              className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        entityType="purchases"
        isExporting={isExporting}
        showDateRange={true}
      />
    </motion.div>
  );
}
