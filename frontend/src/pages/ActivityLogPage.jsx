import { useState, useEffect, useCallback } from 'react';
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
import { employeeService } from '../services/employeeService';
import { useMotionConfig } from '../hooks';

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

// Session Card Component - Mobile optimized
const SessionCard = ({ entry, isMobile }) => {
  const [expanded, setExpanded] = useState(false);
  const { session, employee, activities, summary } = entry;

  const hasActivities = summary.invoiceCount > 0 || summary.paymentCount > 0 || 
                        summary.productsAdded > 0 || summary.productsUpdated > 0;

  return (
    <motion.div
      initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={isMobile ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 24 }}
      className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors"
    >
      {/* Header - Always visible */}
      <div 
        className={`p-4 ${hasActivities ? 'cursor-pointer' : ''}`}
        onClick={() => hasActivities && setExpanded(!expanded)}
      >
        {/* Top row: Employee + Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Employee Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              {employee.name?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            
            <div>
              <h3 className="font-semibold text-white">{employee.name}</h3>
              <p className="text-xs text-slate-500">{employee.email}</p>
            </div>
          </div>

          {/* Duration Badge */}
          <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            session.isActive 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-slate-700/50 text-slate-300'
          }`}>
            {session.isActive ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {formatDuration(session.duration)}
              </span>
            )}
          </div>
        </div>

        {/* Time row */}
        <div className="flex items-center gap-4 text-sm mb-3 pl-1">
          <div className="flex items-center gap-2">
            <LogIn size={14} className="text-emerald-400" />
            <span className="text-slate-300">{formatDateTime(session.loginTime)}</span>
          </div>
          {session.logoutTime && (
            <div className="flex items-center gap-2">
              <LogOutIcon size={14} className="text-red-400" />
              <span className="text-slate-400">{formatTime(session.logoutTime)}</span>
            </div>
          )}
        </div>

        {/* Quick Summary - Stats row */}
        <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg bg-blue-500/10">
            <FileText size={14} className="text-blue-400" />
            <span className="text-blue-300 font-medium">{summary.invoiceCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg bg-green-500/10">
            <Wallet size={14} className="text-green-400" />
            <span className="text-green-300 font-medium">{summary.paymentCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg bg-orange-500/10">
            <Package size={14} className="text-orange-400" />
            <span className="text-orange-300 font-medium">{summary.productsAdded + summary.productsUpdated}</span>
          </div>
          {summary.totalSales > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg bg-emerald-500/10">
              <TrendingUp size={14} className="text-emerald-400" />
              <span className="text-emerald-300 font-medium">{formatCurrency(summary.totalSales)}</span>
            </div>
          )}
          
          {/* Expand Icon */}
          {hasActivities && (
            <button className="ml-auto p-1 text-slate-400 hover:text-white transition-colors">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
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
            className="border-t border-slate-700 bg-slate-900/50"
          >
            <div className="p-4 space-y-4">
              {/* Invoices Created */}
              {activities.invoicesCreated.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                    <FileText size={14} /> Invoices Created ({activities.invoicesCreated.length})
                  </h4>
                  <div className="space-y-2">
                    {activities.invoicesCreated.map((inv, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-slate-800/80 rounded-lg p-3 border border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <span className="text-white font-medium">{inv.invoiceNumber}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{inv.customer}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-emerald-400 font-medium">{formatCurrency(inv.amount)}</span>
                          <span className="text-slate-500 text-xs">{formatTime(inv.time)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payments Recorded */}
              {activities.paymentsRecorded.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                    <Wallet size={14} /> Payments Recorded ({activities.paymentsRecorded.length})
                  </h4>
                  <div className="space-y-2">
                    {activities.paymentsRecorded.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-slate-800/80 rounded-lg p-3 border border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <span className="text-white">{p.invoiceNumber || 'Invoice'}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 capitalize">{p.method}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-green-400 font-medium">{formatCurrency(p.amount)}</span>
                          <span className="text-slate-500 text-xs">{formatTime(p.time)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products Added */}
              {activities.productsAdded.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-orange-400 mb-2 flex items-center gap-2">
                    <Package size={14} /> Products Added ({activities.productsAdded.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activities.productsAdded.map((p, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-orange-500/10 text-orange-300 rounded-lg text-sm border border-orange-500/20">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Products Updated */}
              {activities.productsUpdated.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                    <Package size={14} /> Products Updated ({activities.productsUpdated.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activities.productsUpdated.map((p, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-yellow-500/10 text-yellow-300 rounded-lg text-sm border border-yellow-500/20">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Main Page Component
export default function ActivityLogPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activityLog, setActivityLog] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [timeRange, setTimeRange] = useState(24);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialEmployeeLoaded, setInitialEmployeeLoaded] = useState(false);

  // Mobile optimization
  const { isMobile } = useMotionConfig();

  const timeRangeOptions = [
    { value: 6, label: 'Last 6h' },
    { value: 12, label: 'Last 12h' },
    { value: 24, label: 'Last 24h' },
    { value: 48, label: 'Last 48h' },
    { value: 72, label: 'Last 72h' }
  ];

  const fetchActivityLog = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await employeeService.getActivityLog(timeRange, selectedEmployee?.id || null);
      setActivityLog(data.log || []);
      setEmployees(data.employees || []);
      
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
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.email.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  // Calculate totals
  const totals = activityLog.reduce((acc, entry) => ({
    sessions: acc.sessions + 1,
    invoices: acc.invoices + entry.summary.invoiceCount,
    payments: acc.payments + entry.summary.paymentCount,
    sales: acc.sales + entry.summary.totalSales
  }), { sessions: 0, invoices: 0, payments: 0, sales: 0 });

  const clearEmployeeFilter = () => {
    setSelectedEmployee(null);
    setEmployeeSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
              <Activity size={20} className="text-white" />
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
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
          <div className="flex rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
            {timeRangeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  timeRange === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
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
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {(selectedEmployee || employeeSearch) && (
              <button 
                onClick={clearEmployeeFilter}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
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
                  className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto"
                >
                  {filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setEmployeeSearch('');
                        setShowEmployeeDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {emp.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{emp.name}</p>
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
          { label: 'Sessions', value: totals.sessions, color: 'slate', icon: Clock },
          { label: 'Invoices', value: totals.invoices, color: 'blue', icon: FileText },
          { label: 'Payments', value: totals.payments, color: 'green', icon: Wallet },
          { label: 'Total Sales', value: formatCurrency(totals.sales), color: 'emerald', icon: TrendingUp },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={isMobile ? { duration: 0.15 } : { delay: index * 0.05 }}
            className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                <p className={`text-xl font-bold text-${stat.color === 'slate' ? 'white' : stat.color + '-400'}`}>
                  {stat.value}
                </p>
              </div>
              <stat.icon size={20} className={`text-${stat.color === 'slate' ? 'slate-500' : stat.color + '-400'}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity Log */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-blue-400" size={32} />
        </div>
      ) : activityLog.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Clock className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-400">No sessions found</h3>
          <p className="text-slate-500 mt-1">
            {selectedEmployee 
              ? `No activity for ${selectedEmployee.name} in the selected time range`
              : 'No activity in the selected time range'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activityLog.map((entry, index) => (
            <SessionCard 
              key={entry.session.id || index} 
              entry={entry} 
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
