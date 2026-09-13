import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  User,
  FileText,
  Wallet,
  Package,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  Activity,
  LogIn,
  LogOut as LogOutIcon,
  Search,
  X,
  TrendingUp
} from 'lucide-react';
import { employeeService } from '../../services/employees/employeeService';
import { useMotionConfig, useFirstVisit, useDebounce } from '../../hooks';
import { ActivityLogPageSkeleton } from './ActivityLogPageSkeleton';
import { VirtualizedList } from '../../components/Common/VirtualizedList';

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

// Format time
const formatTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format date and time
const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format duration
const formatDuration = (minutes) => {
  if (!minutes) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Session Card Component - Mobile optimized & Bounded activity list
const SessionCard = ({ entry, isMobile, isFirstVisit }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'invoices' | 'payments' | 'products'
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showAllProductsAdded, setShowAllProductsAdded] = useState(false);
  const [showAllProductsUpdated, setShowAllProductsUpdated] = useState(false);

  const { session, employee, activities, summary } = entry;

  const DEFAULT_DISPLAY_LIMIT = 5;
  const DEFAULT_PRODUCT_LIMIT = 8;

  // Recalibrate virtualizer offsets when accordion toggles or inner lists expand
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 220);
    return () => clearTimeout(timer);
  }, [expanded, showAllInvoices, showAllPayments, showAllProductsAdded, showAllProductsUpdated, activeTab]);

  const totalProducts = (activities.productsAdded?.length || 0) + (activities.productsUpdated?.length || 0);
  const hasActivities = summary.invoiceCount > 0 || summary.paymentCount > 0 || totalProducts > 0;

  const visibleInvoices = showAllInvoices 
    ? activities.invoicesCreated 
    : activities.invoicesCreated.slice(0, DEFAULT_DISPLAY_LIMIT);

  const visiblePayments = showAllPayments 
    ? activities.paymentsRecorded 
    : activities.paymentsRecorded.slice(0, DEFAULT_DISPLAY_LIMIT);

  const visibleProductsAdded = showAllProductsAdded
    ? activities.productsAdded
    : activities.productsAdded.slice(0, DEFAULT_PRODUCT_LIMIT);

  const visibleProductsUpdated = showAllProductsUpdated
    ? activities.productsUpdated
    : activities.productsUpdated.slice(0, DEFAULT_PRODUCT_LIMIT);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-colors">
      {/* Header - Always visible */}
      <div 
        className={`p-4 ${hasActivities ? 'cursor-pointer' : ''}`}
        onClick={() => hasActivities && setExpanded(!expanded)}
      >
        {/* Top row: Employee + Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Employee Avatar */}
            <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shrink-0">
              {employee.name?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">{employee.name}</h3>
              <p className="text-xs text-slate-400 truncate">{employee.email}</p>
            </div>
          </div>

          {/* Duration Badge */}
          <div className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium shrink-0 ${
            session?.isActive 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : session
                ? 'bg-slate-800 text-slate-300 border border-slate-700/60'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {session ? (
              session.isActive ? (
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-mono">
                  <Clock size={13} />
                  {formatDuration(session.duration)}
                </span>
              )
            ) : (
              <span className="flex items-center gap-1.5">
                <Activity size={13} />
                Direct Activity
              </span>
            )}
          </div>
        </div>

        {/* Time row */}
        <div className="flex items-center gap-4 text-xs sm:text-sm mb-3 pl-1 text-slate-300">
          {session ? (
            <>
              <div className="flex items-center gap-2">
                <LogIn size={14} className="text-emerald-400 shrink-0" />
                <span className="font-mono">{formatDateTime(session.loginTime)}</span>
              </div>
              {session.logoutTime && (
                <div className="flex items-center gap-2">
                  <LogOutIcon size={14} className="text-rose-400 shrink-0" />
                  <span className="font-mono text-slate-400">{formatTime(session.logoutTime)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Activity size={14} className="text-blue-400 shrink-0" />
              <span>Authenticated work without separate login session</span>
            </div>
          )}
        </div>

        {/* Quick Summary - Stats row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <FileText size={13} className="text-blue-400" />
            <span className="text-blue-300 font-mono font-medium">{summary.invoiceCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Wallet size={13} className="text-emerald-400" />
            <span className="text-emerald-300 font-mono font-medium">{summary.paymentCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Package size={13} className="text-amber-400" />
            <span className="text-amber-300 font-mono font-medium">{totalProducts}</span>
          </div>
          {summary.totalSales > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <TrendingUp size={13} className="text-emerald-400" />
              <span className="text-emerald-300 font-mono font-medium">{formatCurrency(summary.totalSales)}</span>
            </div>
          )}
          
          {/* Expand Icon */}
          {hasActivities && (
            <button 
              type="button"
              className="ml-auto p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label={expanded ? 'Collapse session details' : 'Expand session details'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && hasActivities && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-800/80 bg-slate-950/40"
          >
            <div className="p-4 space-y-4">
              {/* Category Filter Tabs (Quick jump for high-density sessions) */}
              <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-800/80 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  All
                </button>
                {activities.invoicesCreated.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('invoices')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'invoices'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <FileText size={12} />
                    <span>Invoices ({activities.invoicesCreated.length})</span>
                  </button>
                )}
                {activities.paymentsRecorded.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('payments')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'payments'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Wallet size={12} />
                    <span>Payments ({activities.paymentsRecorded.length})</span>
                  </button>
                )}
                {totalProducts > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'products'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Package size={12} />
                    <span>Products ({totalProducts})</span>
                  </button>
                )}
              </div>

              {/* Invoices Created */}
              {(activeTab === 'all' || activeTab === 'invoices') && activities.invoicesCreated.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs sm:text-sm font-semibold text-blue-400 flex items-center gap-2">
                      <FileText size={14} /> Invoices Created ({activities.invoicesCreated.length})
                    </h4>
                    {activities.invoicesCreated.length > DEFAULT_DISPLAY_LIMIT && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Showing {visibleInvoices.length} of {activities.invoicesCreated.length}
                      </span>
                    )}
                  </div>

                  {showAllInvoices && activities.invoicesCreated.length > DEFAULT_DISPLAY_LIMIT ? (
                    <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1 relative">
                      <VirtualizedList
                        items={activities.invoicesCreated}
                        estimateSize={() => 48}
                        gap={8}
                        getKey={(inv, idx) => inv.invoiceNumber ? `${inv.invoiceNumber}-${idx}` : idx}
                        className="min-h-[48px]"
                        renderItem={(inv) => (
                          <div className="flex items-center justify-between text-xs sm:text-sm bg-slate-900/80 rounded-xl p-3 border border-slate-800/60 hover:border-slate-700/80 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-slate-100 font-mono font-medium">{inv.invoiceNumber}</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 truncate max-w-[140px] sm:max-w-[220px]">{inv.customer}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-emerald-400 font-mono font-semibold">{formatCurrency(inv.amount)}</span>
                              <span className="text-slate-400 font-mono text-[11px] sm:text-xs">{formatTime(inv.time)}</span>
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleInvoices.map((inv, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs sm:text-sm bg-slate-900/80 rounded-xl p-3 border border-slate-800/60 hover:border-slate-700/80 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-slate-100 font-mono font-medium">{inv.invoiceNumber}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400 truncate max-w-[140px] sm:max-w-[220px]">{inv.customer}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-emerald-400 font-mono font-semibold">{formatCurrency(inv.amount)}</span>
                            <span className="text-slate-400 font-mono text-[11px] sm:text-xs">{formatTime(inv.time)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activities.invoicesCreated.length > DEFAULT_DISPLAY_LIMIT && (
                    <button
                      type="button"
                      onClick={() => setShowAllInvoices(!showAllInvoices)}
                      className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg hover:bg-blue-500/10 border border-blue-500/20 active:scale-95"
                    >
                      {showAllInvoices ? (
                        <>
                          <ChevronUp size={14} />
                          <span>Show fewer ({DEFAULT_DISPLAY_LIMIT} items)</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          <span>Show all {activities.invoicesCreated.length} invoices (+{activities.invoicesCreated.length - DEFAULT_DISPLAY_LIMIT} more)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Payments Recorded */}
              {(activeTab === 'all' || activeTab === 'payments') && activities.paymentsRecorded.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs sm:text-sm font-semibold text-emerald-400 flex items-center gap-2">
                      <Wallet size={14} /> Payments Recorded ({activities.paymentsRecorded.length})
                    </h4>
                    {activities.paymentsRecorded.length > DEFAULT_DISPLAY_LIMIT && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Showing {visiblePayments.length} of {activities.paymentsRecorded.length}
                      </span>
                    )}
                  </div>

                  {showAllPayments && activities.paymentsRecorded.length > DEFAULT_DISPLAY_LIMIT ? (
                    <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1 relative">
                      <VirtualizedList
                        items={activities.paymentsRecorded}
                        estimateSize={() => 48}
                        gap={8}
                        getKey={(p, idx) => p.invoiceNumber ? `${p.invoiceNumber}-${idx}` : idx}
                        className="min-h-[48px]"
                        renderItem={(p) => (
                          <div className="flex items-center justify-between text-xs sm:text-sm bg-slate-900/80 rounded-xl p-3 border border-slate-800/60 hover:border-slate-700/80 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-slate-100 font-mono font-medium">{p.invoiceNumber || 'Invoice'}</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 capitalize truncate max-w-[120px]">{p.method}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-emerald-400 font-mono font-semibold">{formatCurrency(p.amount)}</span>
                              <span className="text-slate-400 font-mono text-[11px] sm:text-xs">{formatTime(p.time)}</span>
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visiblePayments.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs sm:text-sm bg-slate-900/80 rounded-xl p-3 border border-slate-800/60 hover:border-slate-700/80 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-slate-100 font-mono font-medium">{p.invoiceNumber || 'Invoice'}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400 capitalize truncate max-w-[120px]">{p.method}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-emerald-400 font-mono font-semibold">{formatCurrency(p.amount)}</span>
                            <span className="text-slate-400 font-mono text-[11px] sm:text-xs">{formatTime(p.time)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activities.paymentsRecorded.length > DEFAULT_DISPLAY_LIMIT && (
                    <button
                      type="button"
                      onClick={() => setShowAllPayments(!showAllPayments)}
                      className="mt-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg hover:bg-emerald-500/10 border border-emerald-500/20 active:scale-95"
                    >
                      {showAllPayments ? (
                        <>
                          <ChevronUp size={14} />
                          <span>Show fewer ({DEFAULT_DISPLAY_LIMIT} items)</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          <span>Show all {activities.paymentsRecorded.length} payments (+{activities.paymentsRecorded.length - DEFAULT_DISPLAY_LIMIT} more)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Products Added */}
              {(activeTab === 'all' || activeTab === 'products') && activities.productsAdded.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                    <Package size={14} /> Products Added ({activities.productsAdded.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {visibleProductsAdded.map((p, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-amber-500/10 text-amber-300 rounded-lg text-xs border border-amber-500/20 truncate max-w-[200px]">
                        {p.name}
                      </span>
                    ))}
                    {activities.productsAdded.length > DEFAULT_PRODUCT_LIMIT && (
                      <button
                        type="button"
                        onClick={() => setShowAllProductsAdded(!showAllProductsAdded)}
                        className="px-2.5 py-1 bg-slate-800 text-amber-400 hover:text-amber-300 rounded-lg text-xs border border-slate-700 hover:bg-slate-700 transition-colors font-medium"
                      >
                        {showAllProductsAdded ? 'Show less' : `+${activities.productsAdded.length - DEFAULT_PRODUCT_LIMIT} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Products Updated */}
              {(activeTab === 'all' || activeTab === 'products') && activities.productsUpdated.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <Package size={14} /> Products Updated ({activities.productsUpdated.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {visibleProductsUpdated.map((p, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-yellow-500/10 text-yellow-300 rounded-lg text-xs border border-yellow-500/20 truncate max-w-[200px]">
                        {p.name}
                      </span>
                    ))}
                    {activities.productsUpdated.length > DEFAULT_PRODUCT_LIMIT && (
                      <button
                        type="button"
                        onClick={() => setShowAllProductsUpdated(!showAllProductsUpdated)}
                        className="px-2.5 py-1 bg-slate-800 text-yellow-400 hover:text-yellow-300 rounded-lg text-xs border border-slate-700 hover:bg-slate-700 transition-colors font-medium"
                      >
                        {showAllProductsUpdated ? 'Show less' : `+${activities.productsUpdated.length - DEFAULT_PRODUCT_LIMIT} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Main Page Component
export default function ActivityLogPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activityLog, setActivityLog] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [timeRange, setTimeRange] = useState('today');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [debouncedEmployeeSearch] = useDebounce(employeeSearch, 250);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialEmployeeLoaded, setInitialEmployeeLoaded] = useState(false);

  // Mobile optimization
  const { isMobile } = useMotionConfig();
  const isFirstVisit = useFirstVisit('activity-log');

  const timeRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];

  const fetchActivityLog = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await employeeService.getActivityLog(timeRange, selectedEmployee?.id || null);
      setActivityLog(data.log || []);
      setEmployees(data.employees || []);
      setServerStats(data.stats || null);
      
      // If employee ID is in URL and we haven't loaded yet, select that employee
      const employeeIdFromUrl = searchParams.get('employee');
      if (employeeIdFromUrl && !initialEmployeeLoaded && data.employees) {
        const foundEmployee = data.employees.find(e => e.id === employeeIdFromUrl);
        if (foundEmployee) {
          setSelectedEmployee(foundEmployee);
        }
        setInitialEmployeeLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange, selectedEmployee, searchParams, initialEmployeeLoaded]);

  useEffect(() => {
    fetchActivityLog();
  }, [fetchActivityLog]);

  // Filter employees based on search (frontend filtering of employee list for dropdown)
  const filteredEmployees = useMemo(() => {
    const q = debouncedEmployeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(emp => 
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  }, [employees, debouncedEmployeeSearch]);

  // Calculate totals independently from serverStats or log entries
  const totals = serverStats ? {
    sessions: serverStats.totalSessions ?? 0,
    invoices: serverStats.totalInvoices ?? 0,
    payments: serverStats.totalPayments ?? 0,
    sales: serverStats.totalSales ?? 0
  } : activityLog.reduce((acc, entry) => ({
    sessions: acc.sessions + (entry.session ? 1 : 0),
    invoices: acc.invoices + (entry.summary?.invoiceCount || 0),
    payments: acc.payments + (entry.summary?.paymentCount || 0),
    sales: acc.sales + (entry.summary?.totalSales || 0)
  }), { sessions: 0, invoices: 0, payments: 0, sales: 0 });

  const clearEmployeeFilter = () => {
    setSelectedEmployee(null);
    setEmployeeSearch('');
  };

  if (loading) {
    return <ActivityLogPageSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 text-blue-600 dark:text-blue-400">
              <Activity size={20} />
            </div>
            Activity Log
          </h1>
          <p className="text-slate-400 mt-1">Track employee sessions and work</p>
        </div>

        <motion.button
          whileHover={isMobile ? {} : { scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={fetchActivityLog}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <div className="flex rounded-xl overflow-hidden border border-slate-800 bg-slate-900 p-0.5">
            {timeRangeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  timeRange === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Employee Search */}
        <div className="relative flex-1 max-w-md">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={selectedEmployee ? '' : 'Search employee...'}
              value={selectedEmployee ? selectedEmployee.name : employeeSearch}
              onChange={e => {
                setEmployeeSearch(e.target.value);
                setSelectedEmployee(null);
                setShowEmployeeDropdown(true);
              }}
              onFocus={() => setShowEmployeeDropdown(true)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
            />
            {(selectedEmployee || employeeSearch) && (
              <button 
                onClick={clearEmployeeFilter}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Employee Dropdown */}
          <AnimatePresence>
            {showEmployeeDropdown && !selectedEmployee && employeeSearch && filteredEmployees.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEmployeeDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto"
                >
                  {filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setEmployeeSearch('');
                        setShowEmployeeDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {emp.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-slate-100 font-medium text-sm">{emp.name}</p>
                        <p className="text-slate-400 text-xs">{emp.email}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sessions', value: totals.sessions, valueClass: 'text-indigo-400', iconClass: 'text-indigo-400', iconBg: 'bg-indigo-500/10 border-indigo-500/20', icon: Clock },
          { label: 'Invoices', value: totals.invoices, valueClass: 'text-blue-400', iconClass: 'text-blue-400', iconBg: 'bg-blue-500/10 border-blue-500/20', icon: FileText },
          { label: 'Payments', value: totals.payments, valueClass: 'text-green-400', iconClass: 'text-green-400', iconBg: 'bg-green-500/10 border-green-500/20', icon: Wallet },
          { label: 'Total Sales', value: formatCurrency(totals.sales), valueClass: 'text-emerald-400', iconClass: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20', icon: TrendingUp },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={isFirstVisit ? (isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }) : false}
            animate={{ opacity: 1, y: 0 }}
            transition={isMobile ? { duration: 0.15 } : { delay: index * 0.05 }}
            className="bg-slate-900 rounded-xl p-4 border border-slate-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                <p className={`text-xl font-bold font-mono ${stat.valueClass}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-2 rounded-lg border ${stat.iconBg}`}>
                <stat.icon size={18} className={stat.iconClass} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity Log */}
      {activityLog.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
          <Clock className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-400">No activities or sessions found</h3>
          <p className="text-slate-500 mt-1">
            {selectedEmployee 
              ? `No activity for ${selectedEmployee.name} in the selected time range`
              : 'No activities or sessions found in the selected time range'
            }
          </p>
        </div>
      ) : (
        <VirtualizedList
          items={activityLog}
          estimateSize={() => 150}
          gap={12}
          getKey={(entry, index) => entry.session?.id || `direct-${entry.employee?.id || 'emp'}-${index}`}
          className="min-h-[150px]"
          renderItem={(entry, index) => (
            <SessionCard 
              entry={entry} 
              isMobile={isMobile}
              isFirstVisit={isFirstVisit}
            />
          )}
        />
      )}
    </div>
  );
}
