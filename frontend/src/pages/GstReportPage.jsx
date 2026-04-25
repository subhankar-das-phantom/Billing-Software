import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  IndianRupee,
  Calendar,
  Search,
  X,
  XCircle,
  Filter,
  TrendingUp,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronRight,
  Package,
  Ban,
  Eye,
  EyeOff,
  ArrowRight,
  FileBarChart
} from 'lucide-react';
import { reportService } from '../services/reportService';
import { formatCurrency } from '../utils/formatters';

// ─── Animation variants ───────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────
const getDefaultDates = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(now.getDate()).padStart(2, '0')}`
  };
};

const SLAB_COLORS = {
  0:  { bg: 'from-slate-500/20 to-slate-600/20',  bar: 'from-slate-400 to-slate-500',  text: 'text-slate-300',  border: 'border-slate-600/30' },
  5:  { bg: 'from-emerald-500/20 to-teal-500/20', bar: 'from-emerald-400 to-teal-500', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  12: { bg: 'from-blue-500/20 to-indigo-500/20',  bar: 'from-blue-400 to-indigo-500',  text: 'text-blue-300',   border: 'border-blue-500/30' },
  18: { bg: 'from-amber-500/20 to-orange-500/20', bar: 'from-amber-400 to-orange-500', text: 'text-amber-300',  border: 'border-amber-500/30' },
  28: { bg: 'from-rose-500/20 to-pink-500/20',    bar: 'from-rose-400 to-pink-500',    text: 'text-rose-300',   border: 'border-rose-500/30' }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function GstReportPage() {
  const defaults = getDefaultDates();

  // ── State ──
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [excludedProducts, setExcludedProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  // ── Product search with debounce ──
  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await reportService.searchProducts(productSearch.trim());
        setSearchResults(data.products || []);
        setShowSearchDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimerRef.current);
  }, [productSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Add / remove excluded product ──
  const excludeProduct = useCallback((product) => {
    if (excludedProducts.some(p => p._id === product._id)) return;
    setExcludedProducts(prev => [...prev, product]);
    setProductSearch('');
    setShowSearchDropdown(false);
  }, [excludedProducts]);

  const removeExcluded = useCallback((productId) => {
    setExcludedProducts(prev => prev.filter(p => p._id !== productId));
  }, []);

  const clearAllExcluded = useCallback(() => {
    setExcludedProducts([]);
  }, []);

  // ── Generate report ──
  const generateReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);
    setHasGenerated(true);

    try {
      const data = await reportService.getGstReport({
        startDate,
        endDate,
        excludedProductIds: excludedProducts.map(p => p._id)
      });
      setReportData(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, excludedProducts]);

  // ── Derived data ──
  const slabEntries = reportData
    ? Object.entries(reportData.slabs)
        .map(([pct, val]) => ({ pct: Number(pct), sales: val.sales }))
        .sort((a, b) => a.pct - b.pct)
    : [];

  const maxSlabSales = slabEntries.reduce((max, s) => Math.max(max, s.sales), 0) || 1;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 sm:space-y-8"
    >
      {/* ─── HEADER ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card p-5 sm:p-8 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent border-indigo-500/20 relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              <FileBarChart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">GST Report</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Sales summary by GST slabs</p>
            </div>
          </div>
          {reportData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs sm:text-sm text-emerald-300 font-medium">Report Generated</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ─── FILTERS PANEL ─── */}
      <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6 relative z-10">
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">Report Filters</h2>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div>
            <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 font-medium">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input pl-10 text-sm"
                id="gst-start-date"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 font-medium">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input pl-10 text-sm"
                id="gst-end-date"
              />
            </div>
          </div>
        </div>

        {/* Product Exclusion */}
        <div className="mb-4 sm:mb-5">
          <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 font-medium">
            Exclude Products <span className="text-slate-600">(optional)</span>
          </label>
          <div className="relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />
            )}
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products to exclude..."
              className="input pl-10 pr-10 text-sm"
              id="gst-product-search"
            />

            {/* Search Dropdown */}
            <AnimatePresence>
              {showSearchDropdown && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  className="absolute z-30 left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 max-h-52 overflow-y-auto"
                >
                  {searchResults
                    .filter(p => !excludedProducts.some(ex => ex._id === p._id))
                    .map(product => (
                      <button
                        key={product._id}
                        onClick={() => excludeProduct(product)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/60 transition-colors text-left group"
                      >
                        <Package className="w-4 h-4 text-slate-500 group-hover:text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{product.productName}</p>
                          <p className="text-xs text-slate-500">
                            GST: {product.gstPercentage}% • HSN: {product.hsnCode}
                          </p>
                        </div>
                        <Ban className="w-3.5 h-3.5 text-slate-600 group-hover:text-red-400 flex-shrink-0" />
                      </button>
                    ))}
                  {searchResults.length > 0 &&
                    searchResults.every(p => excludedProducts.some(ex => ex._id === p._id)) && (
                      <p className="px-4 py-3 text-sm text-slate-500 text-center">All results already excluded</p>
                    )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Excluded Products Tags */}
        <AnimatePresence>
          {excludedProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 sm:mb-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm text-slate-400 font-medium">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold mr-1.5">
                    {excludedProducts.length}
                  </span>
                  product{excludedProducts.length > 1 ? 's' : ''} excluded
                </span>
                <button
                  onClick={clearAllExcluded}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {excludedProducts.map(product => (
                  <motion.span
                    key={product._id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs sm:text-sm text-red-300"
                  >
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{product.productName}</span>
                    <button
                      onClick={() => removeExcluded(product._id)}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate Button + Optional Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generateReport}
            disabled={loading || !startDate || !endDate}
            className="btn btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 sm:px-8"
            id="gst-generate-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4" />
                Generate Report
              </>
            )}
          </motion.button>

          <label className="flex items-center gap-2 cursor-pointer group px-1">
            <input
              type="checkbox"
              checked={showBreakdown}
              onChange={(e) => setShowBreakdown(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
              id="gst-breakdown-toggle"
            />
            <span className="text-xs sm:text-sm text-slate-400 group-hover:text-slate-300 transition-colors flex items-center gap-1.5">
              {showBreakdown ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Show GST Breakdown
            </span>
          </label>
        </div>
      </motion.div>

      {/* ─── LOADING STATE ─── */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card p-12 sm:p-16 flex flex-col items-center justify-center gap-4"
          >
            <div className="relative">
              <div className="w-12 h-12 sm:w-14 sm:h-14 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 w-12 h-12 sm:w-14 sm:h-14 border-4 border-transparent border-b-purple-500/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <p className="text-sm sm:text-base text-slate-400 font-medium">Crunching the numbers...</p>
          </motion.div>
        )}

        {/* ─── EMPTY / INITIAL STATE ─── */}
        {!loading && !hasGenerated && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card p-10 sm:p-16 flex flex-col items-center justify-center gap-4 text-center relative z-0"
          >
            <motion.div
              className="p-4 bg-indigo-500/10 rounded-2xl"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <FileBarChart className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
            </motion.div>
            <div>
              <p className="text-slate-300 font-medium text-sm sm:text-base">Select a date range and generate report</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Your GST sales summary will appear here</p>
            </div>
          </motion.div>
        )}

        {/* ─── ERROR STATE ─── */}
        {!loading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card p-8 sm:p-10 flex flex-col items-center justify-center gap-3 border-red-500/20 text-center"
          >
            <div className="p-3 bg-red-500/10 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-red-300 text-sm sm:text-base font-medium">{error}</p>
            <button
              onClick={generateReport}
              className="btn btn-secondary text-xs sm:text-sm"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* ─── REPORT DATA ─── */}
        {!loading && !error && reportData && (
          <motion.div
            key="data"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6 sm:space-y-8"
          >
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {/* Total Sales */}
              <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6 relative overflow-hidden group col-span-2 sm:col-span-1">
                <motion.div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">Total Sales</p>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                      <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    {formatCurrency(reportData.totalSales)}
                  </p>
                  {reportData.excludedSales > 0 && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      <span className="text-red-400">{formatCurrency(reportData.excludedSales)}</span> excluded
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Total Invoices */}
              <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6 relative overflow-hidden group">
                <motion.div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">Total Invoices</p>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-white">{reportData.stats.totalInvoices}</p>
                  {reportData.range?.minInvoice && (
                    <p className="text-xs text-slate-500 mt-1.5 truncate" title={`${reportData.range.minInvoice} → ${reportData.range.maxInvoice}`}>
                      {reportData.range.minInvoice} <ArrowRight className="inline w-3 h-3" /> {reportData.range.maxInvoice}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Cancelled */}
              <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6 relative overflow-hidden group">
                <motion.div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">Cancelled</p>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-white">{reportData.stats.cancelledInvoices}</p>
                </div>
              </motion.div>

              {/* Active */}
              <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6 relative overflow-hidden group">
                <motion.div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-violet-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">Active</p>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20">
                      <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-white">{reportData.stats.activeInvoices}</p>
                </div>
              </motion.div>
            </div>

            {/* GST SLAB TABLE */}
            <motion.div variants={itemVariants} className="glass-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">GST Slab Breakdown</h2>
                </div>
                {reportData.totalSales > 0 && (
                  <span className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                    Total: <span className="text-emerald-400 font-semibold">{formatCurrency(reportData.totalSales)}</span>
                  </span>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/30">
                      <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">GST Slab</th>
                      <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">Sales Distribution</th>
                      <th className="text-right px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">Sales Amount</th>
                      <th className="text-right px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slabEntries.map(({ pct, sales }, idx) => {
                      const colors = SLAB_COLORS[pct] || SLAB_COLORS[18];
                      const pctOfTotal = reportData.totalSales > 0 ? ((sales / reportData.totalSales) * 100) : 0;
                      const barWidth = maxSlabSales > 0 ? ((sales / maxSlabSales) * 100) : 0;

                      return (
                        <motion.tr
                          key={pct}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gradient-to-r ${colors.bg} ${colors.border}`}>
                              <span className={`text-sm font-bold ${colors.text}`}>{pct}%</span>
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-full bg-slate-800/60 rounded-full h-2.5 overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full bg-gradient-to-r ${colors.bar}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${barWidth}%` }}
                                transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm sm:text-base font-semibold text-white">{formatCurrency(sales)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-sm font-medium ${colors.text}`}>
                              {pctOfTotal.toFixed(1)}%
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/40">
                      <td className="px-6 py-4 font-semibold text-slate-300">Total</td>
                      <td className="px-6 py-4" />
                      <td className="px-6 py-4 text-right font-bold text-lg text-emerald-400">
                        {formatCurrency(reportData.totalSales)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-300">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden p-3 space-y-3">
                {slabEntries.map(({ pct, sales }, idx) => {
                  const colors = SLAB_COLORS[pct] || SLAB_COLORS[18];
                  const pctOfTotal = reportData.totalSales > 0 ? ((sales / reportData.totalSales) * 100) : 0;
                  const barWidth = maxSlabSales > 0 ? ((sales / maxSlabSales) * 100) : 0;

                  return (
                    <motion.div
                      key={pct}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-3.5 rounded-xl border bg-gradient-to-r ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-bold ${colors.text}`}>GST {pct}%</span>
                        <span className={`text-xs font-medium ${colors.text}`}>{pctOfTotal.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden mb-2">
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${colors.bar}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.08, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="text-base font-bold text-white">{formatCurrency(sales)}</p>
                    </motion.div>
                  );
                })}

                {/* Mobile Total */}
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">Total Sales</span>
                    <span className="text-base font-bold text-emerald-400">{formatCurrency(reportData.totalSales)}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* GST BREAKDOWN (Optional Toggle) */}
            <AnimatePresence>
              {showBreakdown && (
                <motion.div
                  variants={itemVariants}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass-card overflow-hidden"
                >
                  <div className="p-4 sm:p-6 border-b border-slate-700/50 bg-slate-800/30 flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-white">CGST / SGST Breakdown</h2>
                  </div>

                  {/* Desktop */}
                  <div className="hidden sm:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/30">
                          <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">GST Slab</th>
                          <th className="text-right px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">CGST</th>
                          <th className="text-right px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">SGST</th>
                          <th className="text-right px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">Total GST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slabEntries.map(({ pct, sales }) => {
                          const colors = SLAB_COLORS[pct] || SLAB_COLORS[18];
                          // Estimate: sales = taxableAmount + gstAmount
                          // taxableAmount = sales / (1 + pct/100), gstAmount = sales - taxableAmount
                          const taxable = pct > 0 ? sales / (1 + pct / 100) : sales;
                          const gstAmount = sales - taxable;
                          const half = gstAmount / 2;

                          return (
                            <tr key={pct} className="border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors">
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-lg border bg-gradient-to-r ${colors.bg} ${colors.border}`}>
                                  <span className={`text-sm font-bold ${colors.text}`}>{pct}%</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-slate-300">
                                {formatCurrency(half)} <span className="text-xs text-slate-600">({pct / 2}%)</span>
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-slate-300">
                                {formatCurrency(half)} <span className="text-xs text-slate-600">({pct / 2}%)</span>
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-semibold text-white">
                                {formatCurrency(gstAmount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="sm:hidden p-3 space-y-3">
                    {slabEntries.map(({ pct, sales }) => {
                      const colors = SLAB_COLORS[pct] || SLAB_COLORS[18];
                      const taxable = pct > 0 ? sales / (1 + pct / 100) : sales;
                      const gstAmount = sales - taxable;
                      const half = gstAmount / 2;

                      return (
                        <div key={pct} className={`p-3.5 rounded-xl border bg-gradient-to-r ${colors.bg} ${colors.border}`}>
                          <p className={`text-sm font-bold ${colors.text} mb-2`}>GST {pct}%</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-slate-500 mb-0.5">CGST ({pct / 2}%)</p>
                              <p className="text-slate-200 font-medium">{formatCurrency(half)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-0.5">SGST ({pct / 2}%)</p>
                              <p className="text-slate-200 font-medium">{formatCurrency(half)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-0.5">Total GST</p>
                              <p className="text-white font-bold">{formatCurrency(gstAmount)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-4 sm:px-6 py-3 bg-slate-800/20 border-t border-slate-700/30">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      CGST/SGST split is estimated from slab sales. For precise values, use item-level data.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* NO DATA STATE (has generated but zero invoices) */}
            {reportData.stats.totalInvoices === 0 && (
              <motion.div
                variants={itemVariants}
                className="glass-card p-10 sm:p-14 flex flex-col items-center justify-center gap-4 text-center"
              >
                <div className="p-4 bg-slate-700/30 rounded-2xl">
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium text-sm sm:text-base">No invoices found</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Try adjusting the date range</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
