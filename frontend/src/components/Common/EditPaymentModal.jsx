import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CreditCard, 
  Calendar,
  Wallet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit3
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { updatePayment, PAYMENT_METHODS } from '../../services/creditService';
import { updateManualEntry } from '../../services/manualEntryService';
import { formatCurrency } from '../../utils/formatters';

export default function EditPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  payment, // { _id, amount, date, method, reference, invoiceNumber, invoiceId, notes, invoiceTotal, invoicePaidAmount, isManual }
  creditNotes = []
}) {
  const isManual = payment?.isManual || false;
  const [formData, setFormData] = useState({
    amount: '',
    paymentDate: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Populate form when modal opens with payment data
  useEffect(() => {
    if (isOpen && payment) {
      setFormData({
        amount: payment.amount?.toString() || '',
        paymentDate: payment.date 
          ? new Date(payment.date).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0],
        paymentMethod: payment.method || 'Cash',
        referenceNumber: payment.reference || '',
        notes: payment.notes || ''
      });
      setError('');
      setSuccess(false);
    }
  }, [isOpen, payment]);

  // Max allowed = effectively remaining on invoice + this payment's current amount
  const getMaxAmount = () => {
    if (!payment || isManual) return Infinity;
    
    // Calculate credit note deduction for this specific invoice
    const cnDeduction = creditNotes.reduce((sum, cn) => {
      const invId = cn.invoiceId?._id?.toString() || cn.invoiceId?.toString();
      const targetId = payment.invoiceId?.toString();
      if (invId === targetId) {
        return sum + (cn.totals?.netTotal || 0);
      }
      return sum;
    }, 0);

    const remaining = (payment.invoiceTotal || 0) - (payment.invoicePaidAmount || 0);
    const effectiveRemaining = Math.max(0, remaining - cnDeduction);
    
    // The max they can set this payment to is what's currently effectively remaining 
    // PLUS the amount of this payment itself (since we are replacing it)
    return parseFloat((effectiveRemaining + (payment.amount || 0)).toFixed(2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    const maxAllowed = getMaxAmount();
    if (!isManual && parseFloat(amount.toFixed(2)) > maxAllowed) {
      setError(`Amount cannot exceed ₹${maxAllowed.toFixed(2)}`);
      return;
    }

    setLoading(true);

    try {
      if (isManual) {
        await updateManualEntry(payment._id, {
          amount,
          entryDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          referenceNumber: formData.referenceNumber,
          notes: formData.notes
        });
      } else {
        await updatePayment(payment._id, {
          amount,
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          referenceNumber: formData.referenceNumber,
          notes: formData.notes
        });
      }

      setSuccess(true);

      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update payment');
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
            className="bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl max-w-lg relative z-10 w-full flex flex-col max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Edit3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{isManual ? 'Edit Manual Entry' : 'Edit Payment'}</h2>
                  {payment && (
                    <p className="text-sm text-slate-400">{isManual ? payment.reference : payment.invoiceNumber}</p>
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
            <div className="flex flex-col flex-1 overflow-hidden">
              {success ? (
                <motion.div
                  className="text-center py-8 p-4 sm:p-6 overflow-y-auto"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-4">
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Updated!</h3>
                  <p className="text-slate-400">
                    {formatCurrency(parseFloat(formData.amount))} updated successfully
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden w-full">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 w-full">
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

                  {/* Current Info (invoice payments only) */}
                  {payment && !isManual && (
                    <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Invoice Total:</span>
                          <span className="ml-2 text-white font-medium">
                            {formatCurrency(payment.invoiceTotal || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Max Allowed:</span>
                          <span className="ml-2 text-amber-400 font-semibold">
                            {formatCurrency(getMaxAmount())}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Wallet className="w-4 h-4 inline mr-2" />
                      Payment Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={isManual ? undefined : getMaxAmount()}
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Method and Date Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <CreditCard className="w-4 h-4 inline mr-2" />
                        Payment Method
                      </label>
                      <div className="relative">
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer hover:border-slate-500 transition-colors"
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
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  </div>

                  {/* Submit Button Footer */}
                  <div className="p-4 sm:p-6 border-t border-slate-700/50 bg-slate-800/95 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] w-full sticky bottom-0 z-10">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      whileHover={{ scale: loading ? 1 : 1.01 }}
                      whileTap={{ scale: loading ? 1 : 0.99 }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Updating Payment...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Update Payment
                        </>
                      )}
                    </motion.button>
                  </div>
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
