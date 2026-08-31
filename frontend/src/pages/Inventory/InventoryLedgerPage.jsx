import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import stockMovementService from '../../services/stockMovementService';
import { productService } from '../../services/products/productService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce, useFirstVisit, useMotionConfig } from '../../hooks';
import {
  History,
  Package,
  Search,
  Loader2,
  X,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  PlusCircle,
  MinusCircle,
  Calendar,
  RefreshCw,
  Download,
  FileText,
  ShoppingBag,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

export default function InventoryLedgerPage() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filters
  const [searchProductId, setSearchProductId] = useState('');
  const [searchBatchId, setSearchBatchId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Product Search Dropdown State
  const [productSearchText, setProductSearchText] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [isProductSearchLoading, setIsProductSearchLoading] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [debouncedProductSearchText] = useDebounce(productSearchText, 300);
  const latestProductSearchRequest = useRef(0);

  const { showToast } = useToast();
  const isFirstVisit = useFirstVisit('inventory-ledger');
  const { isMobile } = useMotionConfig();

  // Debounce batch search
  const [debouncedBatchId] = useDebounce(searchBatchId, 400);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.product-search-container')) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch products for search dropdown
  useEffect(() => {
    const query = debouncedProductSearchText.trim();
    const abortController = new AbortController();

    if (!showProductDropdown) return;

    if (query.length < 1) {
      setProductResults([]);
      setIsProductSearchLoading(false);
      return;
    }

    const requestId = latestProductSearchRequest.current + 1;
    latestProductSearchRequest.current = requestId;
    setIsProductSearchLoading(true);

    (async () => {
      try {
        const data = await productService.getProducts(
          { search: query, limit: 8, page: 1 },
          { signal: abortController.signal }
        );

        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults(data.products || []);
      } catch (err) {
        if (err.name === 'CanceledError' || err.message === 'canceled') return;
        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults([]);
      } finally {
        if (latestProductSearchRequest.current === requestId) {
          setIsProductSearchLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [debouncedProductSearchText, showProductDropdown]);

  // Date Presets Handler
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const toYMD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (preset) {
      case 'today': {
        const todayStr = toYMD(now);
        setDateFrom(todayStr);
        setDateTo(todayStr);
        break;
      }
      case 'thisWeek': {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        setDateFrom(toYMD(firstDay));
        setDateTo(toYMD(new Date()));
        break;
      }
      case 'thisMonth': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setDateFrom(toYMD(firstDay));
        setDateTo(toYMD(new Date()));
        break;
      }
      case 'all':
      default:
        setDateFrom('');
        setDateTo('');
        break;
    }
    setPage(1);
  };

  const fetchMovements = useCallback(async (isSilent = false) => {
    try {
      if (isSilent) setIsRefreshing(true);
      else setLoading(true);

      const data = await stockMovementService.getStockMovements({
        productId: searchProductId,
        batchId: debouncedBatchId,
        type: movementType,
        dateFrom,
        dateTo,
        page,
        limit
      });
      setMovements(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      showToast('Failed to load inventory ledger', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [searchProductId, debouncedBatchId, movementType, dateFrom, dateTo, page, showToast]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Movement Type Config with Badges, Colors & Icons
  const movementConfig = useMemo(() => ({
    PURCHASE: {
      label: 'Purchase In',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      icon: ArrowDownRight,
      direction: 'in'
    },
    PURCHASE_RETURN: {
      label: 'Purchase Return',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/30',
      icon: RotateCcw,
      direction: 'out'
    },
    SALE: {
      label: 'Sale Out',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/30',
      icon: ArrowUpRight,
      direction: 'out'
    },
    SALE_RETURN: {
      label: 'Sale Return',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/30',
      icon: RotateCcw,
      direction: 'in'
    },
    SALE_REVERSAL: {
      label: 'Sale Reversal',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
      icon: RotateCcw,
      direction: 'in'
    },
    OPENING_STOCK: {
      label: 'Opening Stock',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/30',
      icon: Package,
      direction: 'in'
    },
    MANUAL_ADJUSTMENT_IN: {
      label: 'Adjustment In',
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 border-teal-500/30',
      icon: PlusCircle,
      direction: 'in'
    },
    MANUAL_ADJUSTMENT_OUT: {
      label: 'Adjustment Out',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/30',
      icon: MinusCircle,
      direction: 'out'
    }
  }), []);

  // Compute Active Filters Count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchProductId || productSearchText) count++;
    if (searchBatchId) count++;
    if (movementType) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [searchProductId, productSearchText, searchBatchId, movementType, dateFrom, dateTo]);

  const handleResetFilters = () => {
    setSearchProductId('');
    setProductSearchText('');
    setSearchBatchId('');
    setMovementType('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Summary Metrics from Current Page / Movements
  const metrics = useMemo(() => {
    let inflowUnits = 0;
    let outflowUnits = 0;
    let totalVal = 0;

    movements.forEach((mov) => {
      const qty = mov.quantity || 0;
      if (qty > 0) inflowUnits += qty;
      else outflowUnits += Math.abs(qty);

      totalVal += mov.totalValue || Math.abs(qty * (mov.rate || 0));
    });

    return {
      inflowUnits,
      outflowUnits,
      totalVal,
      count: total
    };
  }, [movements, total]);

  // CSV Quick Export
  const handleExportCSV = () => {
    if (!movements || movements.length === 0) {
      showToast('No ledger entries available to export', 'error');
      return;
    }

    const headers = ['Date', 'Time', 'Type', 'Product Name', 'Batch No', 'Expiry Date', 'Qty Change', 'Unit Rate', 'Total Value', 'Created By'];
    const rows = movements.map(m => {
      const d = new Date(m.createdAt);
      return [
        `"${d.toLocaleDateString('en-IN')}"`,
        `"${d.toLocaleTimeString('en-IN')}"`,
        `"${m.type}"`,
        `"${(m.product?.productName || m.productName || '').replace(/"/g, '""')}"`,
        `"${(m.batch?.batchNo || m.batchNumber || '').replace(/"/g, '""')}"`,
        `"${m.batch?.expiryDate ? formatDate(m.batch.expiryDate) : ''}"`,
        m.quantity,
        m.rate || 0,
        m.totalValue || 0,
        `"${m.createdBy?.name || 'System'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventory_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Ledger exported to CSV successfully', 'success');
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <motion.div
      variants={pageVariants}
      initial={isFirstVisit ? 'hidden' : false}
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* ─── Header & Actions ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Inventory Ledger</h1>
              <p className="text-sm text-slate-400 mt-0.5">Comprehensive audit trail of stock inward, outward & adjustments</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchMovements(true)}
            disabled={loading || isRefreshing}
            className="btn btn-secondary flex items-center gap-2 py-2 px-3.5 text-xs font-medium"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={loading || movements.length === 0}
            className="btn btn-secondary flex items-center gap-2 py-2 px-3.5 text-xs font-medium hover:text-emerald-400 border-slate-700 hover:border-emerald-500/30"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics Cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Records</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{total}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-blue-400 font-medium">{movements.length}</span> on this page
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inflow Units</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">+{metrics.inflowUnits}</div>
          <div className="text-xs text-slate-400 mt-1">Purchases & additions</div>
        </div>

        <div className="glass-card p-4 sm:p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outflow Units</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">-{metrics.outflowUnits}</div>
          <div className="text-xs text-slate-400 mt-1">Sales & deductions</div>
        </div>

        <div className="glass-card p-4 sm:p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Page Movement Value</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{formatCurrency(metrics.totalVal)}</div>
          <div className="text-xs text-slate-400 mt-1">Gross transactional valuation</div>
        </div>
      </div>

      {/* ─── Filter & Search Bar ──────────────────────────────── */}
      <div className="glass-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/50 pb-3.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-accent-400" />
            <span className="text-sm font-semibold text-white">Filter Stock Audit Log</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-500/20 text-accent-300 border border-accent-500/30">
                {activeFiltersCount} active
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition-colors self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Product Search Combobox (4 cols) */}
          <div className="lg:col-span-4 relative product-search-container">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Product</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                className="input pl-9 pr-8 w-full text-sm"
                placeholder="Search by product name..."
                value={productSearchText}
                onChange={(e) => {
                  setProductSearchText(e.target.value);
                  setSearchProductId('');
                  setShowProductDropdown(true);
                  setPage(1);
                }}
                onFocus={() => setShowProductDropdown(true)}
              />
              {productSearchText && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded"
                  onClick={() => {
                    setProductSearchText('');
                    setSearchProductId('');
                    setShowProductDropdown(false);
                    setPage(1);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <AnimatePresence>
                {showProductDropdown && productSearchText && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute left-0 right-0 z-50 mt-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-800"
                  >
                    {isProductSearchLoading && (
                      <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        Searching catalogue...
                      </div>
                    )}

                    {!isProductSearchLoading && productSearchText.trim().length >= 1 && productResults.length === 0 && (
                      <div className="px-4 py-3 text-xs text-slate-500 text-center">
                        No products found matching &ldquo;{productSearchText}&rdquo;
                      </div>
                    )}

                    {!isProductSearchLoading && productResults.map((product) => (
                      <button
                        key={product._id}
                        onClick={() => {
                          setSearchProductId(product._id);
                          setProductSearchText(product.productName);
                          setShowProductDropdown(false);
                          setPage(1);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-semibold text-white truncate">{product.productName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{product.manufacturer || 'General'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                          {product.effectiveStockQty ?? product.currentStockQty ?? 0} {product.unit || 'Units'}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Batch ID Input (3 cols) */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Batch Number</label>
            <div className="relative">
              <input
                type="text"
                className="input w-full text-sm"
                placeholder="Filter by Batch #..."
                value={searchBatchId}
                onChange={(e) => { setSearchBatchId(e.target.value); setPage(1); }}
              />
              {searchBatchId && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                  onClick={() => { setSearchBatchId(''); setPage(1); }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Movement Type Selector (3 cols) */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Transaction Type</label>
            <select
              className="input w-full text-sm bg-slate-900/90"
              value={movementType}
              onChange={(e) => { setMovementType(e.target.value); setPage(1); }}
            >
              <option value="">All Movement Types</option>
              <option value="PURCHASE">📥 Purchase (Stock In)</option>
              <option value="SALE">📤 Sale (Stock Out)</option>
              <option value="MANUAL_ADJUSTMENT_IN">➕ Adjustment In</option>
              <option value="MANUAL_ADJUSTMENT_OUT">➖ Adjustment Out</option>
              <option value="PURCHASE_RETURN">🔄 Purchase Return (Out)</option>
              <option value="SALE_RETURN">🔄 Sale Return (In)</option>
              <option value="SALE_REVERSAL">⚠️ Sale Reversal (In)</option>
              <option value="OPENING_STOCK">📦 Opening Stock</option>
            </select>
          </div>

          {/* Date Range Presets / Buttons (2 cols) */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Date Period</label>
            <select
              className="input w-full text-sm bg-slate-900/90"
              value={datePreset}
              onChange={(e) => handleDatePreset(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="thisMonth">This Month</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700/30">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-slate-500" />
              From Date
            </label>
            <input
              type="date"
              className="input w-full text-xs"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setDatePreset('custom'); setPage(1); }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-slate-500" />
              To Date
            </label>
            <input
              type="date"
              className="input w-full text-xs"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setDatePreset('custom'); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* ─── Ledger Data Table ────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
            <p className="text-sm text-slate-400">Loading inventory movements...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
              <History className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No Inventory Movements Found</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                No stock transactions match your active filters. Try adjusting your search query, type, or date range.
              </p>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="btn btn-secondary text-xs px-4 py-2"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800/70 border-b border-slate-700 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Movement Type</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Batch / Expiry</th>
                  <th className="py-3.5 px-4 text-right">Qty Change</th>
                  <th className="py-3.5 px-4 text-right">Valuation</th>
                  <th className="py-3.5 px-4 text-center">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {movements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  const config = movementConfig[mov.type] || {
                    label: mov.type?.replace(/_/g, ' ') || 'Movement',
                    color: 'text-slate-300',
                    bg: 'bg-slate-800 border-slate-700',
                    icon: History
                  };
                  const Icon = config.icon;

                  const batchNo = mov.batch?.batchNo || mov.batch?.batchNumber || mov.batchNumber;
                  const hasBatch = batchNo && batchNo !== 'UNNAMED';
                  const expiryDate = mov.batch?.expiryDate || mov.expiryDate;

                  return (
                    <tr
                      key={mov._id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-white text-xs">
                            {formatDate(mov.createdAt)}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(mov.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Movement Type Pill */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.bg} ${config.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {config.label}
                        </span>
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4">
                        {mov.product?._id ? (
                          <Link
                            to={`/products/${mov.product._id}`}
                            className="group-hover:text-blue-400 text-slate-200 font-medium text-xs flex items-center gap-2 transition-colors max-w-xs truncate"
                          >
                            <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{mov.product.productName || 'Unnamed Product'}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-xs flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{mov.productName || '-'}</span>
                          </span>
                        )}
                      </td>

                      {/* Batch & Expiry */}
                      <td className="py-3 px-4">
                        {hasBatch ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-mono font-medium text-slate-300">
                              {batchNo}
                            </span>
                            {expiryDate && (
                              <span className="text-[10px] text-slate-400">
                                Exp: {formatDate(expiryDate)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">No Batch</span>
                        )}
                      </td>

                      {/* Quantity Change */}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center font-bold px-2.5 py-1 rounded-lg text-xs font-mono ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-500/10'
                          }`}
                        >
                          {isPositive ? `+${mov.quantity}` : mov.quantity}
                        </span>
                      </td>

                      {/* Valuation */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-xs text-slate-200">
                            {formatCurrency(mov.totalValue || Math.abs(mov.quantity * (mov.rate || 0)))}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            @{formatCurrency(mov.rate || mov.unitValue || 0)}/unit
                          </span>
                        </div>
                      </td>

                      {/* Operator / CreatedBy */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                          <UserCheck className="w-3 h-3 text-slate-500" />
                          {mov.createdBy?.name || 'System'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Pagination Footer ────────────────────────────── */}
        {!loading && total > 0 && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-300">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-300">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-semibold text-slate-300">{total}</span> movements
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-3 py-1 text-xs font-semibold text-slate-300 bg-slate-800 rounded-lg border border-slate-700">
                Page {page} of {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
