import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  Clock,
  TrendingUp,
  FileText,
  Wallet,
  Package,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  RefreshCw,
  Loader2,
  User,
  Award
} from 'lucide-react';
import { employeeService } from '../../services/employees/employeeService';
import { useMotionConfig, useFirstVisit } from '../../hooks';
import { EmployeeAnalyticsPageSkeleton } from './EmployeesPageSkeleton';

// Format duration in minutes to human readable
const formatDuration = (minutes) => {
  if (!minutes) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

// Stat Card Component - Responsive & Mobile-optimized
const StatCard = ({ icon: Icon, label, value, subValue, color = 'blue', delay = 0, isMobile = false, isFirstVisit }) => {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    accent: 'from-accent-500 to-accent-600',
    orange: 'from-orange-500 to-orange-600',
    emerald: 'from-emerald-500 to-emerald-600',
    pink: 'from-pink-500 to-pink-600'
  };

  return (
    <motion.div
      initial={isFirstVisit ? { opacity: 0, y: isMobile ? 10 : 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={isMobile ? { duration: 0.15 } : { delay, type: 'spring', stiffness: 300, damping: 24 }}
      className="bg-slate-800/50 rounded-xl p-3.5 sm:p-4 md:p-5 border border-slate-700/80 hover:border-slate-600 transition-colors flex flex-col justify-between"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-slate-400 text-xs sm:text-sm mb-0.5 sm:mb-1 truncate font-medium">{label}</p>
          <p
            className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate"
            title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          >
            {value}
          </p>
          {subValue && (
            <p className="text-slate-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">{subValue}</p>
          )}
        </div>
        <div className={`p-2 sm:p-2.5 md:p-3 rounded-xl bg-gradient-to-br ${colors[color]} shadow-md shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

// Leaderboard Card - Responsive & Mobile-optimized
const LeaderboardCard = ({ employees, metric, title, formatValue, isMobile = false, isFirstVisit }) => {
  const sorted = [...employees]
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .slice(0, 5);

  return (
    <motion.div
      initial={isFirstVisit ? { opacity: 0, y: isMobile ? 10 : 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={isMobile ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 24 }}
      className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border border-slate-700/80 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between gap-2 mb-3.5 sm:mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Award className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 shrink-0" />
          <h3 className="font-semibold text-white text-sm sm:text-base truncate">{title}</h3>
        </div>
        <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 shrink-0 font-medium">
          Top 5
        </span>
      </div>
      <div className="space-y-2 sm:space-y-2.5">
        {sorted.map((emp, index) => (
          <div
            key={emp.id}
            className="flex items-center gap-2.5 sm:gap-3 p-1 sm:p-1.5 rounded-lg hover:bg-slate-700/30 transition-colors"
          >
            <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 ${
              index === 0 ? 'bg-yellow-500 text-yellow-900 shadow-sm' :
              index === 1 ? 'bg-slate-300 text-slate-900 shadow-sm' :
              index === 2 ? 'bg-amber-600 text-amber-100 shadow-sm' :
              'bg-slate-700 text-slate-400'
            }`}>
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs sm:text-sm font-medium truncate" title={emp.name}>
                {emp.name}
              </p>
            </div>
            <span className="text-slate-300 text-xs sm:text-sm font-semibold tabular-nums shrink-0 ml-1">
              {formatValue ? formatValue(emp[metric]) : emp[metric]}
            </span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-slate-500 text-xs sm:text-sm text-center py-4">No data available</p>
        )}
      </div>
    </motion.div>
  );
};

// Employee Comparison Row - Responsive & Mobile-friendly
const ComparisonRow = ({ employee, maxSales, isFirstVisit }) => {
  const salesPercent = maxSales > 0 
    ? ((employee.period?.salesGenerated || 0) / maxSales * 100) 
    : 0;

  return (
    <motion.div
      initial={isFirstVisit ? { opacity: 0, x: -20 } : false}
      animate={{ opacity: 1, x: 0 }}
      className="bg-slate-800/30 hover:bg-slate-800/50 rounded-xl p-3.5 sm:p-4 border border-slate-700/60 transition-all"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 sm:gap-4">
        {/* Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3 md:w-52 lg:w-60 min-w-0 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-accent-600 flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0 shadow-sm">
            {employee.name?.charAt(0) || 'E'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-medium text-xs sm:text-sm truncate" title={employee.name}>
              {employee.name}
            </p>
            <p className="text-slate-500 text-[11px] sm:text-xs truncate">
              {employee.userId || employee.email || 'Employee'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 min-w-0 my-0.5 md:my-0">
          <div className="flex justify-between items-center mb-1 gap-2">
            <span className="text-slate-400 text-[11px] sm:text-xs font-medium">Sales Performance</span>
            <span className="text-white text-xs sm:text-sm font-semibold tabular-nums">
              {formatCurrency(employee.period?.salesGenerated)}
            </span>
          </div>
          <div className="h-2 bg-slate-700/80 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(2, salesPercent))}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 to-accent-500 rounded-full"
            />
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 p-2 sm:p-2.5 bg-slate-900/50 rounded-lg border border-slate-800/80 md:w-64 lg:w-72 text-center shrink-0">
          <div className="min-w-0">
            <p className="text-slate-400 text-[10px] sm:text-xs font-medium truncate">Invoices</p>
            <p className="text-white font-semibold text-xs sm:text-sm mt-0.5 tabular-nums truncate">
              {employee.period?.invoicesCreated || 0}
            </p>
          </div>
          <div className="min-w-0 border-x border-slate-800/80">
            <p className="text-slate-400 text-[10px] sm:text-xs font-medium truncate">Payments</p>
            <p className="text-white font-semibold text-xs sm:text-sm mt-0.5 tabular-nums truncate">
              {employee.period?.paymentsRecorded || 0}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-slate-400 text-[10px] sm:text-xs font-medium truncate">Session</p>
            <p className="text-white font-semibold text-xs sm:text-sm mt-0.5 tabular-nums truncate" title={formatDuration(employee.period?.totalSessionTime)}>
              {formatDuration(employee.period?.totalSessionTime)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function EmployeeAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [comparisonDays, setComparisonDays] = useState(30);
  
  // Mobile performance optimization
  const motionConfig = useMotionConfig();
  const { isMobile } = motionConfig;
  const isFirstVisit = useFirstVisit('employee-analytics');

  const fetchData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [analyticsData, comparisonData, sessionData] = await Promise.all([
        employeeService.getEmployeeAnalytics(),
        employeeService.getEmployeeComparison(comparisonDays),
        employeeService.getSessionSummary()
      ]);
      
      setAnalytics(analyticsData);
      setComparison(comparisonData);
      setSessionSummary(sessionData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [comparisonDays]);

  if (loading) {
    return <EmployeeAnalyticsPageSkeleton />;
  }

  const employees = analytics?.employees || [];
  const comparisonEmployees = comparison?.employees || [];
  const maxSales = Math.max(...comparisonEmployees.map(e => e.period?.salesGenerated || 0), 1);

  // Calculate totals
  const totalInvoices = employees.reduce((sum, e) => sum + (e.metrics?.invoicesCreatedCount || 0), 0);
  const totalSales = employees.reduce((sum, e) => sum + (e.metrics?.totalSalesGenerated || 0), 0);
  const totalPayments = employees.reduce((sum, e) => sum + (e.metrics?.paymentsRecordedCount || 0), 0);
  const totalSessionTime = employees.reduce((sum, e) => sum + (e.sessionStats?.monthDuration || 0), 0);

  return (
    <div className="px-3.5 py-4 sm:px-6 sm:py-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2.5 sm:gap-3 tracking-tight">
            <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-accent-500 shrink-0" />
            <span className="truncate">Employee Analytics</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Performance metrics and productivity insights for your team
          </p>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Link
            to="/employees"
            className="flex-1 sm:flex-initial text-center px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 transition-colors text-xs sm:text-sm font-medium shadow-sm"
          >
            Manage Employees
          </Link>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refresh analytics data"
            aria-label="Refresh analytics data"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-accent-400' : ''} />
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 md:gap-4">
        <StatCard
          icon={Users}
          label="Total Employees"
          value={employees.length}
          subValue={`${employees.filter(e => e.isActive).length} active`}
          color="blue"
          delay={0}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
        <StatCard
          icon={Activity}
          label="Online Now"
          value={sessionSummary?.stats?.activeNow || 0}
          color="green"
          delay={0.1}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
        <StatCard
          icon={FileText}
          label="Total Invoices"
          value={totalInvoices}
          color="accent"
          delay={0.2}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Sales"
          value={formatCurrency(totalSales)}
          color="emerald"
          delay={0.3}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
        <StatCard
          icon={Wallet}
          label="Payments"
          value={totalPayments}
          color="orange"
          delay={0.4}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
        <StatCard
          icon={Clock}
          label="Session Time"
          value={formatDuration(totalSessionTime)}
          subValue="This month"
          color="pink"
          delay={0.5}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
      </div>

      {/* Session Stats */}
      <motion.div
        initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 rounded-xl p-4 sm:p-5 md:p-6 border border-slate-700/80"
      >
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3.5 sm:mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
          Session Activity
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4">
          <div className="text-center p-3 sm:p-4 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
              {sessionSummary?.stats?.todayLogins || 0}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">Today's Logins</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
              {sessionSummary?.stats?.weekLogins || 0}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">This Week</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
              {sessionSummary?.stats?.monthLogins || 0}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">This Month</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
              {formatDuration(sessionSummary?.stats?.avgSessionDuration)}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">Avg. Session</p>
          </div>
        </div>
      </motion.div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        <LeaderboardCard
          employees={employees.map(e => ({ ...e, salesGenerated: e.metrics?.totalSalesGenerated }))}
          metric="salesGenerated"
          title="Top Sales Performers"
          formatValue={formatCurrency}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
        <LeaderboardCard
          employees={employees.map(e => ({ ...e, invoices: e.metrics?.invoicesCreatedCount }))}
          metric="invoices"
          title="Most Invoices Created"
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
        <LeaderboardCard
          employees={employees.map(e => ({ ...e, sessionTime: e.sessionStats?.monthDuration }))}
          metric="sessionTime"
          title="Most Active (Session Time)"
          formatValue={formatDuration}
          isMobile={isMobile}
          isFirstVisit={isFirstVisit}
        />
      </div>

      {/* Comparison Section */}
      <motion.div
        initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 rounded-xl p-4 sm:p-5 md:p-6 border border-slate-700/80"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-accent-400 shrink-0" />
            Performance Comparison
          </h2>
          <div className="flex items-center gap-2 bg-slate-900/70 px-3 py-1.5 rounded-lg border border-slate-700/70 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={comparisonDays}
              onChange={e => setComparisonDays(Number(e.target.value))}
              className="bg-transparent text-white text-xs sm:text-sm focus:outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value={7} className="bg-slate-900 text-white">Last 7 days</option>
              <option value={14} className="bg-slate-900 text-white">Last 14 days</option>
              <option value={30} className="bg-slate-900 text-white">Last 30 days</option>
              <option value={90} className="bg-slate-900 text-white">Last 90 days</option>
            </select>
          </div>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {comparisonEmployees.length > 0 ? (
            comparisonEmployees.map((employee) => (
              <ComparisonRow
                key={employee.id}
                employee={employee}
                maxSales={maxSales}
                isFirstVisit={isFirstVisit}
              />
            ))
          ) : (
            <div className="text-center py-10">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-600 mb-2.5" />
              <p className="text-slate-400 text-xs sm:text-sm">No employee data available for comparison</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Currently Active */}
      {sessionSummary?.activeSessions?.length > 0 && (
        <motion.div
          initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 rounded-xl p-4 sm:p-5 md:p-6 border border-slate-700/80"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 shrink-0" />
              Currently Active
            </h2>
            <span className="px-2.5 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-xs rounded-full font-medium">
              {sessionSummary.activeSessions.length} online
            </span>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {sessionSummary.activeSessions.map((session, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-900/70 rounded-lg border border-slate-700/70 text-xs sm:text-sm max-w-full"
              >
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                <span className="text-white font-medium truncate max-w-[140px] sm:max-w-[200px]" title={session.user?.name || session.user?.firmName || 'User'}>
                  {session.user?.name || session.user?.firmName || 'User'}
                </span>
                <span className="text-slate-500 text-[10px] sm:text-xs shrink-0">
                  ({session.userModel})
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
