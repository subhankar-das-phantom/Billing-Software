import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CreditCard, 
  Calendar,
  FileText,
  Wallet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { recordPayment, PAYMENT_METHODS } from '../../services/creditService';
import { manualEntryService } from '../../services/manualEntryService';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
  invoices = [], // Unpaid/partial invoices for this customer
  manualEntries = [], // Unpaid opening balance entries
  preSelectedInvoice = null
}) {
  const [formData, setFormData] = useState({
    selectionId: '', // Can be invoiceId or entryId
    selectionType: 'invoice', // 'invoice' or 'entry'
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    referenceNumber: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Filter manual entries to only show unpaid opening balances
  const unpaidEntries = manualEntries.filter(entry => 
    entry.entryType === 'opening_balance' && 
    entry.paymentType === 'Credit' &&
    (entry.amount - (entry.paidAmount || 0)) > 0
  );

  // Derive selected item directly from selectionId to avoid state sync issues
  const selectedItem = useMemo(() => {
    if (!formData.selectionId) return null;
    if (formData.selectionType === 'invoice') {
      return invoices.find(inv => inv._id === formData.selectionId) || null;
    } else {
      return unpaidEntries.find(e => e._id === formData.selectionId) || null;
    }
  }, [formData.selectionId, formData.selectionType, invoices, unpaidEntries]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Check if preSelectedInvoice still exists in the current invoices list
      const validPreSelected = preSelectedInvoice 
        ? invoices.find(inv => inv._id === preSelectedInvoice._id)
        : null;
      
      setFormData({
        selectionId: validPreSelected?._id || '',
        selectionType: 'invoice',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        referenceNumber: '',
        notes: ''
      });
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSelectionChange = (value) => {
    if (value.startsWith('entry_')) {
      const entryId = value.replace('entry_', '');
      setFormData(prev => ({ ...prev, selectionId: entryId, selectionType: 'entry', amount: '' }));
    } else {
      setFormData(prev => ({ ...prev, selectionId: value, selectionType: 'invoice', amount: '' }));
    }
  };

  const getRemainingAmount = () => {
    if (!selectedItem) return 0;
    if (formData.selectionType === 'invoice') {
      return selectedItem.totals.netTotal - (selectedItem.paidAmount || 0);
    } else {
      return selectedItem.amount - (selectedItem.paidAmount || 0);
    }
  };

  const handlePayFull = () => {
    setFormData(prev => ({
      ...prev,
      amount: getRemainingAmount().toFixed(2)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.selectionId) {
      setError('Please select an invoice or opening balance');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    const remaining = getRemainingAmount();
    if (amount > remaining) {
      setError(`Amount cannot exceed remaining balance (${formatCurrency(remaining)})`);
      return;
    }

    setLoading(true);

    try {
      if (formData.selectionType === 'invoice') {
        // Pay against invoice
        await recordPayment({
          invoiceId: formData.selectionId,
          amount,
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          referenceNumber: formData.referenceNumber,
          notes: formData.notes
        });
      } else {
        // Pay against manual entry (opening balance)
        await manualEntryService.recordPaymentAgainstEntry(formData.selectionId, {
          amount,
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          referenceNumber: formData.referenceNumber,
          notes: formData.notes
        });
      }

      setSuccess(true);
      
      // Close modal first, then refresh data AFTER modal is closed
      setTimeout(() => {
        onClose();
        // Refresh data after modal is closed
        if (onSuccess) {
          onSuccess();
        }
      }, 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
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
            className="modal max-w-lg relative z-10 w-full"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Record Payment</h2>
                  {customer && (
                    <p className="text-sm text-slate-400">{customer.customerName}</p>
                  )}
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
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Recorded!</h3>
                  <p className="text-slate-400">
                    {formatCurrency(parseFloat(formData.amount))} received successfully
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

                  {/* Selection (Invoice or Opening Balance) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Select Invoice or Opening Balance
                    </label>
                    <div className="relative">
                      <select
                        value={formData.selectionType === 'entry' ? `entry_${formData.selectionId}` : formData.selectionId}
                        onChange={(e) => handleSelectionChange(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer hover:border-slate-500 transition-colors pr-10"
                        style={{ backgroundImage: 'none' }}
                        required
                      >
                        <option value="" className="bg-slate-800 text-slate-400">Choose...</option>
                        
                        {/* Invoices Section */}
                        {invoices.length > 0 && (
                          <optgroup label="📄 Invoices" className="bg-slate-800">
                            {invoices.map((inv) => {
                              const remaining = inv.totals.netTotal - (inv.paidAmount || 0);
                              return (
                                <option key={inv._id} value={inv._id} className="bg-slate-800 text-white py-2">
                                  {inv.invoiceNumber} - {formatDate(inv.invoiceDate)} - Due: {formatCurrency(remaining)}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        
                        {/* Opening Balances Section */}
                        {unpaidEntries.length > 0 && (
                          <optgroup label="📊 Opening Balances" className="bg-slate-800">
                            {unpaidEntries.map((entry) => {
                              const remaining = entry.amount - (entry.paidAmount || 0);
                              return (
                                <option key={entry._id} value={`entry_${entry._id}`} className="bg-slate-800 text-white py-2">
                                  Opening Balance - {formatDate(entry.entryDate)} - Due: {formatCurrency(remaining)}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Selected Item Info */}
                  {selectedItem && (
                    <motion.div
                      className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">
                            {formData.selectionType === 'invoice' ? 'Invoice Total:' : 'Opening Balance:'}
                          </span>
                          <span className="ml-2 text-white font-medium">
                            {formatCurrency(formData.selectionType === 'invoice' 
                              ? selectedItem.totals.netTotal 
                              : selectedItem.amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Already Paid:</span>
                          <span className="ml-2 text-emerald-400 font-medium">
                            {formatCurrency(selectedItem.paidAmount || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Due Amount:</span>
                          <span className="ml-2 text-amber-400 font-semibold">
                            {formatCurrency(getRemainingAmount())}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">After Payment:</span>
                          <span className={`ml-2 font-semibold ${
                            getRemainingAmount() - (parseFloat(formData.amount) || 0) <= 0 
                              ? 'text-emerald-400' 
                              : 'text-amber-400'
                          }`}>
                            {formatCurrency(Math.max(0, getRemainingAmount() - (parseFloat(formData.amount) || 0)))}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Wallet className="w-4 h-4 inline mr-2" />
                      Payment Amount
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={getRemainingAmount()}
                          value={formData.amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          required
                        />
                      </div>
                      {selectedItem && (
                        <motion.button
                          type="button"
                          onClick={handlePayFull}
                          className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Pay Full
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Payment Method and Date Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Wallet className="w-4 h-4 inline mr-2" />
                        Payment Method
                      </label>
                      <div className="relative">
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer hover:border-slate-500 transition-colors"
                          style={{ backgroundImage: 'none' }}
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method.value} value={method.value} className="bg-slate-800 text-white py-2">
                              {method.label}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Payment Date */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Payment Date
                      </label>
                      <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Reference Number */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Reference Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.referenceNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                      placeholder="Transaction ID, Cheque No., etc."
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.99 }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Recording Payment...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Record Payment
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
