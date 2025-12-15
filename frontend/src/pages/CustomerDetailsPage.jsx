import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, animate } from 'framer-motion';
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
  User
} from 'lucide-react';
import { customerService } from '../services/customerService';
import { formatCurrency, formatDate, formatPhone } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';

// Animated counter component
const AnimatedCounter = ({ value, prefix = '', suffix = '', decimals = 0 }) => {
  const ref = useRef(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 2000 });
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      animate(motionValue, value, {
        duration: 2,
        ease: 'easeOut'
      });
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

export default function CustomerDetailsPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    try {
      const data = await customerService.getCustomer(id);
      setCustomer(data.customer);
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="flex flex-col md:flex-row md:items-center gap-6">
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
          <div className="flex gap-4">
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
              <p className="text-3xl font-bold text-emerald-400 mb-1">
                <AnimatedCounter 
                  value={customer.totalPurchases || 0} 
                  prefix="₹"
                  decimals={0}
                />
              </p>
              <p className="text-sm text-slate-400">Total Purchases</p>
            </motion.div>

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
              <p className="text-3xl font-bold text-blue-400 mb-1">
                <AnimatedCounter value={customer.invoiceCount || 0} />
              </p>
              <p className="text-sm text-slate-400">Invoices</p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Invoice History */}
      <motion.div variants={itemVariants} className="glass-card overflow-hidden">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-blue-500/20 rounded-lg"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </motion.div>
            <h2 className="font-semibold text-white">Invoice History</h2>
          </div>

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

        <div className="p-5">
          <AnimatePresence mode="wait">
            {invoices.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-12"
              >
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
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="table-container"
              >
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
                      <th>Status</th>
                      <th>Action</th>
                    </motion.tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice, index) => {
                      const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                      
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
                            <motion.div whileHover={{ x: 4 }}>
                              <Link
                                to={`/invoices/${invoice._id}`}
                                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium group"
                              >
                                View
                                <motion.span
                                  className="inline-block"
                                  animate={{ x: [0, 4, 0] }}
                                  transition={{ 
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: 'easeInOut'
                                  }}
                                >
                                  →
                                </motion.span>
                              </Link>
                            </motion.div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
