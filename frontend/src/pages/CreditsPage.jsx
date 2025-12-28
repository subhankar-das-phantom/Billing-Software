import { useState, useEffect, useRef } from 'react';
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
  Phone
} from 'lucide-react';
import {
  getCreditStats,
  getOutstandingReport,
  getAgeingReport,
  getRecentPayments
} from '../services/creditService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';

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
  const [stats, setStats] = useState(null);
  const [outstanding, setOutstanding] = useState({ customers: [], summary: {} });
  const [ageing, setAgeing] = useState({ buckets: {}, summary: {} });
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('outstanding');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, outstandingData, ageingData, paymentsData] = await Promise.all([
        getCreditStats(),
        getOutstandingReport(),
        getAgeingReport(),
        getRecentPayments(15)
      ]);
      setStats(statsData.stats);
      setOutstanding(outstandingData);
      setAgeing(ageingData);
      setRecentPayments(paymentsData.payments || []);
    } catch (error) {
      console.error('Failed to load credit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'tween', duration: 0.15, ease: 'easeOut' }
    }
  };

  if (loading) {
    return <PageLoader />;
  }

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 rounded-xl">
            <Wallet className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Credit Management</h1>
            <p className="text-slate-400 text-sm">Track receivables and payments</p>
          </div>
        </div>

        <motion.button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </motion.button>
      </motion.div>

      {/* Stat Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const colors = colorClasses[card.color];
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              className={`glass-card p-5 border ${colors.border} hover:shadow-lg ${colors.glow} transition-all`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.15 }}
              whileHover={{ y: -2, scale: 1.01 }}
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
              <p className="text-sm text-slate-400">{card.label}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants} className="glass-card overflow-hidden">
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all ${
                  activeTab === tab.id
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
              <motion.div
                key="outstanding"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {outstanding.customers?.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                      <Wallet className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-slate-400">No outstanding dues! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outstanding.customers?.map((customer, index) => (
                      <motion.div
                        key={customer._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
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
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Ageing Report Tab */}
            {activeTab === 'ageing' && (
              <motion.div
                key="ageing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="space-y-4"
              >
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

                {/* Ageing Details */}
                {ageing.summary?.totalCount > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Overdue Invoices</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {Object.entries(ageing.buckets || {}).map(([bucketKey, bucket]) =>
                        bucket.invoices?.map((inv, idx) => (
                          <Link
                            key={`${bucketKey}-${idx}`}
                            to={`/invoices/${inv.invoiceId || inv._id}`}
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
                        ))
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Recent Payments Tab */}
            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {recentPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-700 mb-4">
                      <CreditCard className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentPayments.map((payment, index) => (
                      <motion.div
                        key={payment._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
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
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
