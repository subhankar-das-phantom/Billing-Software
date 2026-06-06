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
import { TableSkeleton } from '../../components/Common/Feedback/Loader';
import { useSWR, useFirstVisit } from '../../hooks';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';

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

  // SWR: Instant cached data + background revalidation
  const { data: statsData, isLoading: statsLoading, isValidating: statsValidating } = useSWR(
    'credits-stats',
    () => getCreditStats(),
    { ttl: 2 * 60 * 1000 } // 2 minute cache
  );

  const { data: outstandingData, isLoading: outstandingLoading, isValidating: outstandingValidating } = useSWR(
    `credits-outstanding-${outstandingPage}`,
    () => getOutstandingReport({ page: outstandingPage, limit: 20 }),
    { ttl: 2 * 60 * 1000 }
  );

  const { data: ageingData, isLoading: ageingLoading, isValidating: ageingValidating } = useSWR(
    `credits-ageing-${ageingPage}`,
    () => getAgeingReport({ page: ageingPage, limit: 20 }),
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
  }, [outstandingData, outstandingPage]);

  // Outstanding infinite scroll observer
  const outstandingLastRef = useCallback((node) => {
    if (outstandingValidating) return;
    if (outstandingObserver.current) outstandingObserver.current.disconnect();
    if (node) {
      outstandingObserver.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !outstandingValidating && outstandingHasMore) {
          setOutstandingPage(prev => prev + 1);
        }
      }, { threshold: 0.1 });
      outstandingObserver.current.observe(node);
    }
  }, [outstandingValidating, outstandingHasMore]);

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
  }, [ageingData, ageingPage]);

  // Ageing infinite scroll observer
  const ageingLastRef = useCallback((node) => {
    if (ageingValidating) return;
    if (ageingObserver.current) ageingObserver.current.disconnect();
    if (node) {
      ageingObserver.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !ageingValidating && ageingHasMore) {
          setAgeingPage(prev => prev + 1);
        }
      }, { threshold: 0.1 });
      ageingObserver.current.observe(node);
    }
  }, [ageingValidating, ageingHasMore]);

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
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/50',
      glow: 'shadow-amber-500/20'
    },
    red: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/50',
      glow: 'shadow-red-500/20'
    },
    emerald: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/50',
      glow: 'shadow-emerald-500/20'
    },
    blue: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/50',
      glow: 'shadow-blue-500/20'
    }
  };

  return (
    <div
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 rounded-xl">
            <Wallet className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Credit Management</h1>
            <p className="text-slate-400 text-sm">Track receivables and payments</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RefreshIndicator isRefreshing={isValidating} size="sm" showText />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const colors = colorClasses[card.color];
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`glass-card p-5 border ${colors.border} hover:shadow-lg ${colors.glow} transition-all hover:-translate-y-0.5 hover:scale-[1.01]`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${colors.bg}`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${colors.text} mb-1`}>
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
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all ${activeTab === tab.id
                  ? 'bg-slate-700/50 text-white border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {/* Outstanding Tab */}
            {activeTab === 'outstanding' && (
              <div key="outstanding">
                {showOutstandingSkeleton ? (
                  <div className="glass-card overflow-hidden">
                    <TableSkeleton rows={6} columns={3} />
                  </div>
                ) : activeOutstandingCustomers.length === 0 && !outstandingValidating ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                      <Wallet className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-slate-400">No outstanding dues! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeOutstandingCustomers.map((customer, index) => (
                      <div key={customer._id}>
                        <Link
                          to={`/customers/${customer._id}`}
                          className="block p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                                {customer.customerName?.charAt(0)}
                              </div>
                              <div>
                                <h3 className="font-medium text-white group-hover:text-amber-400 transition-colors">
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
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-lg font-semibold text-amber-400">
                                  {formatCurrency(customer.outstandingBalance)}
                                </p>
                                {customer.creditLimit > 0 && (
                                  <p className="text-xs text-slate-500">
                                    Limit: {formatCurrency(customer.creditLimit)}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                    {/* Infinite scroll sentinel */}
                    {outstandingHasMore && (
                      <div ref={outstandingLastRef} className="p-3 flex items-center justify-center h-12">
                        {outstandingValidating && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span className="text-sm">Loading more customers...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Ageing Report Tab */}
            {activeTab === 'ageing' && (
              <div key="ageing" className="space-y-4">
                {showAgeingSkeleton ? (
                  <div className="glass-card overflow-hidden">
                    <TableSkeleton rows={6} columns={4} />
                  </div>
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
                    const colorMap = {
                      emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
                      amber: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
                      orange: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
                      red: 'bg-red-500/20 text-red-400 border-red-500/50'
                    };
                    return (
                      <div
                        key={bucket.key}
                        className={`p-4 rounded-xl border ${colorMap[bucket.color]}`}
                      >
                        <p className="text-sm text-slate-400 mb-1">{bucket.label}</p>
                        <p className="text-xl font-bold">{formatCurrency(data.amount)}</p>
                        <p className="text-xs text-slate-500">{data.count} invoices</p>
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
                      {activeAgeingInvoices.map((inv) => (
                        <Link
                          key={inv._id}
                          to={`/invoices/${inv._id}`}
                          className="block p-3 bg-slate-800/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-slate-500" />
                              <div>
                                <span className="text-white font-medium">{inv.invoiceNumber}</span>
                                <span className="text-slate-400 ml-2">{inv.customerName}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-amber-400 font-medium">{formatCurrency(inv.remainingAmount)}</p>
                              <p className="text-xs text-slate-500">{formatDate(inv.invoiceDate)}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {/* Infinite scroll sentinel */}
                      {ageingHasMore && (
                        <div ref={ageingLastRef} className="p-3 flex items-center justify-center h-12">
                          {ageingValidating && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                              <span className="text-sm">Loading more invoices...</span>
                            </div>
                          )}
                        </div>
                      )}
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
                  <div className="glass-card overflow-hidden">
                    <TableSkeleton rows={6} columns={3} />
                  </div>
                ) : recentPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-700 mb-4">
                      <CreditCard className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentPayments.map((payment, index) => (
                      <div
                        key={payment._id}
                        className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                              <CreditCard className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {payment.customer?.customerName || 'Unknown Customer'}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-slate-400">
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
                            <p className="text-lg font-semibold text-emerald-400">
                              +{formatCurrency(payment.amount)}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                              <Calendar className="w-3 h-3" />
                              {formatDate(payment.paymentDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
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
