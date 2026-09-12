import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  FileText,
  Wallet,
  TrendingUp,
  Activity,
  RefreshCw,
  MapPin,
  CreditCard,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { employeeService } from '../../services/employees/employeeService';
import { useMotionConfig, useFirstVisit } from '../../hooks';
import EmployeePermissionsEditor from '../../components/Employees/EmployeePermissionsEditor';
import { EmployeeDetailPageSkeleton } from './EmployeeDetailPageSkeleton';

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

// Format date
const formatDate = (date) => {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Format datetime
const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format duration in minutes
const formatDuration = (minutes) => {
  if (!minutes) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useMotionConfig();
  const isFirstVisit = useFirstVisit('employee-details');
  
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState({ invoices: [], payments: [] });
  const [error, setError] = useState('');
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const DISPLAY_LIMIT = 5;

  const fetchEmployeeDetails = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getEmployeeDetails(id);
      if (data.success) {
        setEmployee(data.employee);
        setSessionStats(data.sessionStats);
        setRecentActivity(data.recentActivity || { invoices: [], payments: [] });
      }
    } catch (err) {
      setError('Failed to load employee details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeDetails();
  }, [id]);

  if (loading) {
    return <EmployeeDetailPageSkeleton />;
  }

  if (error || !employee) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error || 'Employee not found'}</p>
        <button 
          onClick={() => navigate('/employees')}
          className="mt-4 text-blue-400 hover:underline"
        >
          Back to Employees
        </button>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Invoices Created', 
      value: employee.metrics?.invoicesCreatedCount || 0, 
      icon: FileText, 
      color: 'blue' 
    },
    { 
      label: 'Total Sales', 
      value: formatCurrency(employee.metrics?.totalSalesGenerated), 
      icon: TrendingUp, 
      color: 'emerald' 
    },
    { 
      label: 'Payments Recorded', 
      value: employee.metrics?.paymentsRecordedCount || 0, 
      icon: Wallet, 
      color: 'accent' 
    },
    { 
      label: 'Today\'s Session', 
      value: formatDuration(sessionStats?.today?.totalDuration || 0), 
      icon: Clock, 
      color: 'orange' 
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <motion.button
            whileHover={isMobile ? {} : { scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/employees')}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </motion.button>
          
          <div className="w-14 h-14 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl shrink-0">
            {employee.name?.charAt(0)?.toUpperCase() || 'E'}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex flex-wrap items-center gap-2">
              <span className="truncate max-w-full">{employee.name}</span>
              <span className={`text-xs sm:text-sm px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                employee.isActive 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-500/20 text-slate-400'
              }`}>
                {employee.isActive ? 'Active' : 'Inactive'}
              </span>
            </h1>
            <p className="text-slate-400 truncate">{employee.email}</p>
          </div>
        </div>

        <Link
          to={`/activity-log?employee=${id}`}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
        >
          <Activity size={18} />
          <span>View Activity Log</span>
        </Link>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-3">
          <Mail size={18} className="text-slate-500" />
          <div className="overflow-hidden">
            <p className="text-xs text-slate-500">Email</p>
            <p className="text-slate-100 truncate" title={employee.email}>{employee.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Phone size={18} className="text-slate-500" />
          <div className="overflow-hidden">
            <p className="text-xs text-slate-500">Phone</p>
            <p className="text-slate-100 truncate" title={employee.phone || 'Not provided'}>{employee.phone || 'Not provided'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MapPin size={18} className="text-slate-500" />
          <div className="overflow-hidden">
            <p className="text-xs text-slate-500">Address</p>
            <p className="text-slate-100 truncate" title={employee.address || 'Not provided'}>{employee.address || 'Not provided'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CreditCard size={18} className="text-slate-500" />
          <div className="overflow-hidden">
            <p className="text-xs text-slate-500">Gov ID</p>
            <p className="text-slate-100 truncate" title={employee.govId?.number ? `${employee.govId.type} - ${employee.govId.number}` : 'Not provided'}>
              {employee.govId?.number ? `${employee.govId.type} - ${employee.govId.number}` : 'Not provided'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-slate-500" />
          <div className="overflow-hidden">
            <p className="text-xs text-slate-500">Date of Birth</p>
            <p className="text-slate-100 truncate">{formatDate(employee.dob)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-slate-500" />
          <div className="overflow-hidden">
            <p className="text-xs text-slate-500">Joined</p>
            <p className="text-slate-100 truncate">{formatDate(employee.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-slate-500" />
          <div className="overflow-hidden">
            <p className="text-xs text-slate-500">Last Login</p>
            <p className="text-slate-100 truncate">{formatDate(employee.lastLogin)}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={isFirstVisit ? (isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }) : false}
            animate={{ opacity: 1, y: 0 }}
            transition={isMobile ? { duration: 0.15 } : { delay: index * 0.05 }}
            className="bg-slate-900 rounded-xl border border-slate-800 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : 'text-slate-100'}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/20 flex items-center justify-center`}>
                <stat.icon className={`text-${stat.color}-400`} size={20} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Permissions Editor */}
      <EmployeePermissionsEditor 
        employee={employee} 
        onUpdate={(updatedEmployee) => setEmployee(updatedEmployee)} 
      />

      {/* Session Stats */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <Clock size={20} className="text-blue-400" />
          Session Statistics
        </h3>
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'Today', stats: sessionStats?.today },
            { label: 'This Week', stats: sessionStats?.thisWeek },
            { label: 'This Month', stats: sessionStats?.thisMonth },
          ].map(period => (
            <div key={period.label} className="text-center">
              <p className="text-sm text-slate-400 mb-2">{period.label}</p>
              <p className="text-2xl font-bold text-slate-100">{period.stats?.totalSessions || 0}</p>
              <p className="text-xs text-slate-500">sessions</p>
              <p className="text-sm text-blue-400 mt-1">{formatDuration(period.stats?.totalDuration || 0)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-slate-100 flex items-center gap-2">
              <FileText size={18} className="text-blue-400" />
              Recent Invoices ({recentActivity.invoices?.length || 0})
            </h3>
            {recentActivity.invoices?.length > DISPLAY_LIMIT && (
              <span className="text-xs text-slate-400 font-mono">
                Showing {showAllInvoices ? recentActivity.invoices.length : DISPLAY_LIMIT} of {recentActivity.invoices.length}
              </span>
            )}
          </div>
          {recentActivity.invoices?.length > 0 ? (
            <div>
              <div className={showAllInvoices && recentActivity.invoices.length > DISPLAY_LIMIT ? "space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1" : "space-y-2.5"}>
                {(showAllInvoices ? recentActivity.invoices : recentActivity.invoices.slice(0, DISPLAY_LIMIT)).map((inv, i) => (
                  <Link
                    key={i}
                    to={`/invoices/${inv._id}`}
                    className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-slate-100 font-medium font-mono text-sm">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-400 truncate">{inv.customer?.customerName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-400 font-mono font-semibold text-sm">{formatCurrency(inv.totals?.netTotal)}</p>
                      <p className="text-xs text-slate-500 font-mono">{formatDate(inv.invoiceDate)}</p>
                    </div>
                  </Link>
                ))}
              </div>
              {recentActivity.invoices.length > DISPLAY_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllInvoices(!showAllInvoices)}
                  className="mt-3 text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg hover:bg-blue-500/10 border border-blue-500/20 active:scale-95"
                >
                  {showAllInvoices ? (
                    <>
                      <ChevronUp size={14} />
                      <span>Show fewer ({DISPLAY_LIMIT} items)</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      <span>Show all {recentActivity.invoices.length} invoices (+{recentActivity.invoices.length - DISPLAY_LIMIT} more)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4 text-sm">No invoices created yet</p>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Wallet size={18} className="text-emerald-400" />
              Recent Payments ({recentActivity.payments?.length || 0})
            </h3>
            {recentActivity.payments?.length > DISPLAY_LIMIT && (
              <span className="text-xs text-slate-400 font-mono">
                Showing {showAllPayments ? recentActivity.payments.length : DISPLAY_LIMIT} of {recentActivity.payments.length}
              </span>
            )}
          </div>
          {recentActivity.payments?.length > 0 ? (
            <div>
              <div className={showAllPayments && recentActivity.payments.length > DISPLAY_LIMIT ? "space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1" : "space-y-2.5"}>
                {(showAllPayments ? recentActivity.payments : recentActivity.payments.slice(0, DISPLAY_LIMIT)).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-slate-100 font-medium font-mono text-sm">{p.invoiceSnapshot?.invoiceNumber || 'Payment'}</p>
                      <p className="text-xs text-slate-400 capitalize truncate">{p.paymentMethod}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-400 font-mono font-semibold text-sm">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-slate-500 font-mono">{formatDate(p.paymentDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {recentActivity.payments.length > DISPLAY_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllPayments(!showAllPayments)}
                  className="mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg hover:bg-emerald-500/10 border border-emerald-500/20 active:scale-95"
                >
                  {showAllPayments ? (
                    <>
                      <ChevronUp size={14} />
                      <span>Show fewer ({DISPLAY_LIMIT} items)</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      <span>Show all {recentActivity.payments.length} payments (+{recentActivity.payments.length - DISPLAY_LIMIT} more)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4 text-sm">No payments recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
