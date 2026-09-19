import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, animate } from 'framer-motion';
import {
  Wallet,
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  RefreshCw,
  Phone,
  Loader2
} from 'lucide-react';
import {
  getCreditStats,
  getOutstandingReport,
  getAgeingReport,
  getRecentPayments
} from '../../services/credits/creditService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { OutstandingTabSkeleton, AgeingTabSkeleton, PaymentsTabSkeleton } from './CreditsPageSkeleton';
import { useSWR, useFirstVisit, useMediaQuery } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import { VirtualizedList } from '../../components/Common/VirtualizedList';
import CollapsibleMobileCard from '../../components/Common/Cards/CollapsibleMobileCard';
import { useInfiniteScrollSentinel } from '../../utils/scrollUtils';

// Animated counter component
const AnimatedCounter = ({ value, prefix = '', suffix = '', decimals = 0 }) => {
  const ref = useRef(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 800 });
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      animate(motionValue, value, { duration: 0.8, ease: 'easeOut' });
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${latest.toFixed(decimals)}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, prefix, suffix, decimals]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
};

export default function CreditsPage() {
  const [activeTab, setActiveTab] = useState('outstanding');
  const isFirstVisit = useFirstVisit('credits');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { user, admin } = useAuth();

  // Mobile card density preference with Frame-0 cache pre-seeding
  const storedDensity = typeof window !== 'undefined' ? localStorage.getItem('bharat_mobile_card_density') : null;
  const initialDensity = storedDensity === 'expanded' || storedDensity === 'compact' ? storedDensity : 'compact';
  const mobileCardDensity = user?.preferences?.mobileCardDensity || admin?.preferences?.mobileCardDensity || initialDensity;

  // Outstanding infinite scroll state
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [outstandingCustomers, setOutstandingCustomers] = useState([]);
  const [outstandingSummary, setOutstandingSummary] = useState({ customers: [], summary: {} });
  const [outstandingHasMore, setOutstandingHasMore] = useState(false);
  const outstandingObserver = useRef(null);

  // Ageing infinite scroll state
  const [ageingPage, setAgeingPage] = useState(1);
  const [ageingInvoices, setAgeingInvoices] = useState([]);
  const [ageingBuckets, setAgeingBuckets] = useState({ buckets: {}, summary: {} });
  const [ageingHasMore, setAgeingHasMore] = useState(false);
  const ageingObserver = useRef(null);

  const [scrollRoot, setScrollRoot] = useState(null);

  // Outstanding refs & reactive fetching state
  const [outstandingFetching, setOutstandingFetching] = useState(false);
  const outstandingFetchingRef = useRef(false);
  const pendingOutstandingPageRef = useRef(null);
  const outstandingHasMoreRef = useRef(false);
  const outstandingValidatingRef = useRef(false);
  const loadNextOutstandingPageRef = useRef(null);

  // Ageing refs & reactive fetching state
  const [ageingFetching, setAgeingFetching] = useState(false);
  const ageingFetchingRef = useRef(false);
  const pendingAgeingPageRef = useRef(null);
  const ageingHasMoreRef = useRef(false);
  const ageingValidatingRef = useRef(false);
  const loadNextAgeingPageRef = useRef(null);

  // SWR: Instant cached data + background revalidation
  const { data: statsData, isLoading: statsLoading, isValidating: statsValidating } = useSWR(
    'credits-stats',
    () => getCreditStats(),
    { ttl: 2 * 60 * 1000 } // 2 minute cache
  );

  const { data: outstandingData, isLoading: outstandingLoading, isValidating: outstandingValidating, error: outstandingError } = useSWR(
    `credits-outstanding-${outstandingPage}`,
    async () => {
      const res = await getOutstandingReport({ page: outstandingPage, limit: 20 });
      return { ...res, _page: outstandingPage };
    },
    { ttl: 2 * 60 * 1000 }
  );

  const { data: ageingData, isLoading: ageingLoading, isValidating: ageingValidating, error: ageingError } = useSWR(
    `credits-ageing-${ageingPage}`,
    async () => {
      const res = await getAgeingReport({ page: ageingPage, limit: 20 });
      return { ...res, _page: ageingPage };
    },
    { ttl: 2 * 60 * 1000 }
  );

  const { data: paymentsData, isLoading: paymentsLoading, isValidating: paymentsValidating } = useSWR(
    'credits-recent-payments',
    () => getRecentPayments(15),
    { ttl: 2 * 60 * 1000 }
  );

  // Extract data from SWR responses
  const stats = statsData?.stats || null;
  // Outstanding summary comes from stable state (not directly from SWR)
  const outstanding = outstandingSummary;
  // Ageing buckets/summary come from stable state (not directly from SWR)
  const ageing = ageingBuckets;
  const recentPayments = paymentsData?.payments || [];

  // Derive lists synchronously when on page 1 to prevent a 1-render-frame gap
  // caused by useEffect, which was making the lists visually remount on revisits.
  const activeOutstandingCustomers = (outstandingPage === 1 && outstandingData?.customers && outstandingCustomers.length === 0) 
    ? outstandingData.customers 
    : outstandingCustomers;
    
  const activeAgeingInvoices = (ageingPage === 1 && ageingData?.invoices && ageingInvoices.length === 0)
    ? ageingData.invoices
    : ageingInvoices;

  // Keep sync refs up to date
  outstandingHasMoreRef.current = outstandingHasMore;
  outstandingValidatingRef.current = outstandingValidating;
  ageingHasMoreRef.current = ageingHasMore;
  ageingValidatingRef.current = ageingValidating;

  // Store outstanding summary in stable state + accumulate customers
  useEffect(() => {
    if (!outstandingData) return;

    if (outstandingData.summary) {
      setOutstandingSummary({ customers: [], summary: outstandingData.summary });
    }

    setOutstandingHasMore(outstandingData.hasMore ?? false);

    if (!outstandingData.customers) return;
    if (outstandingPage === 1) {
      setOutstandingCustomers(outstandingData.customers);
    } else {
      setOutstandingCustomers(prev => {
        const existingIds = new Set(prev.map(c => c._id));
        const newCustomers = outstandingData.customers.filter(c => !existingIds.has(c._id));
        return [...prev, ...newCustomers];
      });
    }

    // Release lock only after the specific requested page has completed successfully
    if (pendingOutstandingPageRef.current !== null && (outstandingData._page === pendingOutstandingPageRef.current || outstandingData.page === pendingOutstandingPageRef.current)) {
      outstandingFetchingRef.current = false;
      setOutstandingFetching(false);
      pendingOutstandingPageRef.current = null;
    }
  }, [outstandingData, outstandingPage]);

  // Failure Path: Release outstanding lock on request error
  useEffect(() => {
    if (outstandingError && pendingOutstandingPageRef.current !== null) {
      outstandingFetchingRef.current = false;
      setOutstandingFetching(false);
      pendingOutstandingPageRef.current = null;
    }
  }, [outstandingError]);

  // Store bucket summaries in stable state + accumulate invoices (like InvoicesPage)
  useEffect(() => {
    if (!ageingData) return;

    if (ageingData.buckets) {
      setAgeingBuckets({ buckets: ageingData.buckets, summary: ageingData.summary });
    }

    setAgeingHasMore(ageingData.hasMore ?? false);

    if (!ageingData.invoices) return;
    if (ageingPage === 1) {
      setAgeingInvoices(ageingData.invoices);
    } else {
      setAgeingInvoices(prev => {
        const existingIds = new Set(prev.map(inv => inv._id));
        const newInvoices = ageingData.invoices.filter(inv => !existingIds.has(inv._id));
        return [...prev, ...newInvoices];
      });
    }

    // Release lock only after the specific requested page has completed successfully
    if (pendingAgeingPageRef.current !== null && (ageingData._page === pendingAgeingPageRef.current || ageingData.page === pendingAgeingPageRef.current)) {
      ageingFetchingRef.current = false;
      setAgeingFetching(false);
      pendingAgeingPageRef.current = null;
    }
  }, [ageingData, ageingPage]);

  // Failure Path: Release ageing lock on request error
  useEffect(() => {
    if (ageingError && pendingAgeingPageRef.current !== null) {
      ageingFetchingRef.current = false;
      setAgeingFetching(false);
      pendingAgeingPageRef.current = null;
    }
  }, [ageingError]);

  // Dedicated load triggers
  const loadNextOutstandingPage = useCallback(() => {
    if (outstandingFetchingRef.current || outstandingValidatingRef.current || !outstandingHasMoreRef.current) return;
    outstandingFetchingRef.current = true;
    setOutstandingFetching(true);
    pendingOutstandingPageRef.current = outstandingPage + 1;
    setOutstandingPage(prev => prev + 1);
  }, [outstandingPage]);
  loadNextOutstandingPageRef.current = loadNextOutstandingPage;

  const loadNextAgeingPage = useCallback(() => {
    if (ageingFetchingRef.current || ageingValidatingRef.current || !ageingHasMoreRef.current) return;
    ageingFetchingRef.current = true;
    setAgeingFetching(true);
    pendingAgeingPageRef.current = ageingPage + 1;
    setAgeingPage(prev => prev + 1);
  }, [ageingPage]);
  loadNextAgeingPageRef.current = loadNextAgeingPage;

  // Level-triggered reactive infinite scroll sentinels for both tabs
  const { sentinelRef: outstandingSentinelRef } = useInfiniteScrollSentinel({
    hasMore: outstandingHasMore,
    isFetching: outstandingFetching,
    isValidating: outstandingValidating,
    onLoadMore: loadNextOutstandingPage,
    enabled: activeTab === 'outstanding'
  });

  const { sentinelRef: ageingSentinelRef } = useInfiniteScrollSentinel({
    hasMore: ageingHasMore,
    isFetching: ageingFetching,
    isValidating: ageingValidating,
    onLoadMore: loadNextAgeingPage,
    enabled: activeTab === 'ageing'
  });

  // Loading states
  const loading = (statsLoading || outstandingLoading || ageingLoading || paymentsLoading) && !stats;
  const isValidating = statsValidating || outstandingValidating || ageingValidating || paymentsValidating;
  const showOutstandingSkeleton = outstandingLoading && activeOutstandingCustomers.length === 0;
  const showAgeingSkeleton = ageingLoading && activeAgeingInvoices.length === 0;
  const showPaymentsSkeleton = paymentsLoading && recentPayments.length === 0;

  const tabs = [
    { id: 'outstanding', label: 'Outstanding', icon: Wallet },
    { id: 'ageing', label: 'Ageing Report', icon: Clock },
    { id: 'payments', label: 'Recent Payments', icon: CreditCard }
  ];

  const statCards = [
    {
      label: 'Total Outstanding',
      value: stats?.totalOutstanding || 0,
      icon: Wallet,
      color: 'amber',
      prefix: '₹',
      decimals: 0
    },
    {
      label: 'Overdue (>30 days)',
      value: stats?.overdueAmount || 0,
      icon: AlertTriangle,
      color: 'red',
      prefix: '₹',
      decimals: 0
    },
    {
      label: 'Payments This Month',
      value: stats?.paymentsThisMonth || 0,
      icon: TrendingUp,
      color: 'emerald',
      prefix: '₹',
      decimals: 0
    },
    {
      label: 'Customers with Dues',
      value: stats?.customersWithDues || 0,
      icon: Users,
      color: 'blue',
      decimals: 0
    }
  ];

  const colorClasses = {
    amber: {
      bg: 'bg-amber-500/15',
      iconColor: 'text-amber-400'
    },
    red: {
      bg: 'bg-rose-500/15',
      iconColor: 'text-rose-400'
    },
    emerald: {
      bg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400'
    },
    blue: {
      bg: 'bg-blue-500/15',
      iconColor: 'text-blue-400'
    }
  };

  return (
    <div
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-slate-800 border border-slate-700/60 rounded-xl text-amber-400">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-100">Credit Management</h1>
            <p className="text-slate-400 text-xs sm:text-sm">Track receivables and payments</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RefreshIndicator isRefreshing={isValidating} size="sm" showText />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const colors = colorClasses[card.color];
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass-card p-3.5 sm:p-5 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-xs font-medium text-slate-400 truncate mr-2">{card.label}</span>
                <div className={`p-2 rounded-lg ${colors.bg} ${colors.iconColor} shrink-0`}>
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-slate-100 tracking-tight">
                <AnimatedCounter
                  value={card.value}
                  prefix={card.prefix || ''}
                  decimals={card.decimals}
                />
              </p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="glass-card overflow-hidden">
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-2 sm:px-4 py-2.5 sm:py-3 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm transition-all ${activeTab === tab.id
                  ? 'bg-slate-700/50 text-slate-100 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/30'
                  }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-3 sm:p-5">
          <AnimatePresence mode="wait">
            {/* Outstanding Tab */}
            {activeTab === 'outstanding' && (
              <div key="outstanding">
                {showOutstandingSkeleton ? (
                  <OutstandingTabSkeleton />
                ) : activeOutstandingCustomers.length === 0 && !outstandingValidating ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                      <Wallet className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-slate-400">No outstanding dues! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <VirtualizedList
                      items={activeOutstandingCustomers}
                      estimateSize={() => 88}
                      getKey={(customer) => customer._id}
                      gap={12}
                      className="min-h-[88px]"
                      renderItem={(customer) => (
                        <Link
                          to={`/customers/${customer._id}`}
                          className="block p-3 sm:p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 sm:gap-4">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-200 text-sm sm:text-base font-semibold group-hover:border-amber-500/40 group-hover:text-amber-400 transition-colors shrink-0">
                                {customer.customerName?.charAt(0)}
                              </div>
                              <div>
                                <h3 className="text-sm sm:text-base font-medium text-slate-100 group-hover:text-amber-400 transition-colors">
                                  {customer.customerName}
                                </h3>
                                {customer.phone && (
                                  <p className="text-sm text-slate-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {customer.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4">
                              <div className="text-right">
                                <p className="text-sm sm:text-lg font-semibold text-amber-400">
                                  {formatCurrency(customer.outstandingBalance)}
                                </p>
                                {customer.creditLimit > 0 && (
                                  <p className="text-xs text-slate-500">
                                    Limit: {formatCurrency(customer.creditLimit)}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </Link>
                      )}
                    />
                    {/* Persistent Sentinel Container (stays mounted in DOM; visibility toggles smoothly) */}
                    <div
                      ref={outstandingSentinelRef}
                      className={`w-full flex items-center justify-center p-3 min-h-[48px] my-2 transition-all ${
                        !outstandingHasMore ? 'hidden pointer-events-none' : ''
                      }`}
                    >
                      {outstandingFetching || (outstandingValidating && outstandingPage > 1) ? (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          <span className="text-sm font-medium text-slate-300">Loading more customers...</span>
                        </div>
                      ) : (
                        <div className="h-6 w-full opacity-0 pointer-events-none" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ageing Report Tab */}
            {activeTab === 'ageing' && (
              <div key="ageing" className="space-y-4">
                {showAgeingSkeleton ? (
                  <AgeingTabSkeleton />
                ) : (
                  <>
                {/* Ageing Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: 'current', label: '0-30 Days', color: 'emerald' },
                    { key: 'overdue30', label: '31-60 Days', color: 'amber' },
                    { key: 'overdue60', label: '61-90 Days', color: 'orange' },
                    { key: 'overdue90', label: '90+ Days', color: 'red' }
                  ].map((bucket) => {
                    const data = ageing.buckets?.[bucket.key] || { amount: 0, count: 0 };
                    const bucketConfig = {
                      emerald: { badge: 'badge-success', text: 'text-emerald-400' },
                      amber: { badge: 'badge-warning', text: 'text-amber-400' },
                      orange: { badge: 'badge-warning', text: 'text-amber-400' },
                      red: { badge: 'badge-danger', text: 'text-rose-400' }
                    };
                    const config = bucketConfig[bucket.color];
                    return (
                      <div
                        key={bucket.key}
                        className="glass-card p-4 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-400">{bucket.label}</span>
                          <span className={`badge ${config.badge} text-[10px]`}>
                            {data.count} bills
                          </span>
                        </div>
                        <p className={`text-lg sm:text-xl font-bold ${config.text}`}>{formatCurrency(data.amount)}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Ageing Details — Paginated with infinite scroll */}
                {ageing.summary?.totalCount > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">
                      Overdue Invoices
                      <span className="text-slate-500 ml-2">({activeAgeingInvoices.length} of {ageing.summary.totalCount})</span>
                    </h3>
                    <div className="space-y-2">
                      <VirtualizedList
                        items={activeAgeingInvoices}
                        estimateSize={() => 72}
                        getKey={(inv) => inv._id}
                        gap={8}
                        className="min-h-[72px]"
                        renderItem={(inv) => (
                          <Link
                            to={`/invoices/${inv._id}`}
                            className="block p-3 bg-slate-800/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="w-4 h-4 text-slate-500" />
                                <div>
                                  <span className="text-slate-100 font-medium">{inv.invoiceNumber}</span>
                                  <span className="text-slate-400 ml-2">{inv.customerName}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-amber-400 font-medium">{formatCurrency(inv.remainingAmount)}</p>
                                <p className="text-xs text-slate-500">{formatDate(inv.invoiceDate)}</p>
                              </div>
                            </div>
                          </Link>
                        )}
                      />
                      {/* Persistent Sentinel Container (stays mounted in DOM; visibility toggles smoothly) */}
                      <div
                        ref={ageingSentinelRef}
                        className={`w-full flex items-center justify-center p-3 min-h-[48px] my-2 transition-all ${
                          !ageingHasMore ? 'hidden pointer-events-none' : ''
                        }`}
                      >
                        {ageingFetching || (ageingValidating && ageingPage > 1) ? (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span className="text-sm font-medium text-slate-300">Loading more invoices...</span>
                          </div>
                        ) : (
                          <div className="h-6 w-full opacity-0 pointer-events-none" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
            )}

            {/* Recent Payments Tab */}
            {activeTab === 'payments' && (
              <div key="payments">
                {showPaymentsSkeleton ? (
                  <PaymentsTabSkeleton />
                ) : recentPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-700 mb-4">
                      <CreditCard className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentPayments.map((payment, index) => {
                      if (isDesktop) {
                        return (
                          <div
                            key={payment._id}
                            className="p-3 sm:p-4 bg-slate-800/50 rounded-xl border border-slate-700/50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                                <div className="p-2 sm:p-2.5 bg-emerald-500/20 rounded-lg shrink-0">
                                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm sm:text-base font-medium text-slate-100 truncate">
                                    {payment.customer?.customerName || 'Unknown Customer'}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-400">
                                    <span>{payment.invoiceSnapshot?.invoiceNumber}</span>
                                    <span>•</span>
                                    <span>{payment.paymentMethod}</span>
                                    {payment.referenceNumber && (
                                      <>
                                        <span>•</span>
                                        <span className="text-slate-500">Ref: {payment.referenceNumber}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm sm:text-lg font-semibold text-emerald-400">
                                  +{formatCurrency(payment.amount)}
                                </p>
                                <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(payment.paymentDate)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <CollapsibleMobileCard
                          key={payment._id}
                          id={payment._id}
                          entityType="payment"
                          defaultExpanded={mobileCardDensity === 'expanded'}
                          summary={
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-100 truncate">
                                  {payment.customer?.customerName || 'Unknown Customer'}
                                </p>
                                <p className="text-sm font-bold font-mono text-emerald-400 shrink-0">
                                  +{formatCurrency(payment.amount)}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-500" />
                                  {formatDate(payment.paymentDate)}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                                  <CreditCard className="w-3 h-3 text-emerald-400" />
                                  {payment.paymentMethod}
                                </span>
                              </div>
                            </div>
                          }
                        >
                          <div className="space-y-2 text-xs text-slate-400">
                            {payment.invoiceSnapshot?.invoiceNumber && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Invoice:</span>
                                <span className="font-mono text-slate-300">{payment.invoiceSnapshot.invoiceNumber}</span>
                              </div>
                            )}
                            {payment.referenceNumber && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Reference:</span>
                                <span className="font-mono text-slate-300">Ref: {payment.referenceNumber}</span>
                              </div>
                            )}
                          </div>
                        </CollapsibleMobileCard>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
