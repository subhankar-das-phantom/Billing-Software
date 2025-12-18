import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useInView, animate } from 'framer-motion';
import { 
  Package, 
  Users, 
  IndianRupee, 
  Calendar, 
  FileText, 
  FileClock, 
  AlertTriangle, 
  FilePlus,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  BarChart3,
  ShoppingCart
} from 'lucide-react';
import { dashboardService } from '../services/dashboardService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import MotionCard from '../components/Common/MotionCard';
import { useMotionConfig } from '../hooks';

// Animated Counter Component with adaptive duration
const AnimatedCounter = ({ value, duration, decimals = 0, prefix = '', suffix = '', isMobile = false }) => {
  const ref = useRef(null);
  const motionValue = useMotionValue(0);
  
  // Faster animation on mobile for snappier feel
  const actualDuration = isMobile ? Math.min(duration * 0.4, 0.8) : duration;
  const springConfig = isMobile 
    ? { damping: 60, stiffness: 150 }  // Stiffer, less bouncy on mobile
    : { damping: 50, stiffness: 100 };
    
  const springValue = useSpring(motionValue, springConfig);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  useEffect(() => {
    if (isInView) {
      animate(motionValue, value, { 
        duration: actualDuration,
        ease: 'easeOut'
      });
    }
  }, [isInView, value, motionValue, actualDuration]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        const displayValue = typeof value === 'number' && value % 1 !== 0 
          ? latest.toFixed(decimals)
          : Math.round(latest).toLocaleString();
        ref.current.textContent = `${prefix}${displayValue}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, prefix, suffix, decimals, value]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
};

// Desktop container variants (with stagger)
const containerVariantsDesktop = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

// Mobile container variants (no stagger for smoother scrolling)
const containerVariantsMobile = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0,
      delayChildren: 0
    }
  }
};

// Desktop item variants
const itemVariantsDesktop = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
};

// Mobile item variants (simpler, faster)
const itemVariantsMobile = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'tween',
      duration: 0.25,
      ease: 'easeOut'
    }
  }
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoicePeriod, setInvoicePeriod] = useState('all');
  const [filteredInvoiceCount, setFilteredInvoiceCount] = useState(0);
  
  // Adaptive motion configuration
  const motionConfig = useMotionConfig();
  const containerVariants = motionConfig.isMobile ? containerVariantsMobile : containerVariantsDesktop;
  const itemVariants = motionConfig.isMobile ? itemVariantsMobile : itemVariantsDesktop;

  useEffect(() => {
    loadDashboard();
  }, []);

  // Update filtered invoice count when period changes
  useEffect(() => {
    if (stats) {
      updateFilteredCount(invoicePeriod);
    }
  }, [invoicePeriod, stats]);

  const updateFilteredCount = async (period) => {
    if (period === 'all') {
      setFilteredInvoiceCount(stats?.totalInvoices || 0);
      return;
    }

    try {
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case '1m':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '6m':
          startDate.setMonth(now.getMonth() - 6);
          break;
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          setFilteredInvoiceCount(stats?.totalInvoices || 0);
          return;
      }

      const response = await dashboardService.getInvoiceCount(startDate.toISOString(), now.toISOString());
      setFilteredInvoiceCount(response.count || 0);
    } catch (error) {
      console.error('Failed to get filtered invoice count:', error);
      setFilteredInvoiceCount(stats?.totalInvoices || 0);
    }
  };

  const loadDashboard = async () => {
    try {
      const [statsData, lowStockData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getLowStock()
      ]);
      
      setStats(statsData.stats);
      setRecentInvoices(statsData.recentInvoices || []);
      setLowStock(lowStockData.products || []);
      setFilteredInvoiceCount(statsData.stats?.totalInvoices || 0);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const statCards = [
    { 
      label: 'Total Products', 
      value: stats?.totalProducts || 0, 
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      shadow: 'shadow-blue-500/20',
      bgLight: 'bg-blue-500/10'
    },
    { 
      label: 'Total Customers', 
      value: stats?.totalCustomers || 0, 
      icon: Users,
      color: 'from-emerald-500 to-emerald-600',
      shadow: 'shadow-emerald-500/20',
      bgLight: 'bg-emerald-500/10'
    },
    { 
      label: 'Today\'s Sales', 
      value: stats?.todaySales || 0, 
      icon: IndianRupee,
      color: 'from-yellow-500 to-orange-500',
      shadow: 'shadow-orange-500/20',
      bgLight: 'bg-orange-500/10',
      isCurrency: true
    },
    { 
      label: 'This Month', 
      value: stats?.monthSales || 0, 
      icon: Calendar,
      color: 'from-purple-500 to-purple-600',
      shadow: 'shadow-purple-500/20',
      bgLight: 'bg-purple-500/10',
      isCurrency: true
    },
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-12"
    >
      {/* Welcome Banner */}
      <motion.div
        variants={itemVariants}
        className="glass-card p-8 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent border-blue-500/20 relative overflow-hidden"
      >
        {/* Animated shimmer - Desktop only */}
        {motionConfig.shouldInfiniteAnimate && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <div className="relative z-10 flex items-center justify-between">
            <div>
              <motion.h1 
                className="text-3xl font-bold text-white mb-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                Welcome back! 👋
              </motion.h1>
              <motion.p
                className="text-slate-400 text-base leading-relaxed"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                Here's what's happening with your business today.
              </motion.p>
            </div>
          <motion.div
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Activity className="w-5 h-5 text-emerald-400" />
            <span className="text-slate-300 text-sm font-medium">System Active</span>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            whileHover={motionConfig.shouldHover ? { y: -8 } : undefined}
            className="stat-card border-none glass-card p-6 relative overflow-hidden group cursor-pointer"
          >
            {/* Animated background gradient */}
            <motion.div
              className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
            />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <motion.p 
                  className="text-sm text-slate-400 mb-3 font-medium tracking-wide"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: motionConfig.isMobile ? 0 : (0.2 + index * 0.1) }}
                >
                  {stat.label}
                </motion.p>
                <motion.p 
                  className="text-3xl font-bold text-white tracking-tight leading-tight"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: motionConfig.isMobile ? 0 : (0.3 + index * 0.1), type: 'spring', stiffness: 200 }}
                >
                  {stat.isCurrency ? (
                    <>₹<AnimatedCounter value={stat.value} duration={2} isMobile={motionConfig.isMobile} /></>
                  ) : (
                    <AnimatedCounter value={stat.value} duration={2} isMobile={motionConfig.isMobile} />
                  )}
                </motion.p>
              </div>
              
              <motion.div 
                className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg ${stat.shadow} relative overflow-hidden`}
                whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
                transition={{ duration: 0.3 }}
              >
                <stat.icon className="w-6 h-6 text-white relative z-10" />
              </motion.div>
            </div>

            {/* Trend indicator */}
            {(() => {
              const growthKeys = ['totalProducts', 'totalCustomers', 'todaySales', 'monthSales'];
              const growth = stats?.growth?.[growthKeys[index]];
              
              // Handle no data case
              if (growth === null || growth === undefined) {
                return null;
              }
              
              const isPositive = growth >= 0;
              const GrowthIcon = isPositive ? TrendingUp : TrendingDown;
              const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
              const sign = isPositive ? '+' : '';
              
              return (
                <motion.div
                  className="mt-5 pt-3 border-t border-slate-700/30 flex items-center gap-2 text-xs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <GrowthIcon className={`w-3 h-3 ${colorClass}`} />
                  <span className={`${colorClass} font-medium`}>{sign}{growth}%</span>
                  <span className="text-slate-500">vs last period</span>
                </motion.div>
              );
            })()}
          </motion.div>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Invoices with Filter */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.03, y: -4 }}
          className="glass-card p-6 hover:border-slate-600 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <select
              value={invoicePeriod}
              onChange={(e) => setInvoicePeriod(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="all">All Time</option>
              <option value="1m">1 Month</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
          </div>
          <div className="flex items-center gap-5">
            <motion.div 
              className="p-4 rounded-xl bg-blue-500/20 text-blue-400 relative overflow-hidden"
              whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
              transition={{ duration: 0.3 }}
            >
              <FileText size={28} className="relative z-10" />
            </motion.div>
            <div>
              <motion.p 
                className="text-3xl font-bold text-white mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <AnimatedCounter value={filteredInvoiceCount} duration={1.5} isMobile={motionConfig.isMobile} />
              </motion.p>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                {invoicePeriod === 'all' ? 'Total Invoices' : 
                 invoicePeriod === '1m' ? 'Invoices (1 Month)' :
                 invoicePeriod === '6m' ? 'Invoices (6 Months)' : 'Invoices (1 Year)'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Today's Invoices */}
        <motion.div
          variants={itemVariants}
          whileHover={motionConfig.shouldHover ? { scale: 1.02, y: -4 } : undefined}
          className="glass-card p-6 hover:border-slate-600 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-5">
            <motion.div 
              className="p-4 rounded-xl bg-green-500/20 text-green-400 relative overflow-hidden"
              whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
              transition={{ duration: 0.3 }}
            >
              <FileClock size={28} className="relative z-10" />
            </motion.div>
            <div>
              <motion.p 
                className="text-3xl font-bold text-white mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <AnimatedCounter value={stats?.todayInvoices || 0} duration={1.5} isMobile={motionConfig.isMobile} />
              </motion.p>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">Today's Invoices</p>
            </div>
          </div>
        </motion.div>

        {/* Low Stock Items */}
        <motion.div
          variants={itemVariants}
          whileHover={motionConfig.shouldHover ? { scale: 1.02, y: -4 } : undefined}
          className="glass-card p-6 hover:border-slate-600 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-5">
            <motion.div 
              className={`p-4 rounded-xl ${(stats?.lowStockCount || 0) > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'} relative overflow-hidden`}
              whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
              transition={{ duration: 0.3 }}
            >
              <AlertTriangle size={28} className="relative z-10" />
            </motion.div>
            <div>
              <motion.p 
                className="text-3xl font-bold text-white mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <AnimatedCounter value={stats?.lowStockCount || 0} duration={1.5} isMobile={motionConfig.isMobile} />
              </motion.p>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">Low Stock Items</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Invoices & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Invoices */}
        <motion.div variants={itemVariants} className="glass-card overflow-hidden">
          <div className="p-6 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
            <div className="flex items-center gap-4">
              <motion.div
                className="p-2 bg-blue-500/20 rounded-lg"
                whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
                transition={{ duration: 0.3 }}
              >
                <TrendingUp size={20} className="text-blue-400" />
              </motion.div>
              <h2 className="text-lg font-semibold text-white">Recent Invoices</h2>
            </div>
            <Link to="/invoices" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group">
              View all 
              {motionConfig.shouldInfiniteAnimate ? (
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight size={14} />
                </motion.div>
              ) : (
                <ArrowRight size={14} />
              )}
            </Link>
          </div>
          
          <div className="p-6">
            <AnimatePresence mode="wait">
              {recentInvoices.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-slate-400 text-center py-8"
                >
                  No invoices yet
                </motion.p>
              ) : (
                <motion.div
                  key="list"
                  className="space-y-4"
                  initial="hidden"
                  animate="show"
                  variants={{
                    show: { transition: { staggerChildren: motionConfig.shouldStagger ? 0.05 : 0 } }
                  }}
                >
                  {recentInvoices.map((invoice, index) => (
                    <motion.div
                      key={invoice._id}
                      variants={{
                        hidden: { opacity: 0, x: -20 },
                        show: { opacity: 1, x: 0 }
                      }}
                      whileHover={motionConfig.shouldHover ? { x: 4, backgroundColor: 'rgba(51, 65, 85, 0.8)' } : undefined}
                    >
                      <Link 
                        to={`/invoices/${invoice._id}`}
                        className="flex items-center justify-between p-5 rounded-xl bg-slate-800/50 transition-all border border-transparent hover:border-slate-700 group"
                      >
                        <div className="flex items-center gap-4">
                          <motion.div 
                            className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors"
                            whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
                            transition={{ duration: 0.5 }}
                          >
                            <FileText size={20} />
                          </motion.div>
                          <div>
                            <p className="font-medium text-white group-hover:text-blue-400 transition-colors mb-1">
                              {invoice.invoiceNumber}
                            </p>
                            <p className="text-sm text-slate-400 leading-relaxed">{invoice.customer?.customerName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-emerald-400 mb-1">{formatCurrency(invoice.totals?.netTotal)}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{formatDate(invoice.invoiceDate)}</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Low Stock Alert */}
        <motion.div variants={itemVariants} className="glass-card overflow-hidden">
          <div className="p-6 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-2 bg-red-500/20 rounded-lg"
                animate={{ 
                  scale: lowStock.length > 0 ? [1, 1.1, 1] : 1
                }}
                transition={{
                  duration: 2,
                  repeat: lowStock.length > 0 ? Infinity : 0
                }}
              >
                <AlertTriangle size={20} className="text-red-400" />
              </motion.div>
              <h2 className="text-lg font-semibold text-white">Low Stock Alert</h2>
            </div>
            <Link to="/products" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group">
              View all 
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowRight size={14} />
              </motion.div>
            </Link>
          </div>
          
          <div className="p-5">
            <AnimatePresence mode="wait">
              {lowStock.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center py-8"
                >
                  <motion.div 
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 mb-3"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </motion.div>
                  <p className="text-slate-400">All products are well stocked!</p>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  className="space-y-4"
                  initial="hidden"
                  animate="show"
                  variants={{
                    show: { transition: { staggerChildren: 0.05 } }
                  }}
                >
                  {lowStock.map((product, index) => (
                    <motion.div 
                      key={product._id}
                      variants={{
                        hidden: { opacity: 0, x: -20 },
                        show: { opacity: 1, x: 0 }
                      }}
                      whileHover={{ x: 4, scale: 1.02 }}
                      className="flex items-center justify-between p-5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <motion.div 
                          className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400"
                          whileHover={{ rotate: [0, -10, 10, 0] }}
                          transition={{ duration: 0.4 }}
                        >
                          <Package size={20} />
                        </motion.div>
                        <div>
                          <p className="font-medium text-white mb-1">{product.productName}</p>
                          <p className="text-sm text-slate-400 leading-relaxed">Batch: {product.batchNo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-400 mb-1">{product.currentStockQty} {product.unit}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">Remaining</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="glass-card p-8">
        <div className="flex items-center gap-4 mb-8">
          <motion.div
            className="p-2 bg-purple-500/20 rounded-lg"
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            <Zap size={20} className="text-purple-400" />
          </motion.div>
          <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { to: '/invoices/create', icon: FilePlus, label: 'New Invoice', color: 'from-blue-500/10 to-purple-500/10', borderColor: 'border-blue-500/20', hoverBorder: 'hover:border-blue-400/50', iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400' },
            { to: '/products', icon: Package, label: 'Products', color: 'bg-slate-800/50', borderColor: 'border-slate-700/50', hoverBorder: 'hover:border-slate-600', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
            { to: '/customers', icon: Users, label: 'Customers', color: 'bg-slate-800/50', borderColor: 'border-slate-700/50', hoverBorder: 'hover:border-slate-600', iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400' },
            { to: '/invoices', icon: FileText, label: 'Invoices', color: 'bg-slate-800/50', borderColor: 'border-slate-700/50', hoverBorder: 'hover:border-slate-600', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-400' }
          ].map((action, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link 
                to={action.to}
                className={`flex flex-col gap-4 items-center justify-center p-8 rounded-xl bg-gradient-to-br ${action.color} border ${action.borderColor} ${action.hoverBorder} transition-all group relative overflow-hidden`}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5"
                  initial={{ x: '-100%', y: '-100%' }}
                  whileHover={{ x: '100%', y: '100%' }}
                  transition={{ duration: 0.6 }}
                />
                <motion.div 
                  className={`p-4 rounded-full ${action.iconBg} ${action.iconColor} mb-4 relative z-10`}
                  whileHover={{ rotate: 360, scale: 1.15 }}
                  transition={{ duration: 0.6 }}
                >
                  <action.icon size={26} />
                </motion.div>
                <span className="text-sm font-medium text-white relative z-10 leading-relaxed">{action.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
