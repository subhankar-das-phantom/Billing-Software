import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Shield, 
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { manualEntryService, calculateImpact } from '../../services/manualEntryService';
import { customerService } from '../../services/customerService';
import { clearCache } from '../../services/api';

export default function ManualEntryModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedCustomer = null
}) {
  const [formData, setFormData] = useState({
    customerId: '',
    entryType: 'opening_balance',
    paymentType: 'Credit',
    amount: '',
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    notes: ''
  });
  
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preSelectedCustomer) {
        setSelectedCustomer(preSelectedCustomer);
        setFormData(prev => ({ ...prev, customerId: preSelectedCustomer._id }));
        setCustomerSearch(preSelectedCustomer.customerName);
      } else {
        setSelectedCustomer(null);
        setFormData({
          customerId: '',
          entryType: 'opening_balance',
          paymentType: 'Credit',
          amount: '',
          entryDate: new Date().toISOString().split('T')[0],
          description: '',
          notes: ''
        });
        setCustomerSearch('');
      }
      setError('');
      setSuccess(false);
    }
  }, [isOpen, preSelectedCustomer]);

  // Search customers
  useEffect(() => {
    const searchCustomers = async () => {
      if (customerSearch.length < 2) {
        setCustomers([]);
        return;
      }
      
      setSearchLoading(true);
      try {
        const data = await customerService.searchCustomers(customerSearch);
        setCustomers(data.customers || []);
      } catch (err) {
        console.error('Failed to search customers:', err);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch]);



  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customerId: customer._id }));
    setCustomerSearch(customer.customerName);
    setShowCustomerDropdown(false);
  };

  const impact = calculateImpact(formData.entryType, formData.paymentType, formData.amount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.customerId) {
      setError('Please select a customer');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!formData.description.trim()) {
      setError('Please enter a description');
      return;
    }

    setLoading(true);

    try {
      await manualEntryService.createManualEntry({
        customerId: formData.customerId,
        entryType: 'opening_balance',
        paymentType: 'Credit',
        amount,
        entryDate: formData.entryDate,
        description: formData.description.trim(),
        notes: formData.notes.trim(),
        affectInventory: false,
        excludeFromAnalytics: true
      });

      // Clear API cache to ensure fresh data is fetched
      clearCache();
      
      setSuccess(true);
      
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create manual entry');
    } finally {
      setLoading(false);
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="modal max-w-xl relative z-10 w-full max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Create Manual Entry</h2>
                  <p className="text-sm text-slate-400">Record financial adjustments</p>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {success ? (
                <motion.div
                  className="text-center py-8"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-4">
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Entry Created!</h3>
                  <p className="text-slate-400">
                    Manual entry recorded successfully
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Error Message */}
                  {error && (
                    <motion.div
                      className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{error}</span>
                    </motion.div>
                  )}

                  {/* Customer Selection */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Customer *
                    </label>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                        if (!e.target.value) {
                          setSelectedCustomer(null);
                          setFormData(prev => ({ ...prev, customerId: '' }));
                        }
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Search customer by name or phone..."
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={!!preSelectedCustomer}
                    />
                    
                    {/* Customer dropdown */}
                    {showCustomerDropdown && customers.length > 0 && !preSelectedCustomer && (
                      <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {customers.map((customer) => (
                          <button
                            key={customer._id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer)}
                            className="w-full px-4 py-2 text-left hover:bg-slate-700 flex justify-between items-center"
                          >
                            <span className="text-white">{customer.customerName}</span>
                            <span className="text-slate-400 text-sm">{customer.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Amount and Date Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Amount *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Date
                      </label>
                      <input
                        type="date"
                        value={formData.entryDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, entryDate: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>


                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="e.g., Pre-digital balance from ledger"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional notes..."
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Impact Preview */}
                  {formData.amount && (
                    <motion.div
                      className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <div className="flex items-start gap-2">
                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-400 mb-1">Financial Impact</p>
                          <p className="text-sm text-slate-300">{impact.message}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.99 }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Entry...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Create Entry
                      </>
                    )}
                  </motion.button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
