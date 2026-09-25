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
import { useMotionConfig, useFirstVisit, useDebounce, useSWR } from '../../hooks';
import { ActivityLogPageSkeleton } from './ActivityLogPageSkeleton';
import { VirtualizedList } from '../../components/Common/VirtualizedList';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';

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

  if (!entry) return null;

  const session = entry.session || null;
  const employee = entry.employee || entry.session?.employee || {};
  const summary = entry.summary || {
    invoiceCount: 0,
    paymentCount: 0,
    productsAdded: 0,
    productsUpdated: 0,
    totalSales: 0,
    totalCollected: 0
  };

  // Defensively extract activities into arrays regardless of whether activities is an object or a flat array
  let invoicesCreated = [];
  let paymentsRecorded = [];
  let productsAdded = [];
  let productsUpdated = [];

  if (entry.activities && !Array.isArray(entry.activities)) {
    invoicesCreated = Array.isArray(entry.activities.invoicesCreated) ? entry.activities.invoicesCreated : [];
    paymentsRecorded = Array.isArray(entry.activities.paymentsRecorded) ? entry.activities.paymentsRecorded : [];
    productsAdded = Array.isArray(entry.activities.productsAdded) ? entry.activities.productsAdded : [];
    productsUpdated = Array.isArray(entry.activities.productsUpdated) ? entry.activities.productsUpdated : [];
  } else if (Array.isArray(entry.activities)) {
    entry.activities.forEach((act) => {
      const type = String(act.type || '').toUpperCase();
      if (type.includes('INVOICE')) {
        invoicesCreated.push({
          invoiceNumber: act.invoiceNumber || act.referenceNumber || act.description?.match(/INV-[0-9-]+/)?.[0] || 'INV',
          customer: act.customer || act.customerName || 'Customer',
          amount: Number(act.amount || act.grandTotal) || 0,
          time: act.time || act.timestamp || new Date()
        });
      } else if (type.includes('PAYMENT')) {
        paymentsRecorded.push({
          invoiceNumber: act.invoiceNumber || act.referenceNumber || 'Invoice',
          customer: act.customer || act.customerName || 'Customer',
          amount: Number(act.amount) || 0,
          method: act.method || act.paymentMethod || 'UPI',
          time: act.time || act.timestamp || new Date()
        });
      } else if (type.includes('PRODUCT_ADD')) {
        productsAdded.push({
          name: act.name || act.productName || 'Product',
          time: act.time || act.timestamp || new Date()
        });
      } else if (type.includes('PRODUCT')) {
        productsUpdated.push({
          name: act.name || act.productName || 'Product',
          time: act.time || act.timestamp || new Date()
        });
      }
    });
  }

  const DEFAULT_DISPLAY_LIMIT = 5;
  const DEFAULT_PRODUCT_LIMIT = 8;

  // Recalibrate virtualizer offsets when accordion toggles or inner lists expand
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 220);
    return () => clearTimeout(timer);
  }, [expanded, showAllInvoices, showAllPayments, showAllProductsAdded, showAllProductsUpdated, activeTab]);

  const totalProducts = productsAdded.length + productsUpdated.length;
  const hasActivities = (summary.invoiceCount || 0) > 0 || (summary.paymentCount || 0) > 0 || totalProducts > 0 || invoicesCreated.length > 0 || paymentsRecorded.length > 0;

  const visibleInvoices = showAllInvoices 
    ? invoicesCreated 
    : invoicesCreated.slice(0, DEFAULT_DISPLAY_LIMIT);

  const visiblePayments = showAllPayments 
    ? paymentsRecorded 
    : paymentsRecorded.slice(0, DEFAULT_DISPLAY_LIMIT);

  const visibleProductsAdded = showAllProductsAdded
    ? productsAdded 
    : productsAdded.slice(0, DEFAULT_PRODUCT_LIMIT);

  const visibleProductsUpdated = showAllProductsUpdated
    ? productsUpdated 
    : productsUpdated.slice(0, DEFAULT_PRODUCT_LIMIT);

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
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base truncate">{employee.name || 'Staff Member'}</h3>
              <p className="text-xs text-slate-400 truncate">{employee.email || ''}</p>
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
                {invoicesCreated.length > 0 && (
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
                    <span>Invoices ({invoicesCreated.length})</span>
                  </button>
                )}
                {paymentsRecorded.length > 0 && (
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
                    <span>Payments ({paymentsRecorded.length})</span>
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
              {(activeTab === 'all' || activeTab === 'invoices') && invoicesCreated.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs sm:text-sm font-semibold text-blue-400 flex items-center gap-2">
                      <FileText size={14} /> Invoices Created ({invoicesCreated.length})
                    </h4>
                    {invoicesCreated.length > DEFAULT_DISPLAY_LIMIT && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Showing {visibleInvoices.length} of {invoicesCreated.length}
                      </span>
                    )}
                  </div>

                  {showAllInvoices && invoicesCreated.length > DEFAULT_DISPLAY_LIMIT ? (
                    <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1 relative">
                      <VirtualizedList
                        items={invoicesCreated}
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

                  {invoicesCreated.length > DEFAULT_DISPLAY_LIMIT && (
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
                          <span>Show all {invoicesCreated.length} invoices (+{invoicesCreated.length - DEFAULT_DISPLAY_LIMIT} more)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Payments Recorded */}
              {(activeTab === 'all' || activeTab === 'payments') && paymentsRecorded.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs sm:text-sm font-semibold text-emerald-400 flex items-center gap-2">
                      <Wallet size={14} /> Payments Recorded ({paymentsRecorded.length})
                    </h4>
                    {paymentsRecorded.length > DEFAULT_DISPLAY_LIMIT && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Showing {visiblePayments.length} of {paymentsRecorded.length}
                      </span>
                    )}
                  </div>

                  {showAllPayments && paymentsRecorded.length > DEFAULT_DISPLAY_LIMIT ? (
                    <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1 relative">
                      <VirtualizedList
                        items={paymentsRecorded}
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

                  {paymentsRecorded.length > DEFAULT_DISPLAY_LIMIT && (
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
                          <span>Show all {paymentsRecorded.length} payments (+{paymentsRecorded.length - DEFAULT_DISPLAY_LIMIT} more)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Products Added */}
              {(activeTab === 'all' || activeTab === 'products') && productsAdded.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                    <Package size={14} /> Products Added ({productsAdded.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {visibleProductsAdded.map((p, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-amber-500/10 text-amber-300 rounded-lg text-xs border border-amber-500/20 truncate max-w-[200px]">
                        {p.name}
                      </span>
                    ))}
                    {productsAdded.length > DEFAULT_PRODUCT_LIMIT && (
                      <button
                        type="button"
                        onClick={() => setShowAllProductsAdded(!showAllProductsAdded)}
                        className="px-2.5 py-1 bg-slate-800 text-amber-400 hover:text-amber-300 rounded-lg text-xs border border-slate-700 hover:bg-slate-700 transition-colors font-medium"
                      >
                        {showAllProductsAdded ? 'Show less' : `+${productsAdded.length - DEFAULT_PRODUCT_LIMIT} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Products Updated */}
              {(activeTab === 'all' || activeTab === 'products') && productsUpdated.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <Package size={14} /> Products Updated ({productsUpdated.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {visibleProductsUpdated.map((p, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-yellow-500/10 text-yellow-300 rounded-lg text-xs border border-yellow-500/20 truncate max-w-[200px]">
                        {p.name}
                      </span>
                    ))}
                    {productsUpdated.length > DEFAULT_PRODUCT_LIMIT && (
                      <button
                        type="button"
                        onClick={() => setShowAllProductsUpdated(!showAllProductsUpdated)}
                        className="px-2.5 py-1 bg-slate-800 text-yellow-400 hover:text-yellow-300 rounded-lg text-xs border border-slate-700 hover:bg-slate-700 transition-colors font-medium"
                      >
                        {showAllProductsUpdated ? 'Show less' : `+${productsUpdated.length - DEFAULT_PRODUCT_LIMIT} more`}
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
  const urlEmployeeId = searchParams.get('employee');

  const [timeRange, setTimeRange] = useState(() => (urlEmployeeId ? '30d' : 'today'));
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [debouncedEmployeeSearch] = useDebounce(employeeSearch, 250);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Mobile optimization
  const { isMobile } = useMotionConfig();
  const isFirstVisit = useFirstVisit('activity-log');

  const timeRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' }
  ];

  const targetEmployeeId = selectedEmployee?.id || urlEmployeeId || null;

  const { data, isLoading, isValidating, mutate } = useSWR(
    `activity-log-${timeRange}-${targetEmployeeId || 'all'}`,
    () => employeeService.getActivityLog(timeRange, targetEmployeeId),
    { ttl: 30 * 1000 }
  );

  const activityLog = data?.log || [];
  const employees = data?.employees || [];
  const serverStats = data?.stats || null;

  // Sync selected employee from URL when employees list is fetched
  useEffect(() => {
    if (urlEmployeeId && !selectedEmployee && employees.length > 0) {
      const foundEmployee = employees.find(e => String(e.id) === String(urlEmployeeId));
      if (foundEmployee) {
        setSelectedEmployee(foundEmployee);
      }
    }
  }, [urlEmployeeId, selectedEmployee, employees]);

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

  if (isLoading && !data) {
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

        <div className="flex items-center gap-3">
          <RefreshIndicator isRefreshing={isValidating} size="sm" showText />
          <motion.button
            whileHover={isMobile ? {} : { scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={isValidating ? 'animate-spin' : ''} />
            Refresh
          </motion.button>
        </div>
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
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {timeRange !== '30d' && (
              <button
                onClick={() => setTimeRange('30d')}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-colors"
              >
                Search Last 30 Days
              </button>
            )}
            {timeRange !== 'all' && (
              <button
                onClick={() => setTimeRange('all')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors"
              >
                Search All Time
              </button>
            )}
            {selectedEmployee && (
              <button
                onClick={clearEmployeeFilter}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors"
              >
                Clear Employee Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <VirtualizedList
          items={activityLog}
          estimateSize={() => 150}
          gap={12}
          getKey={(entry, index) => entry?.session?.id || entry?.session?._id || `direct-${entry?.employee?.id || entry?.employee?._id || 'emp'}-${index}`}
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
