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
  Shield,
  ListOrdered,
  AlertTriangle,
  Search,
  User
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { recordPayment, PAYMENT_METHODS } from '../../../services/credits/creditService';
import { invoiceService } from '../../../services/invoices/invoiceService';
import { manualEntryService } from '../../../services/entries/manualEntryService';
import { customerService } from '../../../services/customers/customerService';
import { creditNoteService } from '../../../services/credits/creditNoteService';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { invalidateCachePattern } from '../../../hooks';
import CustomDropdown from '../Dropdowns/CustomDropdown';

const roundCurrency = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;

const getInvoiceId = (invoice) => invoice?._id?.toString();
const isPayablePaymentStatus = (status) => !status || ['Unpaid', 'Partial'].includes(status);

/**
 * Pure utility: Build FIFO allocations from a sorted queue and a payment amount.
 * Reusable for bulk payment imports, bank reconciliation, automatic matching, etc.
 *
 * @param {Array} queue - Sorted array of { type, id, label, effectiveDate, due }
 *   `due` = current payable amount after deducting previous payments, credit notes,
 *           and any existing adjustments. Items with due <= 0 are skipped.
 * @param {number} amount - Total payment amount to allocate (must be > 0).
 * @returns {Array} Allocations: [{ ...item, allocated, remainingAfterAllocation }]
 */
export const buildFifoAllocations = (queue, amount) => {
  let remaining = roundCurrency(amount);
  const allocations = [];

  for (const item of queue) {
    if (remaining <= 0) break;
    const due = roundCurrency(item.due);
    if (due <= 0) continue;
    const allocated = roundCurrency(Math.min(remaining, due));
    remaining = roundCurrency(remaining - allocated);
    allocations.push({
      ...item,
      allocated,
      remainingAfterAllocation: roundCurrency(due - allocated)
    });
  }

  return allocations;
};

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  customer: initialCustomer = null,
  invoices: initialInvoices = [], // Unpaid/partial invoices for this customer
  manualEntries: initialManualEntries = [], // Unpaid opening balance entries
  preSelectedInvoice = null,
  creditNotes: initialCreditNotes = [] // Credit notes for this customer
}) {
  // Standalone Customer State (when customer prop is not supplied)
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);

  // Standalone Dues State
  const [standaloneInvoices, setStandaloneInvoices] = useState([]);
  const [standaloneManualEntries, setStandaloneManualEntries] = useState([]);
  const [standaloneCreditNotes, setStandaloneCreditNotes] = useState([]);

  // Active sources: use prop if provided, else use standalone state
  const activeCustomer = initialCustomer || selectedCustomer;
  const invoices = initialCustomer ? initialInvoices : standaloneInvoices;
  const manualEntries = initialCustomer ? initialManualEntries : standaloneManualEntries;
  const creditNotes = initialCustomer ? initialCreditNotes : standaloneCreditNotes;

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

  // ──── FIFO State ────
  const [fifoMode, setFifoMode] = useState(false);
  const [fifoProgress, setFifoProgress] = useState(null);
  // { current: number, total: number, label: string }
  const [fifoConfirm, setFifoConfirm] = useState(false);
  const [fifoResult, setFifoResult] = useState(null);
  // { successCount, totalCount, failedLabel?, failedError?, totalAmount? }

  const preSelectedInvoiceId = getInvoiceId(preSelectedInvoice);

  // Filter manual entries to only show unpaid opening balances
  const unpaidEntries = manualEntries.filter(entry => 
    entry.entryType === 'opening_balance' && 
    entry.paymentType === 'Credit' &&
    roundCurrency(entry.amount - (entry.paidAmount || 0)) > 0
  );

  // Build per-invoice credit note totals map
  const cnByInvoiceMap = useMemo(() => {
    const map = new Map();
    creditNotes.forEach(cn => {
      const invId = cn.invoiceId?._id || cn.invoiceId;
      if (invId) {
        const key = invId.toString();
        map.set(key, roundCurrency((map.get(key) || 0) + (cn.totals?.netTotal || 0)));
      }
    });
    return map;
  }, [creditNotes]);

  const payableInvoices = useMemo(() => {
    const invoiceMap = new Map();

    const addInvoice = (inv, { requirePayableStatus = true, requirePositiveDue = true } = {}) => {
      const invoiceId = getInvoiceId(inv);
      if (!invoiceId || invoiceMap.has(invoiceId)) return;
      if (inv.status === 'Cancelled') return;
      if (requirePayableStatus && !isPayablePaymentStatus(inv.paymentStatus)) return;

      const remaining = roundCurrency((inv.totals?.netTotal || 0) - (inv.paidAmount || 0));
      const cnDeduction = roundCurrency(inv.creditNoteTotal ?? cnByInvoiceMap.get(invoiceId) ?? 0);
      const effectiveDue = roundCurrency(remaining - cnDeduction);
      if (!requirePositiveDue || effectiveDue > 0) {
        invoiceMap.set(invoiceId, inv);
      }
    };

    invoices.forEach(inv => addInvoice(inv));
    addInvoice(preSelectedInvoice, {
      requirePayableStatus: false,
      requirePositiveDue: false
    });

    return Array.from(invoiceMap.values());
  }, [invoices, preSelectedInvoice, cnByInvoiceMap]);

  // ──── FIFO: Unified chronological queue ────
  const fifoQueue = useMemo(() => {
    const queue = [];

    // Add opening balance entries
    unpaidEntries.forEach(entry => {
      const due = roundCurrency(entry.amount - (entry.paidAmount || 0));
      if (due > 0) {
        queue.push({
          type: 'entry',
          id: entry._id,
          label: 'Opening Balance',
          effectiveDate: new Date(entry.entryDate),
          due
        });
      }
    });

    // Add invoices with effective due > 0
    payableInvoices.forEach(inv => {
      const invoiceId = getInvoiceId(inv);
      const remaining = roundCurrency((inv.totals?.netTotal || 0) - (inv.paidAmount || 0));
      const cnDeduction = roundCurrency(inv.creditNoteTotal ?? cnByInvoiceMap.get(invoiceId) ?? 0);
      const due = roundCurrency(remaining - cnDeduction);
      if (due > 0) {
        queue.push({
          type: 'invoice',
          id: invoiceId,
          label: inv.invoiceNumber,
          effectiveDate: new Date(inv.invoiceDate),
          due
        });
      }
    });

    // Sort: effectiveDate ASC; same date → entry before invoice
    queue.sort((a, b) => {
      const dateDiff = a.effectiveDate.getTime() - b.effectiveDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      if (a.type === 'entry' && b.type === 'invoice') return -1;
      if (a.type === 'invoice' && b.type === 'entry') return 1;
      return 0;
    });

    return queue;
  }, [unpaidEntries, payableInvoices, cnByInvoiceMap]);

  const totalOutstanding = useMemo(
    () => roundCurrency(fifoQueue.reduce((sum, item) => sum + item.due, 0)),
    [fifoQueue]
  );

  const fifoAllocations = useMemo(() => {
    const amount = parseFloat(formData.amount) || 0;
    if (roundCurrency(amount) <= 0 || fifoQueue.length === 0) return [];
    return buildFifoAllocations(fifoQueue, amount);
  }, [fifoQueue, formData.amount]);

  const totalAllocated = useMemo(
    () => roundCurrency(fifoAllocations.reduce((sum, a) => sum + a.allocated, 0)),
    [fifoAllocations]
  );

  // ──── END FIFO hooks ────

  const selectionGroups = useMemo(() => {
    const invoiceOptions = payableInvoices.map(inv => {
      const invoiceId = getInvoiceId(inv);
      const remaining = (inv.totals?.netTotal || 0) - (inv.paidAmount || 0);
      const cnDeduction = inv.creditNoteTotal ?? cnByInvoiceMap.get(invoiceId) ?? 0;
      const effectiveDue = Math.max(0, roundCurrency(remaining - cnDeduction));

      return {
        value: invoiceId,
        label: `${inv.invoiceNumber} - ${formatDate(inv.invoiceDate)} - Due: ${formatCurrency(effectiveDue)}`,
        invoiceNumber: inv.invoiceNumber,
        date: formatDate(inv.invoiceDate),
        due: effectiveDue,
        type: 'invoice'
      };
    });

    const entryOptions = unpaidEntries.map(entry => {
      const remaining = roundCurrency(entry.amount - (entry.paidAmount || 0));

      return {
        value: `entry_${entry._id}`,
        label: `Opening Balance - ${formatDate(entry.entryDate)} - Due: ${formatCurrency(remaining)}`,
        invoiceNumber: 'Opening Balance',
        date: formatDate(entry.entryDate),
        due: remaining,
        type: 'entry'
      };
    });

    return [
      ...(invoiceOptions.length > 0 ? [{ label: 'Invoices', options: invoiceOptions }] : []),
      ...(entryOptions.length > 0 ? [{ label: 'Opening Balances', options: entryOptions }] : [])
    ];
  }, [payableInvoices, unpaidEntries, cnByInvoiceMap]);

  const paymentMethodOptions = useMemo(
    () => PAYMENT_METHODS.map(method => ({ value: method.value, label: method.label })),
    []
  );

  // Derive selected item directly from selectionId to avoid state sync issues
  const selectedItem = useMemo(() => {
    if (!formData.selectionId) return null;
    if (formData.selectionType === 'invoice') {
      return payableInvoices.find(inv => getInvoiceId(inv) === formData.selectionId) || null;
    } else {
      return unpaidEntries.find(e => e._id === formData.selectionId) || null;
    }
  }, [formData.selectionId, formData.selectionType, payableInvoices, unpaidEntries]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        selectionId: preSelectedInvoiceId || '',
        selectionType: 'invoice',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        referenceNumber: '',
        notes: ''
      });
      setError('');
      setSuccess(false);
      setFifoMode(false);
      setFifoProgress(null);
      setFifoConfirm(false);
      setFifoResult(null);

      // Reset standalone selection when opened without pre-selected customer
      if (!initialCustomer) {
        setSelectedCustomer(null);
        setCustomerSearch('');
        setCustomerResults([]);
        setStandaloneInvoices([]);
        setStandaloneManualEntries([]);
        setStandaloneCreditNotes([]);
        setLoadingCustomerData(false);
      }
    }
  }, [isOpen, preSelectedInvoiceId, initialCustomer]);

  // Debounced Customer Search for Standalone Mode
  useEffect(() => {
    if (!isOpen || initialCustomer || selectedCustomer) return;

    if (!customerSearch || customerSearch.trim().length < 2) {
      setCustomerResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await customerService.searchCustomers(customerSearch.trim());
        setCustomerResults(res.customers || []);
      } catch (err) {
        console.error('Failed to search customers:', err);
        setCustomerResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch, isOpen, initialCustomer, selectedCustomer]);

  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setCustomerSearch('');
    setCustomerResults([]);
    setLoadingCustomerData(true);
    setError('');
    setFormData(prev => ({
      ...prev,
      selectionId: '',
      selectionType: 'invoice',
      amount: ''
    }));

    try {
      const [invData, entryData, cnData] = await Promise.all([
        customerService.getCustomerInvoices(cust._id, {
          limit: 200,
          paymentStatus: ['Unpaid', 'Partial'],
          payableOnly: true
        }).catch(() => ({ items: [] })),
        manualEntryService.getUnpaidOpeningBalances(cust._id).catch(() => ({ manualEntries: [] })),
        creditNoteService.getCreditNotesByCustomer(cust._id, { limit: 200 }).catch(() => ({ items: [] }))
      ]);

      setStandaloneInvoices(invData.items || invData.invoices || []);
      setStandaloneManualEntries(entryData.manualEntries || []);
      setStandaloneCreditNotes(cnData.items || cnData.creditNotes || []);
    } catch (err) {
      console.error('Failed to load customer payment records:', err);
      setError('Failed to load customer dues and invoices');
    } finally {
      setLoadingCustomerData(false);
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setStandaloneInvoices([]);
    setStandaloneManualEntries([]);
    setStandaloneCreditNotes([]);
    setLoadingCustomerData(false);
    setError('');
    setFormData(prev => ({
      ...prev,
      selectionId: '',
      selectionType: 'invoice',
      amount: ''
    }));
  };

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
      return roundCurrency((selectedItem.totals?.netTotal || 0) - (selectedItem.paidAmount || 0));
    } else {
      return roundCurrency(selectedItem.amount - (selectedItem.paidAmount || 0));
    }
  };

  // Effective due = remaining - credit notes (display only)
  const getEffectiveDue = () => {
    if (!selectedItem) return 0;
    const remaining = getRemainingAmount();
    if (formData.selectionType === 'invoice') {
      const cnDeduction = selectedItem.creditNoteTotal ?? cnByInvoiceMap.get(getInvoiceId(selectedItem)) ?? 0;
      return Math.max(0, roundCurrency(remaining - cnDeduction));
    }
    return remaining;
  };

  const handlePayFull = () => {
    if (fifoMode) {
      setFormData(prev => ({
        ...prev,
        amount: totalOutstanding.toFixed(2)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        amount: getEffectiveDue().toFixed(2)
      }));
    }
  };

  // ──── FIFO Close Handler (partial failure) ────
  const handleFifoResultClose = () => {
    onClose();
    // Always refresh since some payments may have been recorded
    if (fifoResult?.successCount > 0 && onSuccess) {
      onSuccess();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (fifoMode) {
      // ──── FIFO SUBMISSION ────
      const amount = parseFloat(formData.amount);
      if (!amount || roundCurrency(amount) <= 0) {
        setError('Please enter a valid payment amount');
        return;
      }
      if (roundCurrency(amount) > roundCurrency(totalOutstanding)) {
        setError(`Amount cannot exceed total outstanding (${formatCurrency(totalOutstanding)})`);
        return;
      }
      if (fifoAllocations.length === 0) {
        setError('No items to allocate payment to');
        return;
      }

      // Confirmation step: first click shows confirm, second click processes
      if (!fifoConfirm) {
        setFifoConfirm(true);
        return;
      }

      setLoading(true);
      setFifoConfirm(false);
      let successCount = 0;

      try {
        for (let i = 0; i < fifoAllocations.length; i++) {
          const allocation = fifoAllocations[i];
          setFifoProgress({
            current: i + 1,
            total: fifoAllocations.length,
            label: allocation.label
          });

          try {
            if (allocation.type === 'entry') {
              await manualEntryService.recordPaymentAgainstEntry(allocation.id, {
                amount: roundCurrency(allocation.allocated),
                paymentDate: formData.paymentDate,
                paymentMethod: formData.paymentMethod,
                referenceNumber: formData.referenceNumber,
                notes: formData.notes
              });
            } else {
              await recordPayment({
                invoiceId: allocation.id,
                amount: roundCurrency(allocation.allocated),
                paymentDate: formData.paymentDate,
                paymentMethod: formData.paymentMethod,
                referenceNumber: formData.referenceNumber,
                notes: formData.notes
              });
            }
            successCount++;
          } catch (err) {
            // Stop on first failure — do not continue
            setFifoResult({
              successCount,
              totalCount: fifoAllocations.length,
              failedLabel: allocation.label,
              failedError: err.message || err.message || 'Payment failed',
              totalAmount: roundCurrency(amount)
            });
            setFifoProgress(null);
            setLoading(false);
            return;
          }
        }

        // All succeeded
        setFifoProgress(null);
        setFifoResult({
          successCount,
          totalCount: fifoAllocations.length,
          failedLabel: null,
          failedError: null,
          totalAmount: roundCurrency(amount)
        });
        setSuccess(true);

        // Invalidate caches across the app so Dashboard, Collections, Invoices, and Ledgers immediately refresh
        invalidateCachePattern('dashboard');
        invalidateCachePattern('collections');
        invalidateCachePattern('invoices');
        invalidateCachePattern('customer');
        invalidateCachePattern('credit');

        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1500);
      } catch (err) {
        setError(err.message || 'FIFO allocation failed');
      } finally {
        setLoading(false);
      }
    } else {
      // ──── EXISTING SINGLE-PAYMENT SUBMISSION (unchanged) ────

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

      const effectiveDue = parseFloat(getEffectiveDue().toFixed(2));
      if (parseFloat(amount.toFixed(2)) > effectiveDue) {
        setError(`Amount cannot exceed effectively due balance (${formatCurrency(effectiveDue)})`);
        return;
      }

      setLoading(true);

      try {
        if (formData.selectionType === 'invoice') {
          // Revalidate against latest server invoice state to avoid stale UI due mismatches.
          const latestInvoiceRes = await invoiceService.getInvoice(formData.selectionId, false);
          const latestInvoice = latestInvoiceRes?.invoice;
          if (!latestInvoice) {
            setError('Selected invoice not found. Please refresh and try again.');
            return;
          }

          const latestCreditNoteDeduction = selectedItem?.creditNoteTotal ?? cnByInvoiceMap.get(latestInvoice._id?.toString()) ?? 0;
          const latestRemaining = Math.max(
            0,
            roundCurrency(
              (latestInvoice?.totals?.netTotal || 0)
              - (latestInvoice?.paidAmount || 0)
              - latestCreditNoteDeduction
            )
          );
          const roundedLatestRemaining = parseFloat(latestRemaining.toFixed(2));
          const roundedAmount = parseFloat(amount.toFixed(2));

          if (roundedAmount > roundedLatestRemaining) {
            if (roundedLatestRemaining <= 0) {
              setError('This invoice is already fully paid. Please refresh customer data.');
            } else {
              setError(`Amount exceeds latest due balance (${formatCurrency(roundedLatestRemaining)}). Please review and retry.`);
            }
            if (onSuccess) {
              await onSuccess();
            }
            return;
          }

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
        
        // Invalidate caches across the app so Dashboard, Collections, Invoices, and Ledgers immediately refresh
        invalidateCachePattern('dashboard');
        invalidateCachePattern('collections');
        invalidateCachePattern('invoices');
        invalidateCachePattern('customer');
        invalidateCachePattern('credit');

        // Close modal first, then refresh data AFTER modal is closed
        setTimeout(() => {
          onClose();
          // Refresh data after modal is closed
          if (onSuccess) {
            onSuccess();
          }
        }, 800);
      } catch (err) {
        setError(err.message || 'Failed to record payment');
      } finally {
        setLoading(false);
      }
    }
  };

  // Can the modal be closed right now?
  const isProcessing = loading && fifoProgress !== null;

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

  // Block Escape key during FIFO processing
  useEffect(() => {
    if (!isProcessing) return;
    const handler = (e) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isProcessing]);

  const handleModalClose = () => {
    if (isProcessing) return; // Prevent close during FIFO processing
    onClose();
  };

  // Whether FIFO toggle can be activated
  const canUseFifo = !preSelectedInvoiceId && fifoQueue.length > 0;

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
            onClick={handleModalClose}
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
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Record Payment</h2>
                  {activeCustomer && (
                    <p className="text-sm text-slate-400">
                      {activeCustomer.customerName || activeCustomer.name}
                    </p>
                  )}
                </div>
              </div>
              <motion.button
                onClick={handleModalClose}
                className={`p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ${isProcessing ? 'opacity-30 cursor-not-allowed' : ''}`}
                whileHover={isProcessing ? {} : { scale: 1.1 }}
                whileTap={isProcessing ? {} : { scale: 0.95 }}
                disabled={isProcessing}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* ──── Success View ──── */}
              {success ? (
                <motion.div
                  className="text-center py-8 p-4 sm:p-6 overflow-y-auto"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-4">
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                  </div>
                  {fifoResult && !fifoResult.failedLabel ? (
                    <>
                      <h3 className="text-xl font-semibold text-white mb-2">FIFO Payment Recorded</h3>
                      <p className="text-slate-400">
                        {formatCurrency(fifoResult.totalAmount)} allocated successfully.
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {fifoResult.successCount} {fifoResult.successCount === 1 ? 'payment was' : 'payments were'} created.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Customer outstanding updated.</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-semibold text-white mb-2">Payment Recorded!</h3>
                      <p className="text-slate-400">
                        {formatCurrency(parseFloat(formData.amount))} received successfully
                      </p>
                    </>
                  )}
                </motion.div>

              /* ──── FIFO Progress View ──── */
              ) : fifoProgress ? (
                <motion.div
                  className="p-6 sm:p-8 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="inline-flex p-3 bg-blue-500/20 rounded-full mb-4">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">Processing FIFO Allocation...</h3>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-slate-700 rounded-full h-2.5 mb-3">
                    <motion.div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2.5 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(fifoProgress.current / fifoProgress.total) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  
                  <p className="text-sm text-slate-400 mb-1">
                    Payment {fifoProgress.current} of {fifoProgress.total}
                  </p>
                  <p className="text-sm text-slate-300 font-medium">
                    Currently Applying: <span className="text-blue-400">{fifoProgress.label}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-4">
                    Do not close this window
                  </p>
                </motion.div>

              /* ──── FIFO Partial Failure View ──── */
              ) : fifoResult && fifoResult.failedLabel ? (
                <motion.div
                  className="p-4 sm:p-6 overflow-y-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="text-center mb-4">
                    <div className="inline-flex p-3 bg-amber-500/20 rounded-full mb-3">
                      <AlertTriangle className="w-8 h-8 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">FIFO Allocation Stopped</h3>
                  </div>

                  <div className="space-y-3">
                    {fifoResult.successCount > 0 && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                        <p className="text-sm text-emerald-400 font-medium">
                          ✓ {fifoResult.successCount} {fifoResult.successCount === 1 ? 'payment was' : 'payments were'} successfully recorded.
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-400 font-medium mb-1">
                        ✗ Failed on: {fifoResult.failedLabel}
                      </p>
                      <p className="text-xs text-red-400/80">
                        {fifoResult.failedError}
                      </p>
                    </div>

                    {fifoResult.successCount < fifoResult.totalCount - 1 && (
                      <div className="p-3 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                        <p className="text-sm text-slate-400">
                          {fifoResult.totalCount - fifoResult.successCount - 1} remaining {fifoResult.totalCount - fifoResult.successCount - 1 === 1 ? 'allocation was' : 'allocations were'} not processed.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    <motion.button
                      onClick={handleFifoResultClose}
                      className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      Close
                    </motion.button>
                  </div>
                </motion.div>

              /* ──── Main Form / Standalone Customer Search ──── */
              ) : !activeCustomer ? (
                /* Customer Search Screen (Standalone Mode) */
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300">
                      Select Customer <span className="text-red-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400">
                      Search by customer name, phone number, or GSTIN to record a payment
                    </p>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Type customer name or phone..."
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-9 pr-8 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 text-sm transition-colors"
                        autoFocus
                      />
                      {customerSearch && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Status & Results */}
                  {searchLoading ? (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
                      <p className="text-xs">Searching customers...</p>
                    </div>
                  ) : customerSearch.trim().length >= 2 ? (
                    customerResults.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                          Matching Customers ({customerResults.length})
                        </p>
                        {customerResults.map((cust) => {
                          const hasDue = (cust.balance || cust.outstanding || 0) > 0;
                          return (
                            <button
                              key={cust._id}
                              type="button"
                              onClick={() => handleSelectCustomer(cust)}
                              className="w-full text-left p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/70 border border-slate-600/40 hover:border-emerald-500/50 transition-all flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform">
                                  {cust.customerName?.charAt(0)?.toUpperCase() || 'C'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                                    {cust.customerName}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {cust.phone || 'No phone'} {cust.gstin ? `• ${cust.gstin}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-xs font-semibold ${hasDue ? 'text-rose-400' : 'text-slate-400'}`}>
                                  {formatCurrency(cust.balance || cust.outstanding || 0)}
                                </p>
                                <p className="text-[11px] text-slate-500">Balance</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 space-y-1">
                        <p className="text-sm font-medium">No customers found</p>
                        <p className="text-xs text-slate-500">No records matching "{customerSearch}"</p>
                      </div>
                    )
                  ) : (
                    <div className="py-8 text-center text-slate-500 space-y-1">
                      <User className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="text-xs">Type at least 2 characters to search</p>
                    </div>
                  )}
                </div>
              ) : loadingCustomerData ? (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
                  <p className="text-sm font-medium text-white">Loading customer dues & invoices...</p>
                  <p className="text-xs text-slate-500">Preparing payment allocations</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden w-full">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 w-full">
                  {/* Standalone Selected Customer Card */}
                  {!initialCustomer && activeCustomer && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-700/40 border border-slate-600/50">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {activeCustomer.customerName?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{activeCustomer.customerName}</p>
                          <p className="text-xs text-slate-400">{activeCustomer.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearCustomer}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                      >
                        Change Customer
                      </button>
                    </div>
                  )}

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

                  {/* ──── FIFO Toggle ──── */}
                  {!preSelectedInvoiceId && (
                    <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      fifoMode
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-700/30 border-slate-600/50'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <ListOrdered className={`w-4 h-4 ${fifoMode ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <div>
                          <p className={`text-sm font-medium ${fifoMode ? 'text-emerald-300' : 'text-slate-300'}`}>
                            Allocate Automatically (FIFO)
                          </p>
                          <p className="text-xs text-slate-500">
                            Pays oldest debts first chronologically
                          </p>
                        </div>
                      </div>
                      <label className={`inline-flex items-center ${fifoQueue.length === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={fifoMode}
                          disabled={fifoQueue.length === 0}
                          onChange={(e) => {
                            setFifoMode(e.target.checked);
                            setFifoConfirm(false);
                            setFormData(prev => ({ ...prev, amount: '' }));
                            setError('');
                          }}
                        />
                        <div className={`relative w-11 h-6 rounded-full transition-colors shadow-inner ${
                          fifoMode ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}>
                          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            fifoMode ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </label>
                    </div>
                  )}

                  {/* ──── FIFO Mode Content ──── */}
                  {fifoMode ? (
                    <>
                      {fifoQueue.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-slate-400 text-sm">No outstanding balances available for FIFO allocation.</p>
                        </div>
                      ) : (
                        <>
                          {/* FIFO Allocation Preview */}
                          {fifoAllocations.length > 0 && (
                            <motion.div
                              className="rounded-xl border border-slate-600/50 overflow-hidden"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                            >
                              <div className="px-3 py-2 bg-slate-700/50 border-b border-slate-600/50">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                  Allocation Preview
                                </p>
                              </div>
                              <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
                                {fifoQueue.map((item, idx) => {
                                  const allocation = fifoAllocations.find(a => a.id === item.id && a.type === item.type);
                                  const isFull = allocation && allocation.remainingAfterAllocation <= 0;
                                  const isPartial = allocation && allocation.remainingAfterAllocation > 0;
                                  const isUnallocated = !allocation;

                                  return (
                                    <div
                                      key={`${item.type}-${item.id}`}
                                      className={`px-3 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                                        isFull ? 'bg-emerald-500/5' :
                                        isPartial ? 'bg-amber-500/5' :
                                        'opacity-40'
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                            item.type === 'entry'
                                              ? 'bg-purple-500/20 text-purple-400'
                                              : 'bg-blue-500/20 text-blue-400'
                                          }`}>
                                            {item.type === 'entry' ? 'OB' : 'INV'}
                                          </span>
                                          <span className="text-white font-medium truncate">
                                            {item.label}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                          {formatDate(item.effectiveDate)} · Due: {formatCurrency(item.due)}
                                        </p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        {isFull && (
                                          <span className="text-emerald-400 font-medium text-sm flex items-center gap-1">
                                            {formatCurrency(allocation.allocated)}
                                            <CheckCircle className="w-3.5 h-3.5" />
                                          </span>
                                        )}
                                        {isPartial && (
                                          <span className="text-amber-400 font-medium text-sm">
                                            {formatCurrency(allocation.allocated)}
                                          </span>
                                        )}
                                        {isUnallocated && (
                                          <span className="text-slate-600 text-sm">—</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}

                          {/* Summary Card */}
                          <motion.div
                            className="p-4 bg-slate-700/30 rounded-xl border border-slate-600/50"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-slate-400">Total Outstanding</span>
                                <p className="text-white font-semibold mt-0.5">{formatCurrency(totalOutstanding)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-400">Payment Amount</span>
                                <p className="text-blue-400 font-semibold mt-0.5">
                                  {formData.amount ? formatCurrency(parseFloat(formData.amount) || 0) : '—'}
                                </p>
                              </div>
                              {totalAllocated > 0 && (
                                <>
                                  <div>
                                    <span className="text-slate-400">Amount Allocated</span>
                                    <p className="text-emerald-400 font-semibold mt-0.5">{formatCurrency(totalAllocated)}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-400">Remaining After</span>
                                    <p className={`font-semibold mt-0.5 ${
                                      roundCurrency(totalOutstanding - totalAllocated) <= 0
                                        ? 'text-emerald-400'
                                        : 'text-amber-400'
                                    }`}>
                                      {formatCurrency(Math.max(0, roundCurrency(totalOutstanding - totalAllocated)))}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </>

                  /* ──── Single-Payment Mode Content (existing, untouched) ──── */
                  ) : (
                    <>
                      {/* Selection (Invoice or Opening Balance) */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          <FileText className="w-4 h-4 inline mr-2" />
                          Select Invoice or Opening Balance
                        </label>
                        <CustomDropdown
                          value={formData.selectionType === 'entry' ? `entry_${formData.selectionId}` : formData.selectionId}
                          onChange={handleSelectionChange}
                          groups={selectionGroups}
                          placeholder="Choose..."
                          ariaLabel="Select invoice or opening balance"
                          renderOption={(option) => (
                            <span className="block min-w-0">
                              <span className="block truncate font-medium">{option.invoiceNumber}</span>
                              <span className="block text-xs text-slate-400 truncate">
                                {option.date} - Due: {formatCurrency(option.due)}
                              </span>
                            </span>
                          )}
                          renderValue={(option) => (
                            <span className="block truncate">
                              {option.invoiceNumber} - {option.date} - Due: {formatCurrency(option.due)}
                            </span>
                          )}
                        />
                        <div className="hidden">
                          <select
                            value={formData.selectionType === 'entry' ? `entry_${formData.selectionId}` : formData.selectionId}
                            onChange={(e) => handleSelectionChange(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer hover:border-slate-500 transition-colors pr-10"
                            style={{ backgroundImage: 'none' }}
                            disabled
                          >
                            <option value="" className="bg-slate-800 text-slate-400">Choose...</option>
                            
                            {/* Invoices Section */}
                            {payableInvoices.length > 0 && (
                              <optgroup label="📄 Invoices" className="bg-slate-800">
                                {payableInvoices.map((inv) => {
                                  const invoiceId = getInvoiceId(inv);
                                  const remaining = (inv.totals?.netTotal || 0) - (inv.paidAmount || 0);
                                  const cnDed = inv.creditNoteTotal ?? cnByInvoiceMap.get(invoiceId) ?? 0;
                                  const effectiveDue = Math.max(0, roundCurrency(remaining - cnDed));
                                  return (
                                    <option key={invoiceId} value={invoiceId} className="bg-slate-800 text-white py-2">
                                      {inv.invoiceNumber} - {formatDate(inv.invoiceDate)} - Due: {formatCurrency(effectiveDue)}
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
                            {formData.selectionType === 'invoice' && (selectedItem.creditNoteTotal ?? cnByInvoiceMap.get(getInvoiceId(selectedItem)) ?? 0) > 0 && (
                              <div>
                                <span className="text-slate-400">Credit Notes:</span>
                                <span className="ml-2 text-amber-400 font-medium">
                                  -{formatCurrency(selectedItem.creditNoteTotal ?? cnByInvoiceMap.get(getInvoiceId(selectedItem)) ?? 0)}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-400">Due Amount:</span>
                              <span className="ml-2 text-amber-400 font-semibold">
                                {formatCurrency(getEffectiveDue())}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">After Payment:</span>
                              <span className={`ml-2 font-semibold ${
                                getEffectiveDue() - (parseFloat(formData.amount) || 0) <= 0 
                                  ? 'text-emerald-400' 
                                  : 'text-amber-400'
                              }`}>
                                {formatCurrency(Math.max(0, getEffectiveDue() - (parseFloat(formData.amount) || 0)))}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}

                  {/* ──── Amount Input (always visible) ──── */}
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
                          max={fifoMode
                            ? parseFloat(totalOutstanding.toFixed(2))
                            : parseFloat(getEffectiveDue().toFixed(2))
                          }
                          value={formData.amount}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, amount: e.target.value }));
                            if (fifoConfirm) setFifoConfirm(false);
                          }}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          required
                        />
                      </div>
                      {(fifoMode ? fifoQueue.length > 0 : selectedItem) && (
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
                      <CustomDropdown
                        value={formData.paymentMethod}
                        onChange={(nextValue) => setFormData(prev => ({ ...prev, paymentMethod: nextValue }))}
                        groups={paymentMethodOptions}
                        ariaLabel="Select payment method"
                      />
                      <div className="hidden">
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer hover:border-slate-500 transition-colors"
                          style={{ backgroundImage: 'none' }}
                          disabled
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

                  {/* FIFO Confirmation Banner */}
                  {fifoConfirm && (
                    <motion.div
                      className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-amber-300 font-medium">Confirm FIFO Allocation</p>
                          <p className="text-amber-400/80 mt-1">
                            You are about to record a payment of {formatCurrency(parseFloat(formData.amount) || 0)}.
                            This will be allocated across {fifoAllocations.length} outstanding {fifoAllocations.length === 1 ? 'item' : 'items'} using FIFO.
                          </p>
                          <button
                            type="button"
                            onClick={() => setFifoConfirm(false)}
                            className="text-xs text-slate-400 hover:text-white mt-2 underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  </div>

                  {/* Submit Button Footer */}
                  <div className="p-4 sm:p-6 border-t border-slate-700/50 bg-slate-800/95 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] w-full sticky bottom-0 z-10">
                    <motion.button
                      type="submit"
                      disabled={loading || (fifoMode && fifoQueue.length === 0)}
                      className={`w-full py-3.5 font-medium rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        fifoConfirm
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-500/20'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                      }`}
                      whileHover={{ scale: loading ? 1 : 1.01 }}
                      whileTap={{ scale: loading ? 1 : 0.99 }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Recording Payment...
                        </>
                      ) : fifoConfirm ? (
                        <>
                          <Shield className="w-5 h-5" />
                          Confirm & Record {fifoAllocations.length} {fifoAllocations.length === 1 ? 'Payment' : 'Payments'}
                        </>
                      ) : fifoMode ? (
                        <>
                          <ListOrdered className="w-5 h-5" />
                          Allocate via FIFO
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Record Payment
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
