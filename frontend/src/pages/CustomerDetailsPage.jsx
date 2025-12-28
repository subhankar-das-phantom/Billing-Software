import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Plus,
  TrendingUp,
  Calendar,
  Package,
  DollarSign,
  CheckCircle,
  Printer,
  XCircle,
  User,
  Wallet,
  CreditCard,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { customerService } from '../services/customerService';
import { getPaymentsByCustomer, getPaymentStatusColor } from '../services/creditService';
import { invoiceService } from '../services/invoiceService';
import { formatCurrency, formatDate, formatPhone } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import RecordPaymentModal from '../components/Common/RecordPaymentModal';

// Animated counter component
const AnimatedCounter = ({ value, prefix = '', suffix = '' }) => {
  const ref = useRef(null);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = endValue;
    
    if (startValue === endValue) return;
    
    const duration = 500;
    const startTime = Date.now();
    
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;
      
      if (ref.current) {
        ref.current.textContent = `${prefix}${Math.round(current).toLocaleString()}${suffix}`;
      }
      
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    
    requestAnimationFrame(tick);
  }, [value, prefix, suffix]);

  return <span ref={ref}>{prefix}{Math.round(value).toLocaleString()}{suffix}</span>;
};

export default function CustomerDetailsPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoices');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async (bypassCache = false) => {
    try {
      const [customerData, paymentsData] = await Promise.all([
        customerService.getCustomer(id, !bypassCache), // Pass false to bypass cache
        getPaymentsByCustomer(id).catch(() => ({ payments: [] }))
      ]);
      setCustomer(customerData.customer);
      setInvoices(customerData.invoices || []);
      setPayments(paymentsData.payments || []);
    } catch (error) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Bypass cache to get fresh data after payment
    await loadCustomer(true);
  };

  const handleRecordPayment = (invoice = null) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  // Get unpaid/partial invoices for payment modal (only invoices with remaining balance)
  const unpaidInvoices = invoices.filter(inv => {
    if (inv.status === 'Cancelled') return false;
    if (inv.paymentStatus === 'Paid') return false;
    
    // Also check actual remaining amount in case paymentStatus is not updated
    const remaining = (inv.totals?.netTotal || 0) - (inv.paidAmount || 0);
    return remaining > 0;
  });

  // Calculate outstanding balance from actual invoices (more reliable than customer.outstandingBalance)
  const calculatedOutstanding = invoices.reduce((sum, inv) => {
    if (inv.status === 'Cancelled') return sum;
    const remaining = (inv.totals?.netTotal || 0) - (inv.paidAmount || 0);
    return sum + (remaining > 0 ? remaining : 0);
  }, 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    }
  };

  const tableRowVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    })
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!customer) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4"
        >
          <XCircle className="w-8 h-8 text-red-400" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400 mb-4"
        >
          Customer not found
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link to="/customers" className="btn btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to Customers
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  const statusConfig = {
    Created: { icon: FileText, class: 'badge-info', color: 'text-blue-400' },
    Printed: { icon: Printer, class: 'badge-success', color: 'text-green-400' },
    Cancelled: { icon: XCircle, class: 'badge-danger', color: 'text-red-400' }
  };

  const paymentStatusConfig = {
    Paid: { class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
    Partial: { class: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
    Unpaid: { class: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle }
  };

  const tabs = [
    { id: 'invoices', label: 'Invoices', icon: FileText, count: invoices.length },
    { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.length }
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Back Button */}
      <motion.div variants={itemVariants}>
        <Link
          to="/customers"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <motion.div
            whileHover={{ x: -4 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <ArrowLeft className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
          </motion.div>
          Back to Customers
        </Link>
      </motion.div>

      {/* Customer Info Card */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Avatar */}
          <motion.div
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30 relative overflow-hidden"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <span className="text-white font-bold text-3xl relative z-10">
              {customer.customerName?.charAt(0)}
            </span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-teal-600 to-emerald-500"
              initial={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>

          {/* Customer Details */}
          <div className="flex-1">
            <motion.h1
              className="text-2xl font-bold text-white mb-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              {customer.customerName}
            </motion.h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Phone */}
              <motion.div
                className="flex items-center gap-2 text-sm group"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ x: 4 }}
              >
                <Phone className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                <span className="text-slate-500">Phone:</span>
                <span className="text-slate-300">{formatPhone(customer.phone)}</span>
              </motion.div>

              {/* Email */}
              {customer.email && (
                <motion.div
                  className="flex items-center gap-2 text-sm group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ x: 4 }}
                >
                  <Mail className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-300">{customer.email}</span>
                </motion.div>
              )}

              {/* GSTIN */}
              {customer.gstin && (
                <motion.div
                  className="flex items-center gap-2 text-sm group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ x: 4 }}
                >
                  <FileText className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
                  <span className="text-slate-500">GSTIN:</span>
                  <span className="text-slate-300">{customer.gstin}</span>
                </motion.div>
              )}

              {/* DL No */}
              {customer.dlNo && (
                <motion.div
                  className="flex items-center gap-2 text-sm group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ x: 4 }}
                >
                  <FileText className="w-4 h-4 text-slate-500 group-hover:text-yellow-400 transition-colors" />
                  <span className="text-slate-500">DL No:</span>
                  <span className="text-slate-300">{customer.dlNo}</span>
                </motion.div>
              )}

              {/* Address */}
              {customer.address && (
                <motion.div
                  className="md:col-span-2 flex items-start gap-2 text-sm group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ x: 4 }}
                >
                  <MapPin className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500">Address:</span>
                  <span className="text-slate-300">{customer.address}</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="flex flex-wrap lg:flex-nowrap gap-4">
            {/* Total Purchases */}
            <motion.div
              className="text-center px-6 py-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/50 transition-colors group relative overflow-hidden"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <motion.div
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 mb-2"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </motion.div>
              <p className="text-2xl font-bold text-emerald-400 mb-1">
                <AnimatedCounter 
                  value={customer.totalPurchases || 0} 
                  prefix="₹"
                  decimals={0}
                />
              </p>
              <p className="text-sm text-slate-400">Total Purchases</p>
            </motion.div>

            {/* Outstanding Balance */}
            <motion.div
              className={`text-center px-6 py-4 rounded-xl bg-slate-800/50 border transition-colors group relative overflow-hidden ${
                calculatedOutstanding > 0 
                  ? 'border-amber-500/50 hover:border-amber-400' 
                  : 'border-slate-700/50 hover:border-emerald-500/50'
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${
                  calculatedOutstanding > 0 
                    ? 'from-amber-500/10' 
                    : 'from-emerald-500/10'
                } to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              <motion.div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
                  calculatedOutstanding > 0 
                    ? 'bg-amber-500/20' 
                    : 'bg-emerald-500/20'
                }`}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <Wallet className={`w-5 h-5 ${
                  calculatedOutstanding > 0 
                    ? 'text-amber-400' 
                    : 'text-emerald-400'
                }`} />
              </motion.div>
              <p className={`text-2xl font-bold mb-1 ${
                calculatedOutstanding > 0 
                  ? 'text-amber-400' 
                  : 'text-emerald-400'
              }`}>
                <AnimatedCounter 
                  value={calculatedOutstanding} 
                  prefix="₹"
                  decimals={0}
                />
              </p>
              <p className="text-sm text-slate-400">Outstanding</p>
            </motion.div>

            {/* Invoices Count */}
            <motion.div
              className="text-center px-6 py-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/50 transition-colors group relative overflow-hidden"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <motion.div
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 mb-2"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <FileText className="w-5 h-5 text-blue-400" />
              </motion.div>
              <p className="text-2xl font-bold text-blue-400 mb-1">
                <AnimatedCounter value={customer.invoiceCount || 0} />
              </p>
              <p className="text-sm text-slate-400">Invoices</p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Tabbed Content */}
      <motion.div variants={itemVariants} className="glass-card overflow-hidden">
        {/* Tab Header */}
        <div className="p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      activeTab === tab.id ? 'bg-blue-500/30' : 'bg-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {(calculatedOutstanding > 0 || unpaidInvoices.length > 0) && (
              <motion.button
                onClick={() => handleRecordPayment()}
                className="btn btn-secondary flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </motion.button>
            )}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to={`/invoices/create?customer=${customer._id}`}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Invoice
              </Link>
            </motion.div>
          </div>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
              <motion.div
                key="invoices"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {invoices.length === 0 ? (
                  <div className="text-center py-12">
                    <motion.div
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                    >
                      <FileText className="w-8 h-8 text-slate-400" />
                    </motion.div>
                    <motion.p
                      className="text-slate-400"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      No invoices yet for this customer
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Link
                        to={`/invoices/create?customer=${customer._id}`}
                        className="btn btn-primary mt-4 inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create First Invoice
                      </Link>
                    </motion.div>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <motion.tr
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <th>Invoice #</th>
                          <th>Date</th>
                          <th>Items</th>
                          <th>Amount</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th>Action</th>
                        </motion.tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice, index) => {
                          const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                          const paymentStatus = invoice.paymentStatus || 'Unpaid';
                          const PaymentIcon = paymentStatusConfig[paymentStatus]?.icon || AlertTriangle;
                          const remaining = (invoice.totals?.netTotal || 0) - (invoice.paidAmount || 0);
                          
                          return (
                            <motion.tr
                              key={invoice._id}
                              custom={index}
                              variants={tableRowVariants}
                              initial="hidden"
                              animate="visible"
                              whileHover={{ 
                                backgroundColor: 'rgba(51, 65, 85, 0.5)',
                                x: 4
                              }}
                              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            >
                              <td className="font-medium text-white">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-400" />
                                  {invoice.invoiceNumber}
                                </div>
                              </td>
                              <td className="text-slate-300">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-500" />
                                  {formatDate(invoice.invoiceDate)}
                                </div>
                              </td>
                              <td className="text-slate-300">
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-slate-500" />
                                  {invoice.items?.length || 0} items
                                </div>
                              </td>
                              <td className="text-emerald-400 font-medium">
                                {formatCurrency(invoice.totals?.netTotal)}
                              </td>
                              <td>
                                <div className="flex flex-col">
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${paymentStatusConfig[paymentStatus]?.class}`}>
                                    <PaymentIcon className="w-3 h-3" />
                                    {paymentStatus}
                                  </span>
                                  {paymentStatus === 'Partial' && (
                                    <span className="text-xs text-slate-500 mt-1">
                                      Due: {formatCurrency(remaining)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <motion.span
                                  className={`badge ${statusConfig[invoice.status]?.class || 'badge-info'} inline-flex items-center gap-1.5`}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <StatusIcon className="w-3 h-3" />
                                  {invoice.status}
                                </motion.span>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/invoices/${invoice._id}`}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors"
                                  >
                                    View
                                  </Link>
                                  {invoice.status !== 'Cancelled' && (paymentStatus === 'Unpaid' || paymentStatus === 'Partial') && (
                                    <button
                                      onClick={() => handleRecordPayment(invoice)}
                                      className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
                                    >
                                      Pay
                                    </button>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {payments.length === 0 ? (
                  <div className="text-center py-12">
                    <motion.div
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                    >
                      <CreditCard className="w-8 h-8 text-slate-400" />
                    </motion.div>
                    <motion.p
                      className="text-slate-400"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      No payments recorded yet
                    </motion.p>
                    {unpaidInvoices.length > 0 && (
                      <motion.button
                        onClick={() => handleRecordPayment()}
                        className="btn btn-primary mt-4 inline-flex items-center gap-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <CreditCard className="w-4 h-4" />
                        Record First Payment
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment, index) => (
                      <motion.div
                        key={payment._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                              <CreditCard className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {payment.invoiceSnapshot?.invoiceNumber || 'Invoice'}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-400">
                                  {payment.paymentMethod}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(payment.paymentDate)}
                                {payment.referenceNumber && (
                                  <>
                                    <span>•</span>
                                    <span>Ref: {payment.referenceNumber}</span>
                                  </>
                                )}
                              </div>
                              {payment.notes && (
                                <p className="text-xs text-slate-500 mt-1">{payment.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-emerald-400">
                              +{formatCurrency(payment.amount)}
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

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedInvoice(null);
        }}
        onSuccess={handlePaymentSuccess}
        customer={customer}
        invoices={unpaidInvoices}
        preSelectedInvoice={selectedInvoice}
      />
    </motion.div>
  );
}
