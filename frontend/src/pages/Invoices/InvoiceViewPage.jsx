import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  FileText,
  Calendar,
  CreditCard,
  User,
  Phone,
  MapPin,
  Package,
  Download,
  Share2,
  Eye,
  AlertCircle,
  Building,
  Hash,
  DollarSign,
  Receipt,
  Clock,
  XCircle,
  Edit,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  MoreVertical,
  ChevronDown,
  Check
} from 'lucide-react';
import { invoiceService } from '../../services/invoices/invoiceService';
import { customerService } from '../../services/customers/customerService';
import { manualEntryService } from '../../services/entries/manualEntryService';
import { creditNoteService } from '../../services/credits/creditNoteService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { InvoiceViewPageSkeleton } from './InvoiceViewPageSkeleton';
import RecordPaymentModal from '../../components/Common/Modals/RecordPaymentModal';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth/authService';
import { useSWR, useFirstVisit, invalidateCachePattern } from '../../hooks';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import ShareResourceMenu from '../../components/Common/Sharing/ShareResourceMenu';
import PrintDialog from '../../features/documentPrinting/components/PrintDialog';
import InvoiceDocument from '../../features/documentPrinting/renderers/InvoiceDocument';
import { resolveDocumentPrintFormat, DOCUMENT_TYPES, INVOICE_COPY_MODES } from '../../features/documentPrinting/formats/documentPrintFormats';
import { ALL_INVOICE_COLUMNS, DEFAULT_INVOICE_COLUMNS, resolveActiveColumns, getBatchGroups } from '../../features/documentPrinting/renderers/invoiceColumns';

const roundCurrency = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
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


export default function InvoiceViewPage() {
  const { id } = useParams();
  const location = useLocation();
  const backPath = location.state?.from || '/invoices';
  const [updating, setUpdating] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const columnSettingsRef = useRef(null);
  const manageMenuRef = useRef(null);

  // Outside click listener for floating popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(e.target)) {
        setShowColumnSettings(false);
      }
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target)) {
        setShowManageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key dismiss listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowColumnSettings(false);
        setShowManageMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [copyMode, setCopyMode] = useState(() => {
    try {
      const saved = localStorage.getItem('invoiceCopyMode');
      if (saved === 'single' || saved === 'double' || saved === 'half') {
        return saved;
      }
      return 'double';
    } catch {
      return 'double';
    }
  });
  const isSingleCopy = copyMode === 'single';
  const printRef = useRef();
  const { success, error } = useToast();
  const isFirstVisit = useFirstVisit('invoice-view');

  const { user, admin, updateUserPreferences } = useAuth();
  const enableBatchTracking = user?.preferences?.enableBatchTracking === true;

  // Single canonical source of truth for column definitions
  const ALL_COLUMNS = ALL_INVOICE_COLUMNS;

  // Clean up legacy localStorage key — DB is the single source of truth
  localStorage.removeItem('invoiceColumns');

  const visibleColumns = user?.preferences?.invoiceColumns ?? DEFAULT_INVOICE_COLUMNS;

  // Debounced API save — ref persists across renders, cleanup on unmount
  const saveTimerRef = useRef(null);
  const lastConfirmedRef = useRef(visibleColumns);

  useEffect(() => {
    // Sync confirmed state when server data loads/changes
    lastConfirmedRef.current = visibleColumns;
  }, [visibleColumns]);

  useEffect(() => {
    return () => {
      // Cancel pending debounced save on unmount
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const toggleColumn = (key) => {
    const newColumns = visibleColumns.includes(key)
      ? visibleColumns.filter(k => k !== key)
      : [...visibleColumns, key];

    // Optimistic update — UI updates immediately
    updateUserPreferences({ invoiceColumns: newColumns });

    // Debounced API save — only the final state is persisted
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await authService.updatePreferences({ invoiceColumns: newColumns });
        lastConfirmedRef.current = newColumns;
      } catch (err) {
        // Revert to last confirmed state on failure
        console.error('Failed to save column preferences:', err);
        updateUserPreferences({ invoiceColumns: lastConfirmedRef.current });
        error('Failed to save column preferences');
      }
    }, 500);
  };

  const activeColumns = useMemo(() => {
    return resolveActiveColumns(visibleColumns, { enableBatchTracking });
  }, [visibleColumns, enableBatchTracking]);

  // 1. Fetch Invoice
  const { data: invoiceData, isLoading: invoiceLoading, mutate: mutateInvoice, isValidating: isInvoiceValidating } = useSWR(
    id ? `invoice-${id}` : null,
    () => invoiceService.getInvoice(id)
  );

  // 2. Fetch Credit Notes for Invoice
  const { data: creditNotesData, isLoading: cnLoading, mutate: mutateCN, isValidating: isCNValidating } = useSWR(
    id ? `credit-notes-invoice-${id}` : null,
    () => creditNoteService.getCreditNotesByInvoice(id).catch(() => ({ creditNotes: [] }))
  );

  const invoice = invoiceData?.invoice;
  const creditNotes = useMemo(() => creditNotesData?.creditNotes || [], [creditNotesData]);

  const totalCreditNoteAmount = useMemo(() => roundCurrency(
    creditNotes.reduce((sum, cn) => sum + (cn.totals?.netTotal || 0), 0)
  ), [creditNotes]);

  const netDue = useMemo(() => Math.max(
    0,
    roundCurrency((invoice?.totals?.netTotal || 0) - (invoice?.paidAmount || 0) - totalCreditNoteAmount)
  ), [invoice?.totals?.netTotal, invoice?.paidAmount, totalCreditNoteAmount]);

  const canRecordPayment = Boolean(invoice && invoice.status !== 'Cancelled' && netDue > 0);

  const invoiceForPayment = useMemo(() => {
    if (!invoice) return null;
    return {
      ...invoice,
      creditNoteTotal: totalCreditNoteAmount,
      effectiveDue: netDue
    };
  }, [invoice, totalCreditNoteAmount, netDue]);

  const invoiceForPaymentList = useMemo(() => (
    canRecordPayment && invoiceForPayment ? [invoiceForPayment] : []
  ), [canRecordPayment, invoiceForPayment]);

  // 3. Customer Outstanding Logic (using SWR)
  const customerId = invoice?.customer?._id;

  const fetchCustomerBalance = async () => {
    if (!customerId) return 0;
    try {
      // 1. Authoritative ground-truth calculation directly from customer summary
      const customerData = await customerService.getCustomer(customerId, true, {
        params: { includeInvoices: 'false' }
      });

      const liveDue = customerData?.summary?.calculatedOutstanding
        ?? customerData?.summary?.outstanding
        ?? customerData?.customer?.calculatedOutstanding
        ?? customerData?.customer?.outstandingBalance;

      if (liveDue !== undefined && liveDue !== null) {
        return Number(liveDue);
      }

      // 2. High-precision secondary fallback to ledger closing balance
      const ledgerRes = await customerService.getCustomerLedger(customerId);
      return Number(ledgerRes?.summary?.closingBalance) || 0;
    } catch (e) {
      console.warn('Failed calculating customer outstanding dues', e);
      return 0;
    }
  };

  const { data: customerOutstanding = 0, mutate: mutateCustomerOutstanding } = useSWR(
    customerId ? `customer-outstanding-${customerId}` : null,
    fetchCustomerBalance
  );

  // Update document title for PDF download filename
  useEffect(() => {
    if (invoice) {
      const customerName = invoice.customer?.customerName?.replace(/[^a-zA-Z0-9\s]/g, '') || 'Customer';
      const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
      const invoiceNum = invoice.invoiceNumber || '';

      // Set title for PDF filename: "Invoice_Number_CustomerName_Date"
      document.title = invoiceNum ? `Invoice_${invoiceNum}_${customerName}_${invoiceDate}` : `Invoice_${customerName}_${invoiceDate}`;

      // Restore original title when leaving the page
      return () => {
        document.title = 'Bharat Enterprise - Billing System';
      };
    }
  }, [invoice]);

  const loading = invoiceLoading || cnLoading;
  const isValidating = isInvoiceValidating || isCNValidating;


  const configuredFormat = useMemo(() => {
    return resolveDocumentPrintFormat(user?.preferences || admin?.preferences, DOCUMENT_TYPES.INVOICE);
  }, [user?.preferences, admin?.preferences]);

  const [previewFormat, setPreviewFormat] = useState(configuredFormat);

  useEffect(() => {
    setPreviewFormat(configuredFormat);
  }, [configuredFormat]);

  // Intercept Ctrl+P to trigger format-aware PrintDialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShowPrintDialog(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePrint = () => {
    setShowPrintDialog(true);
  };

  const handleMarkPrinted = async () => {
    setUpdating(true);
    try {
      // Optimistically update status
      mutateInvoice({ invoice: { ...invoice, status: 'Printed' } }, false);
      await invoiceService.updateStatus(id, 'Printed');

      // Invalidate cache for all tabs
      invalidateCachePattern(`invoice-${id}`);
      invalidateCachePattern('invoices');
      success('Invoice marked as printed');
    } catch {
      error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleDownload = () => {
    setShowPrintDialog(true);
  };

  const handleSelectCopyMode = (mode) => {
    setCopyMode(mode);
    try {
      localStorage.setItem('invoiceCopyMode', mode);
    } catch (err) {
      console.warn('Failed saving copyMode', err);
    }
  };

  const toggleCopyMode = () => {
    handleSelectCopyMode(copyMode === 'single' ? 'double' : 'single');
  };

  const handleCancelInvoice = async () => {
    if (!window.confirm('Are you sure you want to cancel this invoice? This action cannot be undone.')) {
      return;
    }

    setUpdating(true);
    try {
      // Optimistically update
      mutateInvoice({ invoice: { ...invoice, status: 'Cancelled' } }, false);
      await invoiceService.updateStatus(id, 'Cancelled');

      // Invalidate cache for all tabs - stock restored on cancel
      invalidateCachePattern(`invoice-${id}`);
      invalidateCachePattern('invoices');
      invalidateCachePattern('dashboard');
      invalidateCachePattern('products');
      success('Invoice cancelled successfully');
    } catch {
      error('Failed to cancel invoice');
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentSuccess = async () => {
    invalidateCachePattern(`invoice-${id}`);
    invalidateCachePattern('invoices');
    invalidateCachePattern('customers');
    invalidateCachePattern('dashboard');
    invalidateCachePattern(`customer-outstanding-${customerId}`);
    await Promise.all([
      mutateInvoice(),
      mutateCN(),
      mutateCustomerOutstanding()
    ]);
  };

  if (loading) {
    return <InvoiceViewPageSkeleton />;
  }

  if (!invoice) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 text-center"
      >
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <AlertCircle className="w-10 h-10 text-red-400" />
        </motion.div>
        <p className="text-slate-400 mb-6 text-lg">Invoice not found</p>
        <Link to={backPath} className="btn btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          Back to Invoices
        </Link>
      </motion.div>
    );
  }

  const statusConfig = {
    Created: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/20', badge: 'badge-info' },
    Printed: { icon: Printer, color: 'text-green-400', bg: 'bg-green-500/20', badge: 'badge-success' },
    Cancelled: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20', badge: 'badge-danger' }
  };

  const StatusIcon = statusConfig[invoice.status]?.icon || FileText;

  return (
    <>
      <RefreshIndicator isRefreshing={isValidating} />
      <motion.div
        variants={pageVariants}
        initial={isFirstVisit ? "hidden" : false}
        animate="visible"
        className="space-y-6"
      >
        {/* Enterprise 2-Tier Header Card */}
        <div className="glass-card p-4 sm:p-5 space-y-4 no-print border border-slate-800/80 shadow-xl">
          {/* ─── Tier 1: Identity & Primary CTAs ──────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Back Link & Document Identity */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={backPath}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-slate-100 text-xs font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
                <span>Invoices</span>
              </Link>

              <div className="h-4 w-px bg-slate-700/60 hidden sm:block" />

              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-mono">
                  {invoice.invoiceNumber || 'INV-DRAFT'}
                </h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig[invoice.status]?.bg || 'bg-slate-800'} ${statusConfig[invoice.status]?.color || 'text-slate-300'} border-current/20`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {invoice.status}
                </span>
              </div>

              {/* Dynamic Payment Due Pill */}
              {invoice.status !== 'Cancelled' && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  netDue > 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {netDue > 0 ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Due: {formatCurrency(netDue)}
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Fully Paid
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Right: High Prominence Primary CTAs */}
            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              {canRecordPayment && (
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="btn btn-success flex items-center gap-2 py-2 px-3.5 text-xs font-medium shadow-md shadow-emerald-900/20 active:translate-y-px"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Record Payment</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-primary flex items-center gap-2 py-2 px-4 text-xs font-medium shadow-md shadow-blue-900/30 active:translate-y-px"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>

          {/* ─── Tier 2: Print & Export Utility Strip ──────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-800/80">
            {/* Left: Print Configurations (Copy Mode & Columns Popover) */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Segmented Copy Mode Capsule */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900/90 border border-slate-700/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleSelectCopyMode('single')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    copyMode === 'single'
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Print single full-page A4 copy"
                >
                  1x Full
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCopyMode('double')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    copyMode === 'double'
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Print two compact copies with Cut Here divider"
                >
                  2x Double
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCopyMode('half')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    copyMode === 'half'
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Print single compact half-sheet copy"
                >
                  1x Half
                </button>
              </div>

              {/* Floating Columns Popover */}
              <div className="relative" ref={columnSettingsRef}>
                <button
                  type="button"
                  onClick={() => setShowColumnSettings(prev => !prev)}
                  className={`btn btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium transition-colors ${
                    showColumnSettings
                      ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-xs'
                      : 'border-slate-700/70 hover:border-slate-600 text-slate-300 hover:text-slate-100'
                  }`}
                  aria-expanded={showColumnSettings}
                  title="Customise table columns on printed invoice"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 pointer-events-none text-slate-400" />
                  <span className="pointer-events-none">Columns</span>
                  <span className={`pointer-events-none px-1.5 py-0.2 rounded-full text-[10px] font-semibold border ${
                    (previewFormat === 'THERMAL_80' || previewFormat === 'THERMAL_58')
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  }`}>
                    {(previewFormat === 'THERMAL_80' || previewFormat === 'THERMAL_58')
                      ? 'Sheet Only'
                      : `${visibleColumns.length}/${ALL_COLUMNS.length}`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none text-slate-400 transition-transform duration-150 ${showColumnSettings ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showColumnSettings && (
                    <motion.div
                      key="invoice-column-popover"
                      className="absolute left-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl shadow-black/80 p-3.5 z-50 will-change-[transform,opacity]"
                      style={{ transformOrigin: 'top left' }}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <span className="text-xs font-semibold text-slate-200">Printed Columns</span>
                        <span className="text-[11px] text-slate-400">{visibleColumns.length} visible</span>
                      </div>

                      {(previewFormat === 'THERMAL_80' || previewFormat === 'THERMAL_58') && (
                        <div className="mb-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-1.5 leading-snug">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>
                            Thermal roll printers use a compact POS receipt layout. Column customization applies to A4 / A5 sheet formats.
                          </span>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-400 mb-2.5">
                        Toggle which columns appear on the printed document:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {ALL_COLUMNS.map(col => {
                          const isActive = visibleColumns.includes(col.key);
                          return (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() => toggleColumn(col.key)}
                              className={`px-2 py-1.5 rounded-lg text-xs flex items-center justify-between border transition-all text-left ${
                                isActive
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/40 font-medium'
                                  : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200'
                              }`}
                            >
                              <span className="truncate">{col.label}</span>
                              {isActive ? (
                                <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-1" />
                              ) : (
                                <span className="w-3.5 h-3.5 shrink-0 ml-1 border border-slate-600 rounded-sm" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mark Printed Action (when Created) */}
              <AnimatePresence>
                {invoice.status === 'Created' && (
                  <motion.button
                    type="button"
                    onClick={handleMarkPrinted}
                    disabled={updating}
                    className="btn btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    title="Mark status as printed"
                  >
                    {updating ? (
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{updating ? 'Updating...' : 'Mark Printed'}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Export Utilities & Manage Dropdown */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="btn btn-secondary flex items-center gap-1.5 py-1.5 px-2.5 text-xs font-medium hover:text-slate-100 border-slate-700/70"
                title="Download PDF"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Download</span>
              </button>

              <ShareResourceMenu
                resourceType="invoice"
                resourceId={invoice._id}
                resourceTitle={`Invoice #${invoice.invoiceNumber || ''} for ${invoice.customer?.customerName || invoice.customer?.name || 'Customer'}`}
                fileName={`Invoice_${invoice.invoiceNumber || 'INV'}_${invoice.customer?.customerName || 'Customer'}.pdf`}
                getPdfBlob={() => invoiceService.getInvoicePDFBlob(id)}
              />

              {/* Manage Dropdown (Edit, Create Return, Cancel) */}
              {invoice.status !== 'Cancelled' && (
                <div className="relative" ref={manageMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowManageMenu(prev => !prev)}
                    className={`btn btn-secondary flex items-center gap-1.5 py-1.5 px-2.5 text-xs font-medium transition-colors ${
                      showManageMenu
                        ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-xs'
                        : 'border-slate-700/70 text-slate-300 hover:text-slate-100'
                    }`}
                    aria-expanded={showManageMenu}
                    title="More actions"
                  >
                    <MoreVertical className="w-3.5 h-3.5 pointer-events-none text-slate-400" />
                    <span className="pointer-events-none hidden sm:inline">Manage</span>
                  </button>

                  <AnimatePresence>
                    {showManageMenu && (
                      <motion.div
                        key="invoice-manage-menu"
                        className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl shadow-black/80 p-1.5 z-50 will-change-[transform,opacity]"
                        style={{ transformOrigin: 'top right' }}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <Link
                          to={`/invoices/${id}/edit`}
                          onClick={() => setShowManageMenu(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
                        >
                          <Edit className="w-4 h-4 text-slate-400" />
                          <span>Edit Invoice</span>
                        </Link>

                        <Link
                          to={`/invoices/${id}/return`}
                          onClick={() => setShowManageMenu(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4 text-amber-400" />
                          <span>Create Return</span>
                        </Link>

                        <div className="h-px bg-slate-800 my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setShowManageMenu(false);
                            handleCancelInvoice();
                          }}
                          disabled={updating}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
                        >
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>Cancel Invoice</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Credit Notes Section */}
        {creditNotes.length > 0 && (
          <motion.div variants={cardVariants} className="glass-card overflow-hidden no-print">
            <div className="p-5 border-b border-slate-700/50 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-slate-100 font-semibold">Credit Notes / Returns</h2>
                <p className="text-xs text-slate-400">{creditNotes.length} return(s) associated with this invoice</p>
              </div>
            </div>
            <div className="divide-y divide-slate-700/50">
              {creditNotes.map((cn, idx) => (
                <Link
                  key={cn._id}
                  to={`/credit-notes/${cn._id}`}
                  className="block p-4 hover:bg-slate-700/30 transition-colors group"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex flex-col sm:flex-row justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-amber-500/10 rounded-lg mt-0.5">
                        <Receipt className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-amber-400 font-semibold group-hover:text-amber-300 transition-colors">
                          {cn.creditNoteNumber}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(cn.createdAt)}
                          {cn.reason && <span> · {cn.reason}</span>}
                        </p>
                        <p className="text-sm text-slate-300 mt-1">
                          {cn.items.map(item => `${item.productName} ×${item.quantityReturned}`).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:text-right">
                      <div className="px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-xs text-slate-400">Credit Amount</p>
                        <p className="text-lg font-bold text-emerald-400">{formatCurrency(cn.totals?.netTotal)}</p>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-slate-500 rotate-180 group-hover:text-slate-100 transition-colors hidden sm:block" />
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
        {/* Due Amount Summary Card */}
        {invoice && (
          <motion.div variants={cardVariants} className="glass-card p-5 no-print">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-slate-100 font-semibold">Payment Summary</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">Invoice Total</p>
                <p className="text-lg font-bold text-slate-100">{formatCurrency(invoice.totals?.netTotal)}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">Paid Amount</p>
                <p className="text-lg font-bold text-emerald-400">{formatCurrency(invoice.paidAmount || 0)}</p>
              </div>
              {totalCreditNoteAmount > 0 && (
                <div className="p-3 bg-slate-800/50 rounded-xl border border-amber-500/30">
                  <p className="text-xs text-slate-400 mb-1">Credit Notes</p>
                  <p className="text-lg font-bold text-amber-400">-{formatCurrency(totalCreditNoteAmount)}</p>
                </div>
              )}
              <div className={`p-3 rounded-xl border ${netDue > 0
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                <p className="text-xs text-slate-400 mb-1">Net Due</p>
                <p className={`text-lg font-bold ${netDue > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}>{formatCurrency(netDue)}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Invoice Format-Aware Document Preview Area */}
        <div className="w-full space-y-3 no-print">
          {/* Format Selection Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-200">
                  Document Preview ({previewFormat === 'THERMAL_80' ? 'Thermal 80mm Roll' : previewFormat === 'THERMAL_58' ? 'Thermal 58mm Roll' : 'A4 / A5 Sheet'})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Preview adapts to selected paper format. Click buttons to inspect other formats.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Layout mode toggle when A4 format is selected */}
              {previewFormat === 'A4' && (
                <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 mr-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSelectCopyMode('single')}
                    className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                      copyMode === 'single'
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Single full-page tax invoice"
                  >
                    1x Full Page (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectCopyMode('double')}
                    className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                      copyMode === 'double'
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Two compact copies with Cut Here divider"
                  >
                    2x Half Sheet (A5 Cut)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectCopyMode('half')}
                    className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                      copyMode === 'half'
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Single compact half-sheet invoice"
                  >
                    1x Half Sheet
                  </button>
                </div>
              )}

              {[
                { id: 'A4', label: 'A4 / A5' },
                { id: 'THERMAL_80', label: 'Thermal 80mm' },
                { id: 'THERMAL_58', label: 'Thermal 58mm' }
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setPreviewFormat(fmt.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                    previewFormat === fmt.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Render Active Document Preview */}
          <div className="w-full overflow-x-auto pb-4 flex justify-start sm:justify-center">
            <motion.div
              ref={printRef}
              variants={cardVariants}
              className={`bg-white border-2 border-slate-300 shadow-xl shrink-0 my-0 sm:mx-auto ${
                previewFormat === 'THERMAL_80'
                  ? 'max-w-[74mm] sm:max-w-[320px] p-2'
                  : previewFormat === 'THERMAL_58'
                  ? 'max-w-[52mm] sm:max-w-[260px] p-1.5'
                  : 'max-w-[190mm] p-2'
              }`}
              style={{
                width: previewFormat === 'THERMAL_80' ? '74mm' : previewFormat === 'THERMAL_58' ? '52mm' : '190mm',
                color: '#000000',
                margin: '0 auto'
              }}
            >
              <InvoiceDocument
                invoice={invoice}
                format={previewFormat}
                copyMode={copyMode}
                isSingleCopy={isSingleCopy}
                admin={admin}
                customerOutstanding={customerOutstanding}
                columns={activeColumns}
                enableBatchTracking={enableBatchTracking}
              />
            </motion.div>
          </div>
        </div>
      </motion.div>
      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        customer={invoice.customer}
        invoices={invoiceForPaymentList}
        manualEntries={[]}
        preSelectedInvoice={invoiceForPayment}
        creditNotes={creditNotes}
      />
      <PrintDialog
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        documentType={DOCUMENT_TYPES.INVOICE}
        title={`Print Tax Invoice ${invoice.invoiceNumber || ''}`}
        initialFormat={previewFormat}
        copyMode={copyMode}
        onSelectCopyMode={handleSelectCopyMode}
        isSingleCopy={isSingleCopy}
        onToggleCopyMode={toggleCopyMode}
        renderDocument={(activeFormat, activeCopyMode) => (
          <InvoiceDocument
            invoice={invoice}
            format={activeFormat}
            copyMode={activeCopyMode}
            isSingleCopy={activeCopyMode === 'single'}
            admin={admin}
            customerOutstanding={customerOutstanding}
            columns={activeColumns}
            enableBatchTracking={enableBatchTracking}
          />
        )}
      />
    </>
  );
}
