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
  RefreshCw
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
  
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState({ invoices: [], payments: [] });
  const [error, setError] = useState('');

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
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="animate-spin text-blue-400" size={32} />
      </div>
    );
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
      color: 'purple' 
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
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={isMobile ? {} : { scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/employees')}
          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </motion.button>
        
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
            {employee.name?.charAt(0)?.toUpperCase() || 'E'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              {employee.name}
              <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                employee.isActive 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-500/20 text-slate-400'
              }`}>
                {employee.isActive ? 'Active' : 'Inactive'}
              </span>
            </h1>
            <p className="text-slate-400">{employee.email}</p>
          </div>
        </div>

        <Link
          to={`/activity-log?employee=${id}`}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Activity size={18} />
          <span className="hidden sm:inline">View Activity Log</span>
        </Link>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-800/50 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center gap-3">
          <Mail size={18} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500">Email</p>
            <p className="text-white">{employee.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Phone size={18} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500">Phone</p>
            <p className="text-white">{employee.phone || 'Not provided'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500">Joined</p>
            <p className="text-white">{formatDate(employee.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500">Last Login</p>
            <p className="text-white">{formatDateTime(employee.lastLogin)}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={isMobile ? { duration: 0.15 } : { delay: index * 0.05 }}
            className="bg-slate-800/50 rounded-xl border border-slate-700 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : 'text-white'}`}>
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

      {/* Session Stats */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
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
              <p className="text-2xl font-bold text-white">{period.stats?.totalSessions || 0}</p>
              <p className="text-xs text-slate-500">sessions</p>
              <p className="text-sm text-blue-400 mt-1">{formatDuration(period.stats?.totalDuration || 0)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText size={20} className="text-blue-400" />
            Recent Invoices ({recentActivity.invoices?.length || 0})
          </h3>
          {recentActivity.invoices?.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.invoices.map((inv, i) => (
                <Link
                  key={i}
                  to={`/invoices/${inv._id}`}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">{inv.customer?.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-medium">{formatCurrency(inv.totals?.netTotal)}</p>
                    <p className="text-xs text-slate-500">{formatDate(inv.invoiceDate)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">No invoices created yet</p>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-green-400" />
            Recent Payments ({recentActivity.payments?.length || 0})
          </h3>
          {recentActivity.payments?.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.payments.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                >
                  <div>
                    <p className="text-white font-medium">{p.invoiceSnapshot?.invoiceNumber || 'Payment'}</p>
                    <p className="text-xs text-slate-400 capitalize">{p.paymentMethod}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-slate-500">{formatDate(p.paymentDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">No payments recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
