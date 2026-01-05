import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  X,
  Eye,
  EyeOff,
  UserPlus,
  Users,
  Activity,
  DollarSign,
  AlertCircle,
  Check,
  Key,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { employeeService } from '../services/employeeService';
import { useMotionConfig } from '../hooks';

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
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

// Status Badge Component
const StatusBadge = ({ isActive }) => {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
      Inactive
    </span>
  );
};

// Create/Edit Employee Modal
const EmployeeModal = ({ isOpen, onClose, employee, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        password: '',
        phone: employee.phone || ''
      });
    } else {
      // Reset form completely for new employee
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: ''
      });
    }
    setError('');
    setShowPassword(false);
  }, [employee, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (employee) {
        // Update existing employee (don't send password if empty)
        const updateData = { ...formData };
        delete updateData.password;
        await employeeService.updateEmployee(employee.id, updateData);
      } else {
        // Create new employee
        if (!formData.password) {
          setError('Password is required for new employees');
          setLoading(false);
          return;
        }
        await employeeService.createEmployee(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              {employee ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="emp_name_new"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter full name"
                autoComplete="off"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="emp_email_new"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter email address"
                autoComplete="off"
                required
                disabled={!!employee}
              />
            </div>

            {!employee && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="emp_password_new"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2.5 pr-12 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Enter password (min 6 chars)"
                    autoComplete="new-password"
                    minLength={6}
                    required={!employee}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="emp_phone_new"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Optional"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {employee ? 'Update' : 'Create'}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Password Reset Modal
const PasswordResetModal = ({ isOpen, onClose, employee, onSave }) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNewPassword('');
    setError('');
    setShowPassword(false);
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await employeeService.resetPassword(employee.id, newPassword);
      onSave();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Reset Password</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-slate-400 mb-4">
            Reset password for <span className="text-white font-medium">{employee.name}</span>
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="emp_reset_password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    Reset Password
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Employee Card Component
const EmployeeCard = ({ employee, onEdit, onResetPassword, onToggleStatus, isMobile }) => {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggleStatus(employee.id, !employee.isActive);
    } finally {
      setToggling(false);
    }
  };

  return (
    <motion.div
      initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={isMobile ? { duration: 0.15 } : { type: 'spring', stiffness: 300 }}
      className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {employee.name?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            {/* Online indicator */}
            {employee.isOnline && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-800 animate-pulse" 
                    title="Currently online" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              {employee.name}
              {employee.isOnline && (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">Online</span>
              )}
            </h3>
            <p className="text-sm text-slate-400">{employee.email}</p>
          </div>
        </div>
        <StatusBadge isActive={employee.isActive} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Invoices</p>
          <p className="text-lg font-semibold text-white">{employee.metrics?.invoicesCreatedCount || 0}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Sales</p>
          <p className="text-lg font-semibold text-emerald-400">{formatCurrency(employee.metrics?.totalSalesGenerated)}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Payments</p>
          <p className="text-lg font-semibold text-white">{employee.metrics?.paymentsRecordedCount || 0}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Last Active</p>
          <p className="text-sm font-medium text-slate-300">{formatDate(employee.metrics?.lastActivityAt)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-700">
        <Link
          to={`/employees/${employee.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors text-sm"
        >
          <Eye size={14} />
          View
        </Link>
        <button
          onClick={() => onEdit(employee)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm"
        >
          <Edit2 size={14} />
          Edit
        </button>
        <button
          onClick={() => onResetPassword(employee)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors text-sm"
        >
          <Key size={14} />
          Reset Pass
        </button>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
            employee.isActive
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          {toggling ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : employee.isActive ? (
            <>
              <ToggleRight size={14} />
              Disable
            </>
          ) : (
            <>
              <ToggleLeft size={14} />
              Enable
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

// Main Page Component
export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalSales: 0
  });

  const motionConfig = useMotionConfig();
  const { isMobile } = motionConfig;

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getEmployees({ search: searchTerm, status: statusFilter });
      setEmployees(data.employees || []);
      
      // Calculate stats
      const activeCount = (data.employees || []).filter(e => e.isActive).length;
      const totalSales = (data.employees || []).reduce((sum, e) => sum + (e.metrics?.totalSalesGenerated || 0), 0);
      setStats({
        total: data.employees?.length || 0,
        active: activeCount,
        totalSales
      });
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    
    // Auto-refresh every 30 seconds to update online status
    const refreshInterval = setInterval(() => {
      fetchEmployees();
    }, 30 * 1000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [searchTerm, statusFilter]);

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setShowModal(true);
  };

  const handleResetPassword = (employee) => {
    setSelectedEmployee(employee);
    setShowPasswordModal(true);
  };

  const handleToggleStatus = async (id, newStatus) => {
    try {
      await employeeService.toggleStatus(id, newStatus);
      fetchEmployees();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleAddNew = () => {
    setSelectedEmployee(null);
    setShowModal(true);
  };

  // Stat cards data
  const statCards = [
    { label: 'Total Employees', value: stats.total, icon: Users, color: 'blue' },
    { label: 'Active', value: stats.active, icon: Activity, color: 'emerald' },
    { label: 'Total Sales', value: formatCurrency(stats.totalSales), icon: DollarSign, color: 'purple' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Employee Management</h1>
          <p className="text-slate-400 mt-1">Manage your team members and their access</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-shadow"
        >
          <UserPlus size={18} />
          Add Employee
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={isMobile ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={isMobile ? { duration: 0.15 } : { delay: index * 0.1 }}
            className={`bg-slate-800/50 rounded-xl border border-slate-700 p-5`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center`}>
                <stat.icon className={`text-${stat.color}-400`} size={24} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Employee Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-blue-400" size={32} />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-400">No employees found</h3>
          <p className="text-slate-500 mt-1">Add your first employee to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map(employee => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onEdit={handleEdit}
              onResetPassword={handleResetPassword}
              onToggleStatus={handleToggleStatus}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <EmployeeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        employee={selectedEmployee}
        onSave={fetchEmployees}
      />
      <PasswordResetModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        employee={selectedEmployee}
        onSave={fetchEmployees}
      />
    </div>
  );
}
