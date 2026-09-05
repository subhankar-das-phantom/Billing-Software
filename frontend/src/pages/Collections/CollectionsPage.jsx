import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Banknote,
  CreditCard,
  Hash,
  Calendar,
  User,
  Phone,
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
  Download,
  Printer,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  RotateCcw,
  ArrowUpRight,
  Eye
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency, formatDate, formatPaymentTime, formatPhone } from '../../utils/formatters';
import { useSWR, useMediaQuery, useDebounce, invalidateCachePattern } from '../../hooks';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionsTableSkeleton } from './CollectionsPageSkeleton';
import RecordPaymentModal from '../../components/Common/Modals/RecordPaymentModal';
import PaymentReceiptModal from '../../components/Common/Modals/PaymentReceiptModal';
import DailyCloseoutPrintModal from './DailyCloseoutPrintModal';
import ExportModal from '../../components/Common/Modals/ExportModal';

const CANONICAL_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'];

const METHOD_ICONS = {
  'Cash': Banknote,
  'UPI': Smartphone,
  'Bank Transfer': Building2,
  'Cheque': FileText,
  'NEFT/RTGS': Building2
};

const METHOD_PILL_STYLES = {
  'Cash': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  'UPI': 'bg-sky-500/10 border-sky-500/30 text-sky-400',
  'Bank Transfer': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  'Cheque': 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  'NEFT/RTGS': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
};

const METHOD_BAR_COLORS = {
  'Cash': 'bg-emerald-500',
  'UPI': 'bg-sky-400',
  'Bank Transfer': 'bg-indigo-500',
  'Cheque': 'bg-amber-500',
  'NEFT/RTGS': 'bg-cyan-400'
};

// Helper: Format date in Indian Standard Time (YYYY-MM-DD)
const getISTDateStr = (daysAgo = 0) => {
  const d = new Date();
  if (daysAgo !== 0) d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
};

/**
 * Mobile-aware horizontal scroll container with visual edge fade and chevron affordance hints.
 * Automatically displays smooth edge gradients and micro-chevrons on mobile when content overflows,
 * cleanly disappearing on desktop where items wrap (sm:flex-wrap).
 */
function ScrollAffordanceContainer({ children, className = '' }) {
  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeft(scrollLeft > 6);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 8);
  }, []);

  const handleScroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = Math.max(160, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(el);

    window.addEventListener('resize', checkScroll);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  return (
    <div className="relative min-w-0">
      {/* Left Clickable Arrow with Gradient Edge Fade */}
      {showLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-9 bg-gradient-to-r from-slate-900 via-slate-900/95 to-transparent flex items-center justify-start pl-0.5 z-10">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="pointer-events-auto w-6 h-6 rounded-full bg-slate-800/95 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 shadow-md shadow-black/50 flex items-center justify-center active:scale-90 transition-all"
            title="Scroll left"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={className}
      >
        {children}
      </div>

      {/* Right Clickable Arrow with Gradient Edge Fade */}
      {showRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-9 bg-gradient-to-l from-slate-900 via-slate-900/95 to-transparent flex items-center justify-end pr-0.5 z-10">
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="pointer-events-auto w-6 h-6 rounded-full bg-slate-800/95 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 shadow-md shadow-black/50 flex items-center justify-center active:scale-90 transition-all"
            title="Scroll right"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function CollectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error } = useToast();
  const { admin } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const searchInputRef = useRef(null);

  // Filter States
  const [datePreset, setDatePreset] = useState('today'); // 'today' | 'yesterday' | 'last7Days' | 'thisMonth' | 'custom'
  const [selectedDate, setSelectedDate] = useState(getISTDateStr(0));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);

  // Modal States
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null);
  const [showCloseoutModal, setShowCloseoutModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedUtrId, setCopiedUtrId] = useState(null);

  // Keyboard shortcut: Press '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Preset date selection handler
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    setPage(1);

    const todayStr = getISTDateStr(0);
    if (preset === 'today') {
      setSelectedDate(todayStr);
      setStartDate('');
      setEndDate('');
    } else if (preset === 'yesterday') {
      setSelectedDate(getISTDateStr(1));
      setStartDate('');
      setEndDate('');
    } else if (preset === 'last7Days') {
      setSelectedDate('');
      setStartDate(getISTDateStr(6));
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setSelectedDate('');
      setStartDate(monthStart);
      setEndDate(todayStr);
    } else if (preset === 'custom') {
      setSelectedDate('');
      if (!startDate) setStartDate(getISTDateStr(7));
      if (!endDate) setEndDate(todayStr);
    }
  };

  // Reset pagination on filter or search changes
  useEffect(() => {
    setPage(1);
  }, [datePreset, selectedDate, startDate, endDate, selectedMethod, debouncedSearch]);

  // Construct SWR cache key and query parameters
  const activeSearch = debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : '';

  const queryParams = useMemo(() => {
    const params = { page, limit: 50 };
    if (datePreset === 'today' || datePreset === 'yesterday') {
      params.date = selectedDate;
    } else if (startDate || endDate) {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    } else if (selectedDate) {
      params.date = selectedDate;
    }

    if (selectedMethod) params.paymentMethod = selectedMethod;
    if (activeSearch) params.search = activeSearch;

    return params;
  }, [page, datePreset, selectedDate, startDate, endDate, selectedMethod, activeSearch]);

  // SWR query with AbortController support
  const { data: swrData, isLoading, isValidating, revalidate } = useSWR(
    `collections-${JSON.stringify(queryParams)}`,
    async () => {
      const res = await api.get('/payments/collections', { params: queryParams });
      return res.data;
    },
    { ttl: 3 * 60 * 1000 }
  );

  // Auto-open record modal if ?action=record
  useEffect(() => {
    if (searchParams.get('action') === 'record') {
      setShowRecordModal(true);
      setSearchParams((prev) => {
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
    success('Payment recorded successfully');
  };

  const data = swrData || { summary: null, payments: [], total: 0, pages: 1 };
  const loading = isLoading && !swrData;

  // Compute readable Date Label
  const dateLabel = useMemo(() => {
    if (datePreset === 'today') return `Today (${formatDate(getISTDateStr(0))})`;
    if (datePreset === 'yesterday') return `Yesterday (${formatDate(getISTDateStr(1))})`;
    if (datePreset === 'last7Days') return `Last 7 Days (${formatDate(startDate)} - ${formatDate(endDate)})`;
    if (datePreset === 'thisMonth') return `This Month (${formatDate(startDate)} - ${formatDate(endDate)})`;
    if (datePreset === 'custom' && startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    return selectedDate ? formatDate(selectedDate) : 'Selected Period';
  }, [datePreset, selectedDate, startDate, endDate]);

  // Summary Metrics (Dataset Totals)
  const totalCollected = data.summary?.totalCollected || 0;
  const paymentCount = data.summary?.paymentCount || 0;
  const cashCollected = data.summary?.cashCollected || 0;
  const cashCount = data.summary?.cashCount || 0;
  const nonCashCollected = data.summary?.nonCashCollected || 0;
  const nonCashCount = data.summary?.nonCashCount || 0;
  const averageTicketSize = paymentCount > 0 ? totalCollected / paymentCount : 0;

  const cashShare = totalCollected > 0 ? ((cashCollected / totalCollected) * 100).toFixed(1) : '0.0';
  const nonCashShare = totalCollected > 0 ? ((nonCashCollected / totalCollected) * 100).toFixed(1) : '0.0';

  // Method distribution breakdown (using dataset byMethod)
  const methodDistribution = useMemo(() => {
    const rawByMethod = data.summary?.byMethod || {};
    return CANONICAL_METHODS.map((method) => {
      const info = rawByMethod[method] || { count: 0, total: 0 };
      const share = totalCollected > 0 ? (info.total / totalCollected) * 100 : 0;
      return {
        method,
        total: info.total,
        count: info.count,
        share: parseFloat(share.toFixed(1)),
        icon: METHOD_ICONS[method] || CreditCard,
        badgeStyle: METHOD_PILL_STYLES[method] || 'bg-slate-700/20 text-slate-300 border-slate-600',
        barColor: METHOD_BAR_COLORS[method] || 'bg-slate-500'
      };
    }).sort((a, b) => b.total - a.total);
  }, [data.summary?.byMethod, totalCollected]);

  // Top payment method
  const topMethod = useMemo(() => {
    if (!methodDistribution || methodDistribution.length === 0) return null;
    const top = methodDistribution[0];
    return top.total > 0 ? top : null;
  }, [methodDistribution]);

  // Visible / Filtered Table Totals (computed over visible page records)
  const visibleTotals = useMemo(() => {
    let sum = 0;
    let cashSum = 0;
    let nonCashSum = 0;
    for (const p of data.payments) {
      sum += p.amount;
      if (p.paymentMethod === 'Cash') cashSum += p.amount;
      else nonCashSum += p.amount;
    }
    return {
      count: data.payments.length,
      total: sum,
      cashSum,
      nonCashSum
    };
  }, [data.payments]);

  // Has transient active filters
  const hasActiveFilters = Boolean(selectedMethod || activeSearch || (datePreset === 'custom'));
  // Active filter differs from dataset scope
  const isFilteredFromDataset = Boolean(selectedMethod || activeSearch);

  // Reset all filters to default Today
  const handleResetFilters = () => {
    setDatePreset('today');
    setSelectedDate(getISTDateStr(0));
    setStartDate('');
    setEndDate('');
    setSelectedMethod('');
    setSearchInput('');
    setPage(1);
  };

  // Copy Reference / UTR
  const handleCopyUtr = (referenceNumber, id) => {
    if (!referenceNumber) return;
    navigator.clipboard.writeText(referenceNumber);
    setCopiedUtrId(id);
    success('Reference / UTR copied to clipboard');
    setTimeout(() => setCopiedUtrId(null), 2000);
  };

  // Operational Cashier Attribution Renderer
  const renderRecordedBy = (recordedBy) => {
    if (!recordedBy) {
      return (
        <div className="flex items-center gap-1.5" title="Admin">
          <span className="text-xs text-white font-medium">Admin</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded border bg-purple-500/10 text-purple-300 border-purple-500/30 uppercase font-mono shrink-0">
            Admin
          </span>
        </div>
      );
    }

    let name = '';
    let role = recordedBy.role || 'Staff';
    let email = recordedBy.email || '';

    if (typeof recordedBy === 'string') {
      if (recordedBy.includes('@')) {
        email = recordedBy;
        name = recordedBy.split('@')[0]; // Last-resort legacy fallback
      } else {
        name = recordedBy;
      }
    } else if (typeof recordedBy === 'object') {
      if (recordedBy.name && recordedBy.name.trim()) {
        name = recordedBy.name.trim();
      } else if (recordedBy.email && recordedBy.email.trim()) {
        email = recordedBy.email.trim();
        name = email.split('@')[0]; // Last-resort legacy fallback
      } else {
        name = role === 'Admin' ? 'Admin' : 'Staff';
      }
    }

    const isRoleAdmin = role.toLowerCase() === 'admin';

    return (
      <div className="flex items-center gap-1.5" title={email ? `${name} (${email})` : name}>
        <span className="text-xs text-white font-medium truncate max-w-[110px]">{name}</span>
        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono uppercase shrink-0 ${
          isRoleAdmin
            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
            : 'bg-slate-800 text-slate-400 border-slate-700/60'
        }`}>
          {isRoleAdmin ? 'Admin' : 'Staff'}
        </span>
      </div>
    );
  };

  // Export handler targeting Shared Export Engine (/api/payments/export)
  const handleExport = async ({ format, dateRange }) => {
    setIsExporting(true);
    try {
      const params = { format };

      if (dateRange?.preset === 'all') {
        params.isAllTime = 'true';
      } else if (dateRange?.startDate || dateRange?.endDate) {
        if (dateRange.startDate && dateRange.startDate === dateRange.endDate) {
          params.date = dateRange.startDate;
        } else {
          if (dateRange.startDate) params.startDate = dateRange.startDate;
          if (dateRange.endDate) params.endDate = dateRange.endDate;
        }
      } else {
        if (datePreset === 'today' || datePreset === 'yesterday') {
          params.date = selectedDate;
        } else if (startDate || endDate) {
          if (startDate) params.startDate = startDate;
          if (endDate) params.endDate = endDate;
        } else if (selectedDate) {
          params.date = selectedDate;
        }
      }

      if (selectedMethod) params.paymentMethod = selectedMethod;
      if (activeSearch) params.search = activeSearch;

      const response = await api.get('/payments/export', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'pdf' ? 'pdf' : (format === 'csv' ? 'csv' : 'xlsx');
      link.download = `collections_export_${getISTDateStr(0)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setShowExportModal(false);
      success(`Successfully exported collections as ${format.toUpperCase()}`);
    } catch (err) {
      let errMsg = 'Failed to export collections';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.message) errMsg = json.message;
        } catch {
          // fallback
        }
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      } else if (err.message) {
        errMsg = err.message;
      }
      error(errMsg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* On-Screen Collections Interface (strictly hidden on print) */}
      <div className="space-y-4 no-print">
        {/* Executive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  Collections
                  {isValidating && !loading && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Updating..." />
                  )}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daily cash flow, digital receipts, and cashier register reconciliation
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Suite */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {/* Export Button (Shared Export Modal) */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-800 text-xs font-semibold transition-colors min-h-[38px]"
              id="collections-export-btn"
            >
              <Download className="w-4 h-4 text-slate-400" />
              Export
            </button>

            {/* Daily Closeout & Print Button */}
            <button
              type="button"
              onClick={() => setShowCloseoutModal(true)}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl border border-slate-700 text-xs font-semibold transition-colors min-h-[38px]"
              id="collections-closeout-btn"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              Daily Closeout & Print
            </button>

            {/* Record Payment Button */}
            <button
              type="button"
              onClick={() => setShowRecordModal(true)}
              className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 min-h-[38px]"
              id="record-payment-header-btn"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          </div>
        </div>

        {/* High-Density KPI Strip (Dataset Totals) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Total Collections */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Collections
              </span>
              <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight truncate">
              {loading ? '...' : formatCurrency(totalCollected)}
            </p>
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800 font-mono">
              <span>{loading ? '...' : `${paymentCount} receipts`}</span>
              <span className="text-slate-300 font-sans truncate max-w-[80px] sm:max-w-[120px]">{dateLabel}</span>
            </div>
          </div>

          {/* Card 2: Cash Collections */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Cash Collections
              </span>
              <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Banknote className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-emerald-400 font-mono tracking-tight truncate">
              {loading ? '...' : formatCurrency(cashCollected)}
            </p>
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800 font-mono">
              <span>{loading ? '...' : `${cashCount} cash`}</span>
              <span className="text-emerald-400 font-semibold">{loading ? '...' : `${cashShare}%`}</span>
            </div>
          </div>

          {/* Card 3: Non-Cash Collections */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Non-Cash Collections
              </span>
              <div className="p-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-sky-400 font-mono tracking-tight truncate">
              {loading ? '...' : formatCurrency(nonCashCollected)}
            </p>
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800 font-mono">
              <span>{loading ? '...' : `${nonCashCount} digital`}</span>
              <span className="text-sky-400 font-semibold">{loading ? '...' : `${nonCashShare}%`}</span>
            </div>
          </div>

          {/* Card 4: Average Receipt */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Average Receipt
              </span>
              <div className="p-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight truncate">
              {loading ? '...' : formatCurrency(averageTicketSize)}
            </p>
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800">
              <span>Top:</span>
              <span className="text-white font-semibold truncate max-w-[80px] sm:max-w-[120px]">
                {loading ? '...' : (topMethod ? topMethod.method : 'None')}
              </span>
            </div>
          </div>
        </div>

        {/* Refactored Payment Channel Allocation Strip (Slim Profile) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Payment Channel Allocation
              </h2>
              <span className="text-[11px] text-slate-500 hidden sm:inline">· Click channel to filter</span>
            </div>
            {topMethod ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium self-start sm:self-auto">
                Leading: <strong className="text-white">{topMethod.method}</strong> ({topMethod.share}%)
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 font-medium self-start sm:self-auto">
                No active volume
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {/* Segmented Volume Distribution Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
              {totalCollected > 0 ? (
                methodDistribution.map((item) => (
                  <div
                    key={item.method}
                    style={{ width: `${item.share}%` }}
                    className={`${item.barColor} h-full transition-all duration-300`}
                    title={`${item.method}: ${formatCurrency(item.total)} (${item.share}%)`}
                  />
                ))
              ) : (
                <div className="w-full h-full bg-slate-800/80" />
              )}
            </div>

            {/* Interactive Channel Selector Pills - Always Accessible */}
            <ScrollAffordanceContainer className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible pb-0.5 pt-0.5 pr-6 sm:pr-0">
              <button
                type="button"
                onClick={() => setSelectedMethod('')}
                className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 shrink-0 ${
                  !selectedMethod
                    ? 'bg-slate-800 text-white border-slate-600 shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <span>All Channels</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                  {paymentCount}
                </span>
              </button>

              {methodDistribution.map((item) => {
                const MethodIcon = item.icon;
                const isSelected = selectedMethod === item.method;
                return (
                  <button
                    key={item.method}
                    type="button"
                    onClick={() => setSelectedMethod(isSelected ? '' : item.method)}
                    className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? `${item.badgeStyle} ring-1 ring-white/20 shadow-sm font-semibold`
                        : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <MethodIcon className="w-3 h-3" />
                    <span>{item.method}</span>
                    <span className="font-mono text-[11px] text-slate-300">
                      {formatCurrency(item.total)}
                    </span>
                    <span className="text-[10px] opacity-75 font-mono px-1 py-0.2 rounded bg-black/40">
                      {item.share}%
                    </span>
                  </button>
                );
              })}
            </ScrollAffordanceContainer>
          </div>
        </div>

        {/* Enterprise Filter & Search Suite */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            {/* Segmented Date Presets */}
            <ScrollAffordanceContainer className="flex items-center gap-1 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible pb-1 lg:pb-0 pr-6 sm:pr-0">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'last7Days', label: 'Last 7 Days' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'custom', label: 'Custom Range' }
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    datePreset === preset.id
                      ? 'bg-slate-800 text-white border-slate-600 shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </ScrollAffordanceContainer>

            {/* Search Input with Debounce & Clear */}
            <div className="flex items-center gap-2 flex-1 lg:max-w-md w-full">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search customer, phone, invoice, or UTR... ( / )"
                  className="w-full pl-9 pr-8 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors"
                  id="collections-search-input"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="p-1 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:bg-slate-800 transition-colors shrink-0"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Custom Range Date Pickers (visible only when datePreset is 'custom') */}
          {datePreset === 'custom' && (
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <span className="text-slate-400 shrink-0">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 sm:py-1 text-xs text-white focus:outline-none focus:border-slate-600"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <span className="text-slate-400 shrink-0">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 sm:py-1 text-xs text-white focus:outline-none focus:border-slate-600"
                />
              </div>
            </div>
          )}

          {/* Filter Feedback Bar */}
          {hasActiveFilters && (
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <div>
                <span>Showing </span>
                <strong className="text-white font-mono">{visibleTotals.count}</strong>
                <span> of </span>
                <strong className="text-white font-mono">{data.total}</strong>
                <span> receipts</span>
                {isFilteredFromDataset && (
                  <>
                    <span> · Filtered Total: </span>
                    <strong className="text-emerald-400 font-mono">{formatCurrency(visibleTotals.total)}</strong>
                    <span> (of {formatCurrency(totalCollected)} dataset total)</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Operational Ledger Surface */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Collections Ledger</h2>
              {!loading && (
                <span className="text-xs text-slate-400 font-mono ml-1.5">
                  ({data.total} {data.total === 1 ? 'record' : 'records'})
                </span>
              )}
            </div>

            {/* Operational Context Subtitle */}
            {!loading && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>
                  {data.total} {data.total === 1 ? 'receipt' : 'receipts'} · {datePreset === 'today' ? 'Today' : dateLabel} · {selectedMethod || 'All Channels'}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 font-mono font-medium">
                  Showing {visibleTotals.count} of {data.total}
                </span>
                {isFilteredFromDataset && (
                  <>
                    <span className="text-slate-600">|</span>
                    <span className="text-amber-400 font-mono font-medium">
                      Filtered {formatCurrency(visibleTotals.total)} of {formatCurrency(totalCollected)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <CollectionsTableSkeleton />
          ) : data.payments.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-3 text-slate-400">
                <Banknote className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-white">No collections found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No payments match your current search and filter criteria. Try adjusting filters.'
                  : `No payments recorded for ${dateLabel}. Click below to record a customer payment.`}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRecordModal(true)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Record Payment
                </button>
              </div>
            </div>
          ) : isDesktop ? (
            /* Desktop High-Density Table */
            <div className="table-container">
              <table className="table" id="collections-table">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Time & Date
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Invoice / Settlement
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Payment Channel
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Reference / UTR
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Recorded By
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.payments.map((payment) => {
                    const MethodIcon = METHOD_ICONS[payment.paymentMethod] || CreditCard;
                    const methodPill = METHOD_PILL_STYLES[payment.paymentMethod] || 'bg-slate-800 text-slate-300 border-slate-700';

                    const timeStr = formatPaymentTime(payment);
                    const dateStr = payment.paymentDate ? formatDate(payment.paymentDate) : '-';

                    return (
                      <tr key={payment.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Time & Date */}
                        <td className="text-left px-4 py-2.5 whitespace-nowrap">
                          <div className="text-xs text-white font-mono font-medium">{timeStr}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{dateStr}</div>
                        </td>

                        {/* Customer */}
                        <td className="text-left px-4 py-2.5">
                          <div className="font-semibold text-white text-xs truncate max-w-[160px]">
                            {payment.customer?.id ? (
                              <Link
                                to={`/customers/${payment.customer.id}`}
                                className="hover:text-emerald-400 hover:underline transition-colors"
                              >
                                {payment.customer.name}
                              </Link>
                            ) : (
                              payment.customer?.name || 'Walk-in Customer'
                            )}
                          </div>
                          {payment.customer?.phone ? (
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {formatPhone(payment.customer.phone, { countryCode: false })}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">—</div>
                          )}
                        </td>

                        {/* Invoice / Settlement */}
                        <td className="text-left px-4 py-2.5">
                          {payment.invoice ? (
                            <Link
                              to={`/invoices/${payment.invoice.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline font-mono"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {payment.invoice.invoiceNumber || 'Invoice'}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                              {payment.entryType ? 'Manual Adjustment' : 'On-Account'}
                            </span>
                          )}
                        </td>

                        {/* Payment Channel */}
                        <td className="text-left px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-lg border font-medium ${methodPill}`}>
                            <MethodIcon className="w-3.5 h-3.5" />
                            {payment.paymentMethod || 'Cash'}
                          </span>
                        </td>

                        {/* Reference / UTR */}
                        <td className="text-left px-4 py-2.5">
                          {payment.referenceNumber ? (
                            <div className="flex items-center gap-1.5 max-w-[140px]" title={payment.referenceNumber}>
                              <span className="font-mono text-xs text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate tracking-tight">
                                {payment.referenceNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyUtr(payment.referenceNumber, payment.id)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                                title="Copy Reference"
                              >
                                {copiedUtrId === payment.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="text-right px-4 py-2.5">
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            {formatCurrency(payment.amount)}
                          </span>
                        </td>

                        {/* Recorded By */}
                        <td className="text-left px-4 py-2.5">
                          {renderRecordedBy(payment.recordedBy)}
                        </td>

                        {/* Actions */}
                        <td className="text-right px-4 py-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceiptPayment(payment);
                              setShowReceiptModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                            title="View Receipt Slip"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Sticky Table Totals Footer */}
                <tfoot>
                  <tr className="bg-slate-950/80 border-t-2 border-slate-700/80 font-mono text-xs">
                    <td colSpan={5} className="py-2.5 px-4 text-left font-sans font-semibold text-slate-300">
                      Visible Page Totals ({visibleTotals.count} receipts):
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-sm text-emerald-400 font-mono">
                      {formatCurrency(visibleTotals.total)}
                    </td>
                    <td colSpan={2} className="py-2.5 px-4 text-right font-sans text-slate-400 text-[11px]">
                      Cash: {formatCurrency(visibleTotals.cashSum)} · Non-Cash: {formatCurrency(visibleTotals.nonCashSum)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            /* Mobile Card View */
            <div className="divide-y divide-slate-800/80">
              {data.payments.map((payment) => {
                const MethodIcon = METHOD_ICONS[payment.paymentMethod] || CreditCard;
                const methodPill = METHOD_PILL_STYLES[payment.paymentMethod] || 'bg-slate-800 text-slate-300 border-slate-700';

                return (
                  <div key={payment.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {payment.customer?.name || 'Walk-in Customer'}
                        </div>
                        {payment.customer?.phone && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {formatPhone(payment.customer.phone, { countryCode: false })}
                          </div>
                        )}
                      </div>
                      <span className="text-lg font-bold text-emerald-400 font-mono">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] ${methodPill}`}>
                        <MethodIcon className="w-3 h-3" />
                        {payment.paymentMethod}
                      </span>

                      {payment.invoice ? (
                        <Link
                          to={`/invoices/${payment.invoice.id}`}
                          className="text-blue-400 hover:underline font-mono"
                        >
                          {payment.invoice.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Manual Entry</span>
                      )}
                    </div>

                    {payment.referenceNumber && (
                      <div className="text-xs text-slate-300 font-mono flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                        <span className="truncate max-w-[200px]" title={payment.referenceNumber}>
                          Ref: {payment.referenceNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyUtr(payment.referenceNumber, payment.id)}
                          className="text-slate-400 hover:text-white shrink-0 ml-2"
                        >
                          {copiedUtrId === payment.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {formatPaymentTime(payment)} · {payment.paymentDate ? formatDate(payment.paymentDate) : ''}
                        </span>
                        <span className="text-slate-600">·</span>
                        {renderRecordedBy(payment.recordedBy)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReceiptPayment(payment);
                          setShowReceiptModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-medium border border-slate-700"
                      >
                        Receipt
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Totals Summary Bar */}
              <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-300 font-medium">Page Totals</span>
                  <span className="text-slate-500 font-mono text-[11px] ml-1.5">({visibleTotals.count} receipts)</span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Cash: {formatCurrency(visibleTotals.cashSum)} · Non-Cash: {formatCurrency(visibleTotals.nonCashSum)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {formatCurrency(visibleTotals.total)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Numbered Pagination */}
          {data.pages > 1 && (
            <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs">
              <p className="text-slate-400 font-mono">
                Page <strong className="text-white">{data.page}</strong> of <strong className="text-white">{data.pages}</strong> ({data.total} items)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-400 font-mono px-2">
                  {page} / {data.pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSuccess={handlePaymentRecorded}
      />

      {/* Payment Receipt Voucher Modal */}
      <PaymentReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedReceiptPayment(null);
        }}
        payment={selectedReceiptPayment}
      />

      {/* Daily Cashier Closeout & Print Modal */}
      <DailyCloseoutPrintModal
        isOpen={showCloseoutModal}
        onClose={() => setShowCloseoutModal(false)}
        dateLabel={dateLabel}
        summary={data.summary}
        payments={data.payments}
      />

      {/* Shared Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          if (!isExporting) setShowExportModal(false);
        }}
        onExport={handleExport}
        entityType="collections"
        isExporting={isExporting}
        showDateRange={true}
        defaultPreset={datePreset}
        initialDateRange={
          datePreset === 'today'
            ? { startDate: selectedDate || getISTDateStr(0), endDate: selectedDate || getISTDateStr(0), preset: 'today' }
            : datePreset === 'yesterday'
            ? { startDate: selectedDate || getISTDateStr(1), endDate: selectedDate || getISTDateStr(1), preset: 'yesterday' }
            : datePreset === 'last7Days'
            ? { startDate: startDate || getISTDateStr(6), endDate: endDate || getISTDateStr(0), preset: 'last7Days' }
            : datePreset === 'thisMonth' || datePreset === 'custom'
            ? { startDate: startDate || '', endDate: endDate || '', preset: datePreset }
            : undefined
        }
      />
    </div>
  );
}
