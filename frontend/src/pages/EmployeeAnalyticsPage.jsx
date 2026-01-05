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
import { employeeService } from '../services/employeeService';
import { useMotionConfig } from '../hooks';

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

// Stat Card Component - Mobile optimized
const StatCard = ({ icon: Icon, label, value, subValue, color = 'blue', delay = 0, isMobile = false }) => {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    emerald: 'from-emerald-500 to-emerald-600',
    pink: 'from-pink-500 to-pink-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: isMobile ? 10 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={isMobile ? { duration: 0.15 } : { delay, type: 'spring', stiffness: 300, damping: 24 }}
      className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subValue && (
            <p className="text-slate-500 text-xs mt-1">{subValue}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

// Leaderboard Card - Mobile optimized
const LeaderboardCard = ({ employees, metric, title, formatValue, isMobile = false }) => {
  const sorted = [...employees]
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: isMobile ? 10 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={isMobile ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 24 }}
      className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
    >
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-yellow-400" />
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-3">
        {sorted.map((emp, index) => (
          <div key={emp.id} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              index === 0 ? 'bg-yellow-500 text-yellow-900' :
              index === 1 ? 'bg-slate-400 text-slate-900' :
              index === 2 ? 'bg-orange-600 text-orange-100' :
              'bg-slate-700 text-slate-400'
            }`}>
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{emp.name}</p>
            </div>
            <span className="text-slate-400 text-sm font-medium">
              {formatValue ? formatValue(emp[metric]) : emp[metric]}
            </span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4">No data available</p>
        )}
      </div>
    </motion.div>
  );
};

// Employee Comparison Row
const ComparisonRow = ({ employee, maxSales }) => {
  const salesPercent = maxSales > 0 
    ? ((employee.period?.salesGenerated || 0) / maxSales * 100) 
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 md:w-48">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {employee.name?.charAt(0) || 'E'}
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium truncate">{employee.name}</p>
            <p className="text-slate-500 text-xs">{employee.userId}</p>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex justify-between mb-1">
            <span className="text-slate-400 text-xs">Sales Performance</span>
            <span className="text-white text-sm font-medium">
              {formatCurrency(employee.period?.salesGenerated)}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${salesPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 md:w-72 text-center">
          <div>
            <p className="text-slate-500 text-xs">Invoices</p>
            <p className="text-white font-semibold">{employee.period?.invoicesCreated || 0}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Payments</p>
            <p className="text-white font-semibold">{employee.period?.paymentsRecorded || 0}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Session Time</p>
            <p className="text-white font-semibold">{formatDuration(employee.period?.totalSessionTime)}</p>
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
  const [comparisonDays, setComparisonDays] = useState(30);
  
  // Mobile performance optimization
  const motionConfig = useMotionConfig();
  const { isMobile } = motionConfig;

  const fetchData = async () => {
    setLoading(true);
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
    }
  };

  useEffect(() => {
    fetchData();
  }, [comparisonDays]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-500" />
            Employee Analytics
          </h1>
          <p className="text-slate-400">Performance metrics and insights for your team</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/employees"
            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium"
          >
            Manage Employees
          </Link>
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total Employees"
          value={employees.length}
          subValue={`${employees.filter(e => e.isActive).length} active`}
          color="blue"
          delay={0}
          isMobile={isMobile}
        />
        <StatCard
          icon={Activity}
          label="Online Now"
          value={sessionSummary?.stats?.activeNow || 0}
          color="green"
          delay={0.1}
          isMobile={isMobile}
        />
        <StatCard
          icon={FileText}
          label="Total Invoices"
          value={totalInvoices}
          color="purple"
          delay={0.2}
          isMobile={isMobile}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Sales"
          value={formatCurrency(totalSales)}
          color="emerald"
          delay={0.3}
          isMobile={isMobile}
        />
        <StatCard
          icon={Wallet}
          label="Payments"
          value={totalPayments}
          color="orange"
          delay={0.4}
          isMobile={isMobile}
        />
        <StatCard
          icon={Clock}
          label="Session Time"
          value={formatDuration(totalSessionTime)}
          subValue="This month"
          color="pink"
          delay={0.5}
          isMobile={isMobile}
        />
      </div>

      {/* Session Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 mb-8"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Session Activity
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-900/50 rounded-xl">
            <p className="text-3xl font-bold text-white">{sessionSummary?.stats?.todayLogins || 0}</p>
            <p className="text-slate-400 text-sm">Today's Logins</p>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-xl">
            <p className="text-3xl font-bold text-white">{sessionSummary?.stats?.weekLogins || 0}</p>
            <p className="text-slate-400 text-sm">This Week</p>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-xl">
            <p className="text-3xl font-bold text-white">{sessionSummary?.stats?.monthLogins || 0}</p>
            <p className="text-slate-400 text-sm">This Month</p>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-xl">
            <p className="text-3xl font-bold text-white">{formatDuration(sessionSummary?.stats?.avgSessionDuration)}</p>
            <p className="text-slate-400 text-sm">Avg. Session</p>
          </div>
        </div>
      </motion.div>

      {/* Leaderboards */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <LeaderboardCard
          employees={employees.map(e => ({ ...e, salesGenerated: e.metrics?.totalSalesGenerated }))}
          metric="salesGenerated"
          title="Top Sales Performers"
          formatValue={formatCurrency}
          isMobile={isMobile}
        />
        <LeaderboardCard
          employees={employees.map(e => ({ ...e, invoices: e.metrics?.invoicesCreatedCount }))}
          metric="invoices"
          title="Most Invoices Created"
          isMobile={isMobile}
        />
        <LeaderboardCard
          employees={employees.map(e => ({ ...e, sessionTime: e.sessionStats?.monthDuration }))}
          metric="sessionTime"
          title="Most Active (Session Time)"
          formatValue={formatDuration}
          isMobile={isMobile}
        />
      </div>

      {/* Comparison Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Performance Comparison
          </h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={comparisonDays}
              onChange={e => setComparisonDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {comparisonEmployees.length > 0 ? (
            comparisonEmployees.map((employee, index) => (
              <ComparisonRow
                key={employee.id}
                employee={employee}
                maxSales={maxSales}
              />
            ))
          ) : (
            <div className="text-center py-10">
              <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No employee data available for comparison</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Currently Active */}
      {sessionSummary?.activeSessions?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-slate-800/50 rounded-xl p-5 border border-slate-700"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            Currently Active
            <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              {sessionSummary.activeSessions.length} online
            </span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {sessionSummary.activeSessions.map((session, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-700"
              >
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white text-sm font-medium">
                  {session.user?.name || session.user?.firmName || 'User'}
                </span>
                <span className="text-slate-500 text-xs">
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
