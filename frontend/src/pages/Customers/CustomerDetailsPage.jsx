import { useEffect, useMemo, useRef, useState } from 'react';
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
  AlertTriangle,
  Shield,
  BookOpen,
  Palette,
  Edit3,
  Trash2
} from 'lucide-react';
import { customerService } from '../../services/customers/customerService';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { getPaymentsByCustomer, getPaymentStatusColor, deletePayment } from '../../services/credits/creditService';
import { manualEntryService, deleteManualEntry, updateManualEntry } from '../../services/entries/manualEntryService';
import { creditNoteService } from '../../services/credits/creditNoteService';
import { formatCurrency, formatDate, formatPhone } from '../../utils/formatters';
import { CUSTOMER_THEMES, getCustomerTheme } from '../../utils/customerTheme';
import { PageLoader } from '../../components/Common/Feedback/Loader';
import RecordPaymentModal from '../../components/Common/Modals/RecordPaymentModal';
import EditPaymentModal from '../../components/Common/Modals/EditPaymentModal';
import ManualEntryModal from '../../components/ManualEntry/ManualEntryModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { invalidateCachePattern, useMotionConfig, useFirstVisit, useMediaQuery } from '../../hooks';
import { VirtualizedList } from '../../components/Common/VirtualizedList';
import { InfiniteVirtualizedList } from '../../components/Common/InfiniteVirtualizedList';
import { useQuery, useQueryClient } from '@tanstack/react-query';
const LARGE_ROW_THRESHOLD = 20;
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const getInvoiceRemaining = (invoice) => {
  const remaining = round2((invoice.totals?.netTotal || 0) - (invoice.paidAmount || 0));
  return remaining > 0 ? remaining : 0;
};

const getInvoicePaymentStatus = (invoice, cnDeduction = 0) => {
  const remaining = getInvoiceRemaining(invoice);
  const adjustedRemaining = Math.max(0, round2(remaining - cnDeduction));
  const paidAmount = round2(invoice.paidAmount || 0);
  const hasCredits = cnDeduction > 0;

  if (adjustedRemaining <= 0 && (paidAmount > 0 || hasCredits)) return 'Paid';
  if (paidAmount > 0 || hasCredits) return 'Partial';
  return 'Unpaid';
};

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

/* ─────────────────────────────────────────────────────────────
   Shared content for the printable A4 ledger (used by both
   desktop inline preview and the mobile collapsible preview)
───────────────────────────────────────────────────────────── */
function PrintLedgerContent({ admin, customer, ledgerData, formatDate }) {
  return (
    <div className="invoice-copy" style={{ padding: '8mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
      {/* Firm Header */}
      <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              {admin?.firmName || 'BHARAT ENTERPRISES'}
            </h1>
            <p style={{ fontSize: '10px', margin: '2px 0' }}>{admin?.firmAddress || ''}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px' }}>
            {admin?.firmPhone && <p style={{ margin: '1px 0' }}>Phone: {admin.firmPhone}</p>}
            {admin?.firmGSTIN && <p style={{ margin: '1px 0' }}>GSTIN: {admin.firmGSTIN}</p>}
          </div>
        </div>
        <div style={{ textAlign: 'center', margin: '8px 0 4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', border: '1px solid #000', padding: '2px 16px' }}>
            CUSTOMER LEDGER
          </span>
        </div>
        <p style={{ textAlign: 'center', fontSize: '11px', fontStyle: 'italic', margin: '6px 0 0' }}>
          From the Books of <strong>{admin?.firmName || 'BHARAT ENTERPRISES'}</strong>
        </p>
      </div>

      {/* Customer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px' }}>
        <div>
          <p style={{ margin: '2px 0' }}><strong>Customer:</strong> M/s {customer.customerName}</p>
          {customer.address && <p style={{ margin: '2px 0' }}><strong>Address:</strong> {customer.address}</p>}
          {customer.phone && <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {customer.phone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {customer.gstin && <p style={{ margin: '2px 0' }}><strong>GSTIN:</strong> {customer.gstin}</p>}
          {customer.dlNo && <p style={{ margin: '2px 0' }}><strong>DL No:</strong> {customer.dlNo}</p>}
          <p style={{ margin: '2px 0' }}><strong>Date:</strong> {formatDate(new Date())}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', border: '1px solid #000' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', background: '#f0f0f0' }}>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '10%' }}>Date</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '12%' }}>Type</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '12%' }}>Ref #</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '10%' }}>Mode</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '26%' }}>Description</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', width: '10%' }}>Debit (₹)</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', width: '10%' }}>Credit (₹)</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', width: '10%' }}>Balance (₹)</th>
          </tr>
        </thead>
        <tbody>
          {ledgerData.ledger.map((entry, idx) => (
            <tr key={idx} style={{ borderBottom: '0.5px solid #ccc' }}>
              <td style={{ border: '1px solid #000', padding: '3px' }}>{formatDate(entry.date)}</td>
              <td style={{ border: '1px solid #000', padding: '3px', fontWeight: entry.debit > 0 ? 'bold' : 'normal' }}>{entry.type}</td>
              <td style={{ border: '1px solid #000', padding: '3px' }}>{entry.ref}</td>
              <td style={{ border: '1px solid #000', padding: '3px' }}>{entry.mode && entry.mode !== '-' ? entry.mode : ''}</td>
              <td style={{ border: '1px solid #000', padding: '3px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</td>
              <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>
                {entry.debit > 0 ? entry.debit.toFixed(2) : ''}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>
                {entry.credit > 0 ? entry.credit.toFixed(2) : ''}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>
                {Math.abs(entry.balance).toFixed(2)} {entry.balance > 0 ? '(Dr)' : entry.balance < 0 ? '(Cr)' : ''}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', background: '#fafafa', borderTop: '2px solid #000', borderBottom: '1px solid #ccc' }}>
            <td colSpan="5" style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>TOTAL TRANSACTIONS</td>
            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', opacity: 0.7 }}>
              {ledgerData.summary?.totalDebit?.toFixed(2)}
            </td>
            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', opacity: 0.7 }}>
              {ledgerData.summary?.totalCredit?.toFixed(2)}
            </td>
            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', opacity: 0.7 }}>-</td>
          </tr>
          <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', background: '#f0f0f0', fontSize: '10px' }}>
            <td colSpan="7" style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>CLOSING BALANCE:</td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
              {Math.abs(ledgerData.summary?.closingBalance || 0).toFixed(2)}{' '}
              {(ledgerData.summary?.closingBalance || 0) > 0 ? '(Dr)' : (ledgerData.summary?.closingBalance || 0) < 0 ? '(Cr)' : ''}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
        <div>
          <p>E &amp; O E</p>
          <p style={{ marginTop: '4px', fontStyle: 'italic' }}>This is a computer-generated ledger statement.</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: '30px' }}></div>
          <p style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Mobile-only collapsible wrapper for the ledger print preview.
   Shows a compact toggle button; when expanded, renders the
   A4 preview inside a horizontally-scrollable container so the
   wide table doesn't break out of the viewport.
───────────────────────────────────────────────────────────── */
function MobilePrintPreview({ ledgerPrintRef, admin, customer, ledgerData, formatDate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden no-print-hide mt-4 px-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-200 text-sm font-medium active:scale-95 transition-transform"
      >
        <span className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-blue-400" />
          Print Preview
        </span>
        <span className="text-xs text-slate-400">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-slate-700/50 overflow-x-auto bg-white shadow-lg" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* The actual A4 content — ref is applied here so printing still works */}
          <div
            ref={ledgerPrintRef}
            className="invoice-print"
            style={{ width: '210mm', fontSize: '11px', color: '#000', padding: '2mm' }}
          >
            <PrintLedgerContent
              admin={admin}
              customer={customer}
              ledgerData={ledgerData}
              formatDate={formatDate}
            />
          </div>
        </div>
      )}
    </div>
  );
}


export default function CustomerDetailsPage() {
  const { id } = useParams();
  const { isAdmin, admin } = useAuth();
  const { success, error } = useToast();
  const ledgerPrintRef = useRef();

  const handlePrintLedger = () => {
    document.title = `Ledger_${customer?.customerName?.replace(/\s+/g, '_') || 'Customer'}`;
    window.print();
    setTimeout(() => { document.title = 'Bharat Enterprise - Billing System'; }, 1000);
  };

  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('customer-details');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [activeTab, setActiveTab] = useState('invoices');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [ledgerData, setLedgerData] = useState({ ledger: [], summary: null });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const queryClient = useQueryClient();

  // --- React Query for Customer & Summary ---
  const { data: customerData, isLoading, refetch: refetchCustomer } = useQuery({
    queryKey: ['customer-summary', id],
    queryFn: () => customerService.getCustomer(id, true, { params: { includeInvoices: false } }),
    staleTime: 5 * 60 * 1000
  });

  const customer = customerData?.customer || null;
  const summary = customerData?.summary || {
    outstanding: 0, credit: 0, balance: 0, totalPurchases: 0,
    invoiceCount: 0, paymentCount: 0, creditNoteCount: 0, manualEntryCount: 0
  };

  // For backward compatibility in RecordPaymentModal
  const { data: unpaidData } = useQuery({
    queryKey: ['customer-unpaid', id],
    queryFn: async () => {
      const [invData, entryData, cnData] = await Promise.all([
        customerService.getCustomerInvoices(id, { limit: 200, status: ['Unpaid', 'Partial'] }).catch(() => ({ items: [] })),
        manualEntryService.getUnpaidOpeningBalances(id).catch(() => ({ manualEntries: [] })),
        creditNoteService.getCreditNotesByCustomer(id, { limit: 200 }).catch(() => ({ items: [] }))
      ]);
      return { 
        invoices: invData.items || invData.invoices || [], 
        entries: entryData.manualEntries || [],
        creditNotes: cnData.items || cnData.creditNotes || []
      };
    },
    enabled: showPaymentModal
  });

  // Calculate current financial year
  const getInitialFY = () => {
    const today = new Date();
    const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return {
      startDate: `${year}-04-01`,
      endDate: `${year + 1}-03-31`,
      sortOrder: 'asc',
      limit: 200,
      offset: 0
    };
  };
  const [ledgerFilters, setLedgerFilters] = useState(getInitialFY());
  const [ledgerMeta, setLedgerMeta] = useState({ totalCount: 0, hasMore: false });

  // Load ledger on tab switch or filter change
  useEffect(() => {
    if (activeTab === 'ledger' && id) {
      loadLedger();
    }
  }, [activeTab, id, ledgerFilters.startDate, ledgerFilters.endDate, ledgerFilters.sortOrder, ledgerFilters.offset]);

  const loadLedger = async () => {
    setLedgerLoading(true);
    try {
      const data = await customerService.getCustomerLedger(id, ledgerFilters);
      setLedgerData({ ledger: data.ledger || [], summary: data.summary || null });
      setLedgerMeta({ totalCount: data.totalCount || 0, hasMore: data.hasMore || false });
    } catch (error) {
      console.error('Failed to load ledger:', error);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Invalidate cache for all tabs so payment shows everywhere
    invalidateCachePattern('customers');
    invalidateCachePattern('invoices');
    invalidateCachePattern('dashboard');
    invalidateCachePattern('credits'); // Credit reports need refresh
    queryClient.invalidateQueries({ queryKey: ['customer-summary', id] });
    queryClient.invalidateQueries({ queryKey: ['customer-unpaid', id] });
    queryClient.invalidateQueries({ queryKey: ['customer-invoices', id] });
    queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
    queryClient.invalidateQueries({ queryKey: ['customer-ledger', id] });
    queryClient.invalidateQueries({ queryKey: ['customer-manual-entries', id] });
  };

  const handleRecordPayment = (invoice = null) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handleThemeChange = async (themeId) => {
    if (!customer || themeSaving) return;
    if (themeId === (customer.theme || 'emerald')) return;

    setThemeSaving(true);
    try {
      await customerService.updateCustomer(customer._id, {
        ...customer,
        theme: themeId
      });
      refetchCustomer();
      invalidateCachePattern('customers');
      success('Customer theme updated');
    } catch (err) {
      console.error('Failed to update customer theme:', err);
      error('Failed to update customer theme');
    } finally {
      setThemeSaving(false);
    }
  };

  const shouldAnimateRows = motionConfig.shouldAnimate;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldAnimateRows ? 0.08 : 0,
        delayChildren: shouldAnimateRows ? 0.12 : 0
      }
    }
  };

  const denseRows = false;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: motionConfig.isMobile || denseRows ? 'tween' : 'spring',
        duration: motionConfig.isMobile || denseRows ? 0.18 : undefined,
        stiffness: motionConfig.isMobile || denseRows ? undefined : 300,
        damping: motionConfig.isMobile || denseRows ? undefined : 24
      }
    }
  };

  const tableRowVariants = {
    hidden: { opacity: 0, x: denseRows ? 0 : -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: shouldAnimateRows ? Math.min(i * 0.02, 0.12) : 0,
        type: denseRows ? 'tween' : 'spring',
        duration: denseRows ? 0.12 : undefined,
        stiffness: denseRows ? undefined : 300,
        damping: denseRows ? undefined : 24
      }
    })
  };



  if (isLoading) {
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
    { id: 'invoices', label: 'Invoices', icon: FileText, count: summary.invoiceCount },
    { id: 'payments', label: 'Payments', icon: CreditCard, count: summary.paymentCount + summary.manualEntryCount },
    { id: 'ledger', label: 'Ledger', icon: BookOpen, count: null },
  ];

  // Ledger type badge config
  const ledgerTypeConfig = {
    'Invoice': { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: ArrowUpRight },
    'Payment': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: ArrowDownLeft },
    'Credit Note': { color: 'bg-accent-500/20 text-accent-400 border-accent-500/30', icon: ArrowDownLeft },
    'Opening Balance': { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: ArrowUpRight },
    'Manual Bill': { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: ArrowUpRight },
    'Payment Adjustment': { color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: ArrowDownLeft },
    'Credit Adjustment': { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: ArrowDownLeft },
  };

  // Get entry type display info
  const getEntryTypeInfo = (entryType) => {
    const types = {
      'opening_balance': { label: 'Opening Balance', icon: '📊' },
      'manual_bill': { label: 'Manual Bill', icon: '💰' },
      'payment_adjustment': { label: 'Payment', icon: '💳' },
      'credit_adjustment': { label: 'Credit Adjustment', icon: '✏️' }
    };
    return types[entryType] || { label: entryType, icon: '📋' };
  };

  const activeTheme = getCustomerTheme(customer.theme);
  const activeThemeId = customer.theme || 'blue';

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial={isFirstVisit ? "hidden" : false}
        animate="visible"
        className="space-y-6 no-print"
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
        <div className="flex flex-col xl:flex-row xl:items-start gap-6">
          {/* Avatar */}
          <motion.div
            className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${activeTheme.gradient} flex items-center justify-center flex-shrink-0 shadow-lg ${activeTheme.shadow} relative overflow-hidden`}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <span className="text-white font-bold text-3xl relative z-10">
              {customer.customerName?.charAt(0)}
            </span>
            <motion.div
              className={`absolute inset-0 bg-gradient-to-br ${activeTheme.hoverGradient}`}
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Phone */}
              <motion.div
                className="flex items-start gap-2 text-sm group min-w-0"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ x: 4 }}
              >
                <Phone className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-0.5" />
                <span className="text-slate-500 shrink-0">Phone:</span>
                <span className="text-slate-300 min-w-0 break-all">{formatPhone(customer.phone)}</span>
              </motion.div>

              {/* Email */}
              {customer.email && (
                <motion.div
                  className="flex items-start gap-2 text-sm group min-w-0"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ x: 4 }}
                >
                  <Mail className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500 shrink-0">Email:</span>
                  <span className="text-slate-300 min-w-0 break-all">{customer.email}</span>
                </motion.div>
              )}

              {/* GSTIN */}
              {customer.gstin && (
                <motion.div
                  className="flex items-start gap-2 text-sm group min-w-0"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ x: 4 }}
                >
                  <FileText className="w-4 h-4 text-slate-500 group-hover:text-accent-400 transition-colors flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500 shrink-0">GSTIN:</span>
                  <span className="text-slate-300 min-w-0 break-all">{customer.gstin}</span>
                </motion.div>
              )}

              {/* DL No */}
              {customer.dlNo && (
                <motion.div
                  className="flex items-start gap-2 text-sm group min-w-0"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ x: 4 }}
                >
                  <FileText className="w-4 h-4 text-slate-500 group-hover:text-yellow-400 transition-colors flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500 shrink-0">DL No:</span>
                  <span className="text-slate-300 min-w-0 break-all">{customer.dlNo}</span>
                </motion.div>
              )}

              {/* Address */}
              {customer.address && (
                <motion.div
                  className="md:col-span-2 xl:col-span-3 flex items-start gap-2 text-sm group min-w-0"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ x: 4 }}
                >
                  <MapPin className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500 shrink-0">Address:</span>
                  <span className="text-slate-300 min-w-0 break-words">{customer.address}</span>
                </motion.div>
              )}
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider mb-2">
                <Palette className="w-4 h-4 text-slate-500" />
                Theme
                {themeSaving && <span className="text-slate-400 normal-case">Saving...</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {CUSTOMER_THEMES.map((theme) => {
                  const isSelected = theme.id === activeThemeId;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleThemeChange(theme.id)}
                      disabled={themeSaving}
                      aria-pressed={isSelected}
                      title={theme.label}
                      className={`relative w-9 h-9 rounded-lg bg-gradient-to-br ${theme.gradient} shadow-lg ${theme.shadow} ring-2 ring-transparent transition-transform ${
                        isSelected ? 'ring-white/70 scale-105' : 'hover:scale-105'
                      } ${themeSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                      )}
                    </button>
                  );
                })}
                <span className="text-xs text-slate-400 ml-1">{activeTheme.label}</span>
              </div>
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
                summary.balance > 0 
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
                  summary.balance > 0 
                    ? 'from-amber-500/10' 
                    : 'from-emerald-500/10'
                } to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              <motion.div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
                  summary.balance > 0 
                    ? 'bg-amber-500/20' 
                    : 'bg-emerald-500/20'
                }`}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <Wallet className={`w-5 h-5 ${
                  summary.balance > 0 
                    ? 'text-amber-400' 
                    : 'text-emerald-400'
                }`} />
              </motion.div>
              <p className={`text-2xl font-bold mb-1 ${
                summary.balance > 0 
                  ? 'text-amber-400' 
                  : 'text-emerald-400'
              }`}>
                <AnimatedCounter 
                  value={summary.balance} 
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
        <div className="border-b border-slate-700">
          {/* Top row: tabs + non-ledger actions */}
          <div className="p-3 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-3">
            {/* Tabs – wrap on mobile */}
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm ${
                      activeTab === tab.id
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium whitespace-nowrap">{tab.label}</span>
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

            {/* Actions (non-ledger) */}
            <div className="flex flex-wrap gap-2 flex-shrink-0 items-center justify-start lg:justify-end">
              {isAdmin && activeTab !== 'ledger' && (
                <motion.button
                  onClick={() => setShowManualEntryModal(true)}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Manual Entry</span>
                </motion.button>
              )}
              {activeTab !== 'ledger' && (summary.balance > 0 || summary.unpaidInvoicesCount > 0) && (
                <motion.button
                  onClick={() => handleRecordPayment()}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">Record Payment</span>
                </motion.button>
              )}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to={`/invoices/create?customer=${customer._id}`}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Invoice</span>
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Ledger filter bar – stacks vertically on mobile */}
          {activeTab === 'ledger' && (
            <div className="px-3 sm:px-5 pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center gap-2">
              {/* Date range */}
              <div className="flex flex-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700 min-w-0">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-300 border-none outline-none px-2 [color-scheme:dark]"
                  value={ledgerFilters.startDate}
                  onChange={(e) => setLedgerFilters(f => ({ ...f, startDate: e.target.value, offset: 0 }))}
                />
                <span className="text-slate-500 self-center px-1 flex-shrink-0">to</span>
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-300 border-none outline-none px-2 [color-scheme:dark]"
                  value={ledgerFilters.endDate}
                  onChange={(e) => setLedgerFilters(f => ({ ...f, endDate: e.target.value, offset: 0 }))}
                />
              </div>
              {/* Sort + Print */}
              <div className="flex gap-2">
                <button
                  onClick={() => setLedgerFilters(f => ({ ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc', offset: 0 }))}
                  className="btn btn-secondary btn-sm flex items-center gap-1 flex-1 sm:flex-none justify-center"
                >
                  {ledgerFilters.sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                </button>
                <motion.button
                  onClick={handlePrintLedger}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </motion.button>
              </div>
            </div>
          )}
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
                {summary.invoiceCount === 0 ? (
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
                  <div className={isDesktop ? "glass-card overflow-x-auto" : ""}>
                    {isDesktop && (
                      <div className="grid grid-cols-[130px_130px_100px_minmax(120px,1.5fr)_130px_130px_140px] min-w-[880px] items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 bg-slate-800/50">
                        <div>Invoice #</div>
                        <div>Date</div>
                        <div>Items</div>
                        <div>Amount</div>
                        <div>Payment</div>
                        <div>Status</div>
                        <div>Action</div>
                      </div>
                    )}
                    
                    <div className={!isDesktop ? "space-y-3" : ""}>
                      <InfiniteVirtualizedList
                        queryKey={['customer-invoices', id]}
                        queryFn={({ pageParam = 1 }) => customerService.getCustomerInvoices(id, { page: pageParam, limit: 20 })}
                        estimateSize={() => isDesktop ? 65 : 160}
                        getKey={(invoice) => invoice._id}
                        className={isDesktop ? "min-h-[65px]" : "min-h-[160px]"}
                        itemClassName={isDesktop ? "" : "mb-3"}
                        renderItem={(invoice, index) => {
                          const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                          const remaining = getInvoiceRemaining(invoice);
                          // Since we don't have creditNoteByInvoiceMap in infinite scrolling easily without a big refactor,
                          // we just use 0 or fetch it dynamically if needed. For now, rely on standard remaining logic.
                          const cnDeduction = 0; 
                          const adjustedRemaining = Math.max(0, round2(remaining - cnDeduction));
                          const paymentStatus = getInvoicePaymentStatus(invoice, cnDeduction);
                          const PaymentIcon = paymentStatusConfig[paymentStatus]?.icon || AlertTriangle;
                          const isCancelled = invoice.status === 'Cancelled';
                          
                          if (isDesktop) {
                            return (
                              <div className={`grid grid-cols-[130px_130px_100px_minmax(120px,1.5fr)_130px_130px_140px] min-w-[880px] items-center px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors ${isCancelled ? 'bg-red-500/5' : ''}`}>
                                <div className={`font-medium flex items-center gap-2 ${isCancelled ? 'text-red-400' : 'text-white'}`}>
                                  <FileText className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-blue-400'}`} />
                                  {invoice.invoiceNumber}
                                </div>
                                <div className={`flex items-center gap-2 ${isCancelled ? 'text-red-400' : 'text-slate-300'}`}>
                                  <Calendar className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                                  {formatDate(invoice.invoiceDate)}
                                </div>
                                <div className={`flex items-center gap-2 ${isCancelled ? 'text-red-400' : 'text-slate-300'}`}>
                                  <Package className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                                  {invoice.items?.length || 0} items
                                </div>
                                <div className={`font-medium ${isCancelled ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                                  {formatCurrency(invoice.totals?.netTotal)}
                                </div>
                                <div>
                                  {invoice.status === 'Cancelled' ? (
                                    <span className="text-slate-500">-</span>
                                  ) : (
                                    <div className="flex flex-col">
                                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 flex-shrink-0 w-max rounded-full border ${paymentStatusConfig[paymentStatus]?.class}`}>
                                        <PaymentIcon className="w-3 h-3" />
                                        {paymentStatus}
                                      </span>
                                      {paymentStatus === 'Partial' && (
                                        <span className="text-xs w-max text-slate-500 mt-1">
                                          Due: {formatCurrency(adjustedRemaining)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <span className={`badge ${statusConfig[invoice.status]?.class || 'badge-info'} inline-flex items-center gap-1.5`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {invoice.status}
                                  </span>
                                </div>
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
                              </div>
                            );
                          }
                          
                          // Mobile Card View
                          return (
                            <div className={`p-4 rounded-xl border ${
                                isCancelled 
                                  ? 'bg-red-500/5 border-red-500/20' 
                                  : 'bg-slate-800/50 border-slate-700/50 hover:border-blue-500/50'
                              } flex flex-col gap-3 relative overflow-hidden transition-colors`}
                            >
                              <div className="flex items-center justify-between">
                                <Link 
                                  to={`/invoices/${invoice._id}`}
                                  className={`font-medium flex items-center gap-2 ${isCancelled ? 'text-red-400' : 'text-white hover:text-blue-400'}`}
                                >
                                  <FileText className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-blue-400'}`} />
                                  {invoice.invoiceNumber}
                                </Link>
                                <span className={`font-medium ${isCancelled ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {formatCurrency(invoice.totals?.netTotal)}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between text-sm">
                                <div className={`flex items-center gap-1.5 ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>
                                  <Calendar className="w-3.5 h-3.5" />
                                  {formatDate(invoice.invoiceDate)}
                                </div>
                                <div className={`flex items-center gap-1.5 ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>
                                  <Package className="w-3.5 h-3.5" />
                                  {invoice.items?.length || 0} items
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`badge ${statusConfig[invoice.status]?.class || 'badge-info'} inline-flex items-center gap-1 text-xs`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {invoice.status}
                                  </span>
                                  
                                  {invoice.status !== 'Cancelled' && (
                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${paymentStatusConfig[paymentStatus]?.class}`}>
                                      <PaymentIcon className="w-3 h-3" />
                                      {paymentStatus}
                                      {paymentStatus === 'Partial' && ` (${formatCurrency(adjustedRemaining)})`}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/invoices/${invoice._id}`}
                                    className="p-1.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                  >
                                    View
                                  </Link>
                                  {invoice.status !== 'Cancelled' && (paymentStatus === 'Unpaid' || paymentStatus === 'Partial') && (
                                    <button
                                      onClick={() => handleRecordPayment(invoice)}
                                      className="p-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
                                    >
                                      Pay
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </div>
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
                {/* Consolidate Payments */}
                {summary.paymentCount + summary.manualEntryCount === 0 ? (
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
                    {summary.balance > 0 && (
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
                  <div className={isDesktop ? "glass-card overflow-x-auto" : ""}>
                    {isDesktop && (
                      <div className={`grid ${isAdmin ? 'grid-cols-[minmax(180px,2fr)_125px_120px_130px_150px_100px]' : 'grid-cols-[minmax(180px,2fr)_125px_120px_130px_150px]'} min-w-[800px] items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 bg-slate-800/50`}>
                        <div>Reference / Invoice</div>
                        <div>Date</div>
                        <div>Method</div>
                        <div>Amount</div>
                        <div>Type</div>
                        {isAdmin && <div className="text-center">Actions</div>}
                      </div>
                    )}
                    
                    <div className={!isDesktop ? "space-y-3" : ""}>
                      <InfiniteVirtualizedList
                        queryKey={['customer-payments', id]}
                        queryFn={({ pageParam = 1 }) => getPaymentsByCustomer(id, { page: pageParam, limit: 20 })}
                        estimateSize={() => isDesktop ? 65 : 160}
                        getKey={(payment) => payment._id}
                        className={isDesktop ? "min-h-[65px]" : "min-h-[160px]"}
                        itemClassName={isDesktop ? "" : "mb-3"}
                        renderItem={(payment, index) => {
                          if (isDesktop) {
                            return (
                              <div className={`grid ${isAdmin ? 'grid-cols-[minmax(180px,2fr)_125px_120px_130px_150px_100px]' : 'grid-cols-[minmax(180px,2fr)_125px_120px_130px_150px]'} min-w-[800px] items-center px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                  <Link to={`/invoices/${payment.invoice?._id || payment.invoiceId}`} className="text-white font-medium hover:underline hover:text-blue-400 transition-colors truncate">
                                    {payment.invoice?.invoiceNumber || payment.invoiceNumber || 'Unknown'}
                                  </Link>
                                  {payment.reference && (
                                    <span className="text-xs text-slate-500 ml-1 truncate">({payment.reference})</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                  <Calendar className="w-4 h-4 text-slate-500" />
                                  {formatDate(payment.paymentDate || payment.date)}
                                </div>
                                <div>
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-slate-600 bg-slate-700/50 text-slate-300">
                                    <CreditCard className="w-3 h-3" />
                                    {payment.paymentMethod || payment.method}
                                  </span>
                                </div>
                                <div className="text-emerald-400 font-medium">
                                  {formatCurrency(payment.amount)}
                                </div>
                                <div>
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                    <FileText className="w-3 h-3" />
                                    Invoice Payment
                                  </span>
                                </div>
                                {isAdmin && (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingPayment(payment);
                                        setShowEditPaymentModal(true);
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                                      title="Edit"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm(`Delete payment of ${formatCurrency(payment.amount)} against ${payment.invoice?.invoiceNumber || payment.invoiceNumber}? This will be reversed.`)) return;
                                        setDeletingPaymentId(payment._id);
                                        try {
                                          await deletePayment(payment._id);
                                          success('Payment deleted and reversed');
                                          handlePaymentSuccess();
                                        } catch (err) {
                                          error(err.response?.data?.message || 'Failed to delete payment');
                                        } finally {
                                          setDeletingPaymentId(null);
                                        }
                                      }}
                                      disabled={deletingPaymentId === payment._id}
                                      className={`p-1.5 rounded-lg text-slate-400 transition-colors ${
                                        deletingPaymentId === payment._id ? 'opacity-50 cursor-wait' : 'hover:bg-red-500/20 hover:text-red-400'
                                      }`}
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          // Mobile view for payment
                          return (
                            <div className="p-4 rounded-xl border bg-slate-800/50 border-slate-700/50 flex flex-col gap-3 relative overflow-hidden transition-colors">
                              <div className="flex items-center justify-between">
                                <Link 
                                  to={`/invoices/${payment.invoice?._id || payment.invoiceId}`}
                                  className="font-medium flex items-center gap-2 text-white hover:text-blue-400"
                                >
                                  <FileText className="w-4 h-4 text-blue-400" />
                                  {payment.invoice?.invoiceNumber || payment.invoiceNumber}
                                </Link>
                                <span className="font-medium text-emerald-400">
                                  {formatCurrency(payment.amount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm text-slate-400">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {formatDate(payment.paymentDate || payment.date)}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <CreditCard className="w-3.5 h-3.5" />
                                  {payment.paymentMethod || payment.method}
                                </div>
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-700/50 justify-end">
                                    <button
                                      onClick={() => {
                                        setEditingPayment(payment);
                                        setShowEditPaymentModal(true);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-700/30 hover:bg-blue-500/10 rounded-lg transition-colors"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm(`Delete payment of ${formatCurrency(payment.amount)}?`)) return;
                                        setDeletingPaymentId(payment._id);
                                        try {
                                          await deletePayment(payment._id);
                                          success('Payment deleted');
                                          handlePaymentSuccess();
                                        } catch (err) {
                                          error(err.response?.data?.message || 'Failed to delete payment');
                                        } finally {
                                          setDeletingPaymentId(null);
                                        }
                                      }}
                                      disabled={deletingPaymentId === payment._id}
                                      className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-700/30 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                    </div>

                  </div>
                )}
              </motion.div>
            )}

            {/* Ledger Tab - Full Financial History */}
            {activeTab === 'ledger' && (
              <motion.div
                key="ledger"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {ledgerLoading ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm text-slate-400">Loading ledger...</p>
                  </div>
                ) : ledgerData.ledger.length === 0 ? (
                  <div className="text-center py-12">
                    <motion.div
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                    >
                      <BookOpen className="w-8 h-8 text-slate-400" />
                    </motion.div>
                    <motion.p
                      className="text-slate-400"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      No transactions found for this customer
                    </motion.p>
                  </div>
                ) : (
                  <>
                    {/* Ledger Actions + Summary Cards */}
                    {ledgerData.summary && (
                      <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-amber-500/20">
                          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Debit</p>
                          <p className="text-xl font-bold text-amber-400">{formatCurrency(ledgerData.summary.totalDebit)}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-emerald-500/20">
                          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Credit</p>
                          <p className="text-xl font-bold text-emerald-400">{formatCurrency(ledgerData.summary.totalCredit)}</p>
                        </div>
                        <div className={`p-4 rounded-xl bg-slate-800/50 border ${ledgerData.summary.closingBalance > 0 ? 'border-red-500/20' : 'border-emerald-500/20'}`}>
                          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Closing Balance</p>
                          <p className={`text-xl font-bold ${ledgerData.summary.closingBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {formatCurrency(Math.abs(ledgerData.summary.closingBalance))}
                            <span className="text-xs ml-1 font-normal">{ledgerData.summary.closingBalance > 0 ? 'Due' : ledgerData.summary.closingBalance < 0 ? 'Advance' : ''}</span>
                          </p>
                        </div>
                      </div>
                      </>
                    )}

                    {/* Descending Sort Banner */}
                    {ledgerFilters.sortOrder === 'desc' && ledgerData.summary && (
                      <div className="bg-slate-800/80 p-3 sm:p-4 rounded-xl border-l-4 border-l-blue-500 mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 shadow-lg">
                        <span className="text-slate-400 font-medium text-sm">Closing Balance (As of {formatDate(ledgerFilters.endDate || new Date())})</span>
                        <span className={`text-lg sm:text-xl font-bold ${ledgerData.summary.closingBalance > 0 ? 'text-red-400' : ledgerData.summary.closingBalance < 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
                          {formatCurrency(Math.abs(ledgerData.summary.closingBalance))}
                          <span className="text-sm font-normal ml-1">
                            {ledgerData.summary.closingBalance > 0 ? 'Dr' : ledgerData.summary.closingBalance < 0 ? 'Cr' : ''}
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Ledger Table – desktop (1024px+) */}
                    <div className="hidden lg:block table-container bg-slate-800/50 rounded-xl overflow-hidden">
                      <table className="table">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="w-28">Date</th>
                            <th className="w-32">Type</th>
                            <th className="w-28">Ref #</th>
                            <th className="w-24 text-right">Mode</th>
                            <th>Description</th>
                            <th className="text-right w-28">Debit (₹)</th>
                            <th className="text-right w-28">Credit (₹)</th>
                            <th className="text-right w-32">Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerData.ledger.map((entry, index) => {
                            const config = ledgerTypeConfig[entry.type] || { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: FileText };
                            const TypeIcon = config.icon;
                            let refLink = null;
                            if (entry.linkType === 'invoice') refLink = `/invoices/${entry.linkId}`;
                            else if (entry.linkType === 'creditNote') refLink = `/credit-notes/${entry.linkId}`;

                            return (
                              <motion.tr
                                key={`${entry.linkType}-${entry.linkId}-${index}`}
                                custom={index}
                                variants={tableRowVariants}
                                initial="hidden"
                                animate="visible"
                                className="hover:bg-slate-700/30 transition-colors"
                              >
                                <td className="text-slate-300 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                    {formatDate(entry.date)}
                                  </div>
                                </td>
                                <td>
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${config.color}`}>
                                    <TypeIcon className="w-3 h-3" />
                                    {entry.type}
                                  </span>
                                </td>
                                <td className="font-medium text-white">
                                  {refLink ? (
                                    <Link to={refLink} className="hover:text-blue-400 hover:underline transition-colors">{entry.ref}</Link>
                                  ) : (
                                    <span className="text-slate-300">{entry.ref}</span>
                                  )}
                                </td>
                                <td className="text-right">
                                  {entry.mode && entry.mode !== '-' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/50 text-slate-300 border border-slate-600">{entry.mode}</span>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="text-slate-400 text-sm max-w-[200px] truncate" title={entry.description}>{entry.description}</td>
                                <td className="text-right font-medium">
                                  {entry.debit > 0 ? <span className="text-amber-400">{formatCurrency(entry.debit)}</span> : <span className="text-slate-600">—</span>}
                                </td>
                                <td className="text-right font-medium">
                                  {entry.credit > 0 ? <span className="text-emerald-400">{formatCurrency(entry.credit)}</span> : <span className="text-slate-600">—</span>}
                                </td>
                                <td className={`text-right font-semibold ${entry.balance > 0 ? 'text-red-400' : entry.balance < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                  {formatCurrency(Math.abs(entry.balance))}
                                  {entry.balance > 0 && <span className="text-[10px] ml-1 opacity-70">(Dr)</span>}
                                  {entry.balance < 0 && <span className="text-[10px] ml-1 opacity-70">(Cr)</span>}
                                </td>
                              </motion.tr>
                            );
                          })}
                          {/* Closing Balance row – desktop */}
                          {ledgerData.summary && (
                            <tr className="bg-slate-800/80 border-t border-slate-600">
                              <td colSpan={5} className="text-right font-bold text-white uppercase text-sm py-4">Closing Balance:</td>
                              <td className="text-right font-bold text-amber-400 py-4 opacity-50">{formatCurrency(ledgerData.summary.totalDebit)}</td>
                              <td className="text-right font-bold text-emerald-400 py-4 opacity-50">{formatCurrency(ledgerData.summary.totalCredit)}</td>
                              <td className={`text-right font-bold py-4 text-base ${ledgerData.summary.closingBalance > 0 ? 'text-white' : ledgerData.summary.closingBalance < 0 ? 'text-white' : 'text-slate-300'}`}>
                                {formatCurrency(Math.abs(ledgerData.summary.closingBalance))}
                                {ledgerData.summary.closingBalance > 0 && <span className="text-xs ml-1.5 text-red-400">(Dr)</span>}
                                {ledgerData.summary.closingBalance < 0 && <span className="text-xs ml-1.5 text-emerald-400">(Cr)</span>}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Ledger Card List – below lg (< 1024px) */}
                    <div className="lg:hidden space-y-2">
                      {ledgerData.ledger.map((entry, index) => {
                        const config = ledgerTypeConfig[entry.type] || { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: FileText };
                        const TypeIcon = config.icon;
                        let refLink = null;
                        if (entry.linkType === 'invoice') refLink = `/invoices/${entry.linkId}`;
                        else if (entry.linkType === 'creditNote') refLink = `/credit-notes/${entry.linkId}`;

                        return (
                          <motion.div
                            key={`m-${entry.linkType}-${entry.linkId}-${index}`}
                            custom={index}
                            variants={tableRowVariants}
                            initial="hidden"
                            animate="visible"
                            className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50"
                          >
                            {/* Row 1: date + type badge + balance */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                {formatDate(entry.date)}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${config.color}`}>
                                  <TypeIcon className="w-3 h-3" />
                                  {entry.type}
                                </span>
                              </div>
                            </div>
                            {/* Row 2: ref + mode */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="font-medium text-sm">
                                {refLink ? (
                                  <Link to={refLink} className="text-blue-400 hover:underline">{entry.ref}</Link>
                                ) : (
                                  <span className="text-slate-300">{entry.ref}</span>
                                )}
                              </div>
                              {entry.mode && entry.mode !== '-' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/50 text-slate-300 border border-slate-600">{entry.mode}</span>
                              )}
                            </div>
                            {/* Row 3: description */}
                            {entry.description && (
                              <p className="text-xs text-slate-500 mb-2 truncate" title={entry.description}>{entry.description}</p>
                            )}
                            {/* Row 4: debit / credit / balance */}
                            <div className="grid grid-cols-3 gap-1 text-center pt-2 border-t border-slate-700/50">
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase mb-0.5">Debit</p>
                                <p className="text-xs font-semibold">
                                  {entry.debit > 0 ? <span className="text-amber-400">{formatCurrency(entry.debit)}</span> : <span className="text-slate-600">—</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase mb-0.5">Credit</p>
                                <p className="text-xs font-semibold">
                                  {entry.credit > 0 ? <span className="text-emerald-400">{formatCurrency(entry.credit)}</span> : <span className="text-slate-600">—</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase mb-0.5">Balance</p>
                                <p className={`text-xs font-bold ${entry.balance > 0 ? 'text-red-400' : entry.balance < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                  {formatCurrency(Math.abs(entry.balance))}
                                  {entry.balance > 0 && <span className="text-[9px] ml-0.5">(Dr)</span>}
                                  {entry.balance < 0 && <span className="text-[9px] ml-0.5">(Cr)</span>}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                      {/* Closing Balance card – mobile */}
                      {ledgerData.summary && (
                        <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-600 border-t-2">
                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase mb-0.5">Total Debit</p>
                              <p className="text-xs font-bold text-amber-400 opacity-70">{formatCurrency(ledgerData.summary.totalDebit)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase mb-0.5">Total Credit</p>
                              <p className="text-xs font-bold text-emerald-400 opacity-70">{formatCurrency(ledgerData.summary.totalCredit)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase mb-0.5">Closing Bal.</p>
                              <p className={`text-xs font-bold ${ledgerData.summary.closingBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {formatCurrency(Math.abs(ledgerData.summary.closingBalance))}
                                {ledgerData.summary.closingBalance > 0 && <span className="text-[9px] ml-0.5">(Dr)</span>}
                                {ledgerData.summary.closingBalance < 0 && <span className="text-[9px] ml-0.5">(Cr)</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pagination Controls */}
                    {(ledgerFilters.offset > 0 || ledgerMeta.hasMore) && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-800/50 p-3 sm:p-4 rounded-xl mt-4 border border-slate-700 gap-2">
                        <span className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
                          Showing {ledgerFilters.offset + 1}–{Math.min(ledgerFilters.offset + ledgerFilters.limit, ledgerMeta.totalCount)} of {ledgerMeta.totalCount}
                        </span>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setLedgerFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
                            disabled={ledgerFilters.offset === 0}
                            className={`btn btn-sm flex-1 sm:flex-none ${ledgerFilters.offset === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'btn-secondary'}`}
                          >
                            ← Previous
                          </button>
                          <button
                            onClick={() => setLedgerFilters(f => ({ ...f, offset: f.offset + f.limit }))}
                            disabled={!ledgerMeta.hasMore}
                            className={`btn btn-sm flex-1 sm:flex-none ${!ledgerMeta.hasMore ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'btn-secondary'}`}
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
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
        invoices={unpaidData?.invoices || []}
        manualEntries={unpaidData?.entries || []}
        preSelectedInvoice={selectedInvoice}
        creditNotes={unpaidData?.creditNotes || []}
      />

      {/* Edit Payment Modal */}
      <EditPaymentModal
        isOpen={showEditPaymentModal}
        onClose={() => {
          setShowEditPaymentModal(false);
          setEditingPayment(null);
        }}
        onSuccess={() => {
          success('Payment updated successfully');
          handlePaymentSuccess();
        }}
        payment={editingPayment}
        creditNotes={unpaidData?.creditNotes || []}
      />

      {/* Printable Ledger Preview (visible on screen + used for print) */}
      {ledgerData.ledger.length > 0 && customer && activeTab === 'ledger' && (
        <>
          {/* Desktop: full A4 preview — hidden below lg */}
          <div className="hidden lg:flex justify-center no-print-hide">
            <motion.div
              ref={ledgerPrintRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="invoice-print bg-white border-2 border-slate-300 shadow-lg"
              style={{ width: '210mm', maxWidth: '100%', fontSize: '11px', color: '#000000', margin: '0 auto', padding: '2mm' }}
            >
              <PrintLedgerContent
                admin={admin}
                customer={customer}
                ledgerData={ledgerData}
                formatDate={formatDate}
              />
            </motion.div>
          </div>

          {/* Mobile: collapsible print preview */}
          <MobilePrintPreview
            ledgerPrintRef={ledgerPrintRef}
            admin={admin}
            customer={customer}
            ledgerData={ledgerData}
            formatDate={formatDate}
          />
        </>
      )}


      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
        onSuccess={() => {
          setShowManualEntryModal(false);
          handlePaymentSuccess();
        }}
        preSelectedCustomer={customer}
      />
    </>
  );
}
