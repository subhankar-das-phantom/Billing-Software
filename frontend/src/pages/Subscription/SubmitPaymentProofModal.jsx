import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Tag,
  ShieldCheck,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { subscriptionService } from '../../services/saas/subscriptionService';
import { useToast } from '../../contexts/ToastContext';

const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI / QR', icon: QrCode },
  { id: 'NEFT', label: 'NEFT', icon: Building2 },
  { id: 'RTGS', label: 'RTGS', icon: Building2 },
  { id: 'IMPS', label: 'IMPS', icon: Building2 },
  { id: 'CHEQUE', label: 'Cheque', icon: CreditCard },
];

export default function SubmitPaymentProofModal({
  isOpen,
  onClose,
  initialPlan,
  initialDuration = 1,
  initialAmount = 0,
  appliedPromo = null,
  onSuccess,
}) {
  const toast = useToast();
  const submittingRef = useRef(false);

  // Form State
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amountPaid, setAmountPaid] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');

  // UI / Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState(null);

  // Reset or initialize when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setPaymentMode('UPI');
      setUtrNumber('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setAmountPaid(initialAmount ? String(initialAmount) : '');
      setBankName('');
      setNotes('');
      setErrorMessage('');
      setSubmittedSuccess(false);
      setSubmittedPayment(null);
      submittingRef.current = false;
    }
  }, [isOpen, initialAmount]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Indian standard currency formatting preserving exact paise
  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    const cleanUtr = utrNumber.trim().toUpperCase();
    if (!cleanUtr) {
      setErrorMessage('Please enter the UTR or Transaction Reference number.');
      return;
    }

    const cleanAmount = Number(amountPaid);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMessage('Please enter a valid amount transferred in rupees.');
      return;
    }

    if (!initialPlan?._id) {
      setErrorMessage('Please select a valid subscription plan before submitting proof.');
      return;
    }

    setIsSubmitting(true);
    submittingRef.current = true;
    setErrorMessage('');

    try {
      const payload = {
        planId: initialPlan._id,
        durationMonths: Number(initialDuration) || 1,
        paymentMode,
        utrNumber: cleanUtr,
        paymentDate,
        amountPaid: cleanAmount,
        bankName: bankName.trim(),
        notes: notes.trim(),
        promoCode: appliedPromo?.promoCode || '',
      };

      const res = await subscriptionService.submitManualPaymentRequest(payload);
      if (res?.success) {
        setSubmittedSuccess(true);
        setSubmittedPayment(res.payment || payload);
        toast.success('Payment proof submitted successfully!');
        if (onSuccess) {
          onSuccess(res.payment || payload);
        }
      } else {
        const msg = res?.message || 'Failed to submit payment proof. Please try again.';
        setErrorMessage(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to submit payment proof. Please check your details.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop Tap Dismissal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => {
            if (!isSubmitting) onClose();
          }}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs will-change-[opacity]"
        />

        {/* Modal Dialog Card */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-payment-title"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden z-10 my-6 flex flex-col max-h-[92vh] will-change-[transform,opacity]"
        >
          {/* Sticky Mobile/Desktop Header */}
          <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer sm:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 id="submit-payment-title" className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Submit Payment Proof
                </h3>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Bank Transfer (NEFT/RTGS/IMPS) or Instant UPI UTR
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
            {submittedSuccess ? (
              /* Success View */
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <Check className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base sm:text-lg font-bold text-slate-100">
                    Payment Request Submitted Successfully!
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Your offline payment proof has been recorded. Our accounts verification team will verify the bank UTR within 15–30 minutes during business hours.
                  </p>
                </div>

                {/* Submitted Summary Card */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-left text-xs space-y-2 max-w-md mx-auto">
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Plan Tier:</span>
                    <span className="text-slate-200 font-semibold">{initialPlan?.name || 'Selected Tier'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Duration:</span>
                    <span className="text-slate-200 font-semibold">{initialDuration} Month{initialDuration > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">UTR / Reference:</span>
                    <span className="text-emerald-400 font-mono font-bold tracking-wider">
                      {submittedPayment?.metadata?.utrNumber || utrNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Amount Declared:</span>
                    <span className="text-slate-100 font-mono font-bold">
                      ₹{formatCurrency(submittedPayment?.finalAmount || amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">Status:</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      VERIFICATION IN PROGRESS
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md min-h-[44px] cursor-pointer"
                  >
                    Done & View Status
                  </button>
                </div>
              </div>
            ) : (
              /* Form View */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Plan Summary Header */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-950/80 border border-blue-500/30 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-blue-400 uppercase font-semibold tracking-wider block">
                      Target Upgrade Tier
                    </span>
                    <p className="text-sm font-bold text-slate-100">
                      {initialPlan?.name || 'Professional'} Plan
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Duration: <span className="text-slate-300 font-medium">{initialDuration} Month{initialDuration > 1 ? 's' : ''}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Net Payable
                    </span>
                    <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                      ₹{formatCurrency(initialAmount)}
                    </span>
                    {appliedPromo && (
                      <span className="text-[10px] text-cyan-300 flex items-center justify-end gap-1 font-mono">
                        <Tag className="w-2.5 h-2.5" />
                        {appliedPromo.promoCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Payment Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Payment Mode <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {PAYMENT_MODES.map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = paymentMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setPaymentMode(mode.id)}
                          className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. UTR / Transaction Reference Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>
                      UTR / Transaction Reference Number <span className="text-rose-400">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400">12-Digit Reference / Ref ID</span>
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC00019284 or UPI/261110088921"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs font-mono uppercase tracking-wider text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 min-h-[44px]"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Find the 12-digit UTR on your Google Pay, PhonePe, Paytm, or Net Banking debit confirmation screen.
                  </p>
                </div>

                {/* 4. Amount Paid & Payment Date (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Amount Transferred (₹) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Payment Date <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500 min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Bank Name (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Remitting Bank Name</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, State Bank of India, ICICI Bank"
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
                  />
                </div>

                {/* 6. Notes / Remarks (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Notes / Remarks</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Transferred from Rahul Sharma Current Account"
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="w-full sm:w-1/3 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all min-h-[44px] cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying & Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Submit Proof for Verification</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
