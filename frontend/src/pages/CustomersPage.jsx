import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Users,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  ArrowRight,
  Loader2,
  User,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { customerService } from '../services/customerService';
import { formatCurrency, formatDate, formatPhone } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import Modal from '../components/Common/Modal';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import EnhancedButton from '../components/Common/EnhancedButton';
import { useToast } from '../context/ToastContext';
import { useMotionConfig } from '../hooks';

const initialCustomerState = {
  customerName: '',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  dlNo: '',
  customerCode: ''
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(initialCustomerState);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, customer: null });
  const { success, error } = useToast();
  
  // Adaptive motion configuration
  const motionConfig = useMotionConfig();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await customerService.getCustomers({ search });
      setCustomers(data.customers || []);
    } catch (err) {
      error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCustomers();
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData(initialCustomerState);
    setModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerName: customer.customerName || '',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      gstin: customer.gstin || '',
      dlNo: customer.dlNo || '',
      customerCode: customer.customerCode || ''
    });
    setModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.phone) {
      error('Please fill customer name and phone');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer._id, formData);
        success('Customer updated successfully');
      } else {
        await customerService.createCustomer(formData);
        success('Customer created successfully');
      }
      
      setModalOpen(false);
      loadCustomers();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await customerService.deleteCustomer(deleteDialog.customer._id);
      success('Customer deleted successfully');
      setDeleteDialog({ open: false, customer: null });
      loadCustomers();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: motionConfig.shouldStagger ? 0.08 : 0,
        delayChildren: motionConfig.isMobile ? 0 : 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: motionConfig.isMobile ? 15 : 30,
      scale: motionConfig.isMobile ? 1 : 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionConfig.isMobile 
        ? { type: 'tween', duration: 0.25, ease: 'easeOut' }
        : { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  const formItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: motionConfig.shouldStagger ? i * 0.05 : 0,
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    })
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-12"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 justify-between mb-2"
      >
        {/* Search Form */}
        <motion.form
          onSubmit={handleSearch}
          className="flex gap-2 flex-1 max-w-md relative"
          animate={searchFocused ? { scale: 1.02 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <motion.div className="relative flex-1">
            <motion.div
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              animate={searchFocused ? { x: 4, scale: 1.1 } : { x: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Search className="w-5 h-5 text-slate-400" />
            </motion.div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by name, phone, GSTIN..."
              className="input pl-10 w-full"
            />
            <AnimatePresence>
              {search && (
                <motion.button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
          
          <motion.button
            type="submit"
            className="btn btn-secondary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Search className="w-5 h-5" />
          </motion.button>
        </motion.form>

        {/* Add Customer Button */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <EnhancedButton
            onClick={openCreateModal}
            icon={Plus}
          >
            Add Customer
          </EnhancedButton>
        </motion.div>
      </motion.div>

      {/* Customers Grid */}
      <AnimatePresence mode="wait">
        {customers.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-12 text-center"
          >
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            >
              <Users className="w-10 h-10 text-slate-400" />
            </motion.div>
            <motion.p
              className="text-slate-400 mb-6 text-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              No customers found. Add your first customer!
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <EnhancedButton
                onClick={openCreateModal}
                icon={Plus}
              >
                Add Customer
              </EnhancedButton>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {customers.map((customer) => (
              <motion.div
                key={customer._id}
                variants={cardVariants}
                layout
                whileHover={motionConfig.shouldHover ? { y: -6 } : undefined}
                className="glass-card p-6 hover:border-blue-500/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Avatar */}
                    <motion.div
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center relative overflow-hidden shadow-lg shadow-emerald-500/30"
                      whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <span className="text-white font-bold text-lg relative z-10">
                        {customer.customerName?.charAt(0)}
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-teal-600 to-emerald-500"
                        initial={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <motion.h3
                        className="font-semibold text-white truncate"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        {customer.customerName}
                      </motion.h3>
                      <motion.p
                        className="text-sm text-slate-400 flex items-center gap-1"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 }}
                      >
                        <Phone className="w-3 h-3" />
                        {formatPhone(customer.phone)}
                      </motion.p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(customer);
                      }}
                      className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialog({ open: true, customer });
                      }}
                      className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.9 }}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-2 text-sm mb-4">
                  {customer.address && (
                    <motion.p
                      className="text-slate-400 line-clamp-2 flex items-start gap-2"
                      whileHover={{ x: 4 }}
                    >
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                      <span>{customer.address}</span>
                    </motion.p>
                  )}
                  {customer.gstin && (
                    <motion.p
                      className="text-slate-400 flex items-center gap-2"
                      whileHover={{ x: 4 }}
                    >
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-500">GST:</span>
                      <span>{customer.gstin}</span>
                    </motion.p>
                  )}
                  {customer.email && (
                    <motion.p
                      className="text-slate-400 flex items-center gap-2 truncate"
                      whileHover={{ x: 4 }}
                    >
                      <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </motion.p>
                  )}
                </div>

                {/* Stats Footer */}
                <motion.div
                  className="flex items-center justify-between pt-4 border-t border-slate-700"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="p-2 bg-emerald-500/20 rounded-lg"
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </motion.div>
                    <div>
                      <p className="text-xs text-slate-500">Total Purchases</p>
                      <p className="font-semibold text-emerald-400">
                        {formatCurrency(customer.totalPurchases)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">
                      {customer.invoiceCount || 0} Invoices
                    </p>
                    <motion.div whileHover={{ x: 4 }}>
                      <Link
                        to={`/customers/${customer._id}`}
                        className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Details
                        <motion.div
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </motion.div>
                      </Link>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            initial="hidden"
            animate="visible"
          >
            {/* Customer Name */}
            <motion.div
              className="md:col-span-2"
              custom={0}
              variants={formItemVariants}
            >
              <label className="label flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Customer Name *
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                className="input"
                placeholder="Enter customer name"
                required
              />
            </motion.div>

            {/* Phone */}
            <motion.div custom={1} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="input"
                placeholder="10-digit phone number"
                required
              />
            </motion.div>

            {/* Email */}
            <motion.div custom={2} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input"
                placeholder="email@example.com"
              />
            </motion.div>

            {/* Address */}
            <motion.div
              className="md:col-span-2"
              custom={3}
              variants={formItemVariants}
            >
              <label className="label flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="input"
                placeholder="Full address"
                rows={2}
              />
            </motion.div>

            {/* GSTIN */}
            <motion.div custom={4} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                GSTIN
              </label>
              <input
                type="text"
                name="gstin"
                value={formData.gstin}
                onChange={handleInputChange}
                className="input"
                placeholder="GST Number"
              />
            </motion.div>

            {/* DL Number */}
            <motion.div custom={5} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                DL Number
              </label>
              <input
                type="text"
                name="dlNo"
                value={formData.dlNo}
                onChange={handleInputChange}
                className="input"
                placeholder="Drug License Number"
              />
            </motion.div>

            {/* Customer Code */}
            <motion.div custom={6} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Customer Code
              </label>
              <input
                type="text"
                name="customerCode"
                value={formData.customerCode}
                onChange={handleInputChange}
                className="input"
                placeholder="Internal code (optional)"
              />
            </motion.div>
          </motion.div>

          {/* Form Actions */}
          <motion.div
            className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel
            </motion.button>
            <EnhancedButton
              type="submit"
              disabled={saving}
              icon={saving ? Loader2 : null}
            >
              {saving ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Add Customer')}
            </EnhancedButton>
          </motion.div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, customer: null })}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteDialog.customer?.customerName}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </motion.div>
  );
}
