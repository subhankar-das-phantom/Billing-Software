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
import { customerService } from '../services/customerService';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { getPaymentsByCustomer, getPaymentStatusColor, deletePayment } from '../services/creditService';
import { manualEntryService, deleteManualEntry, updateManualEntry } from '../services/manualEntryService';
import { formatCurrency, formatDate, formatPhone } from '../utils/formatters';
import { CUSTOMER_THEMES, getCustomerTheme } from '../utils/customerTheme';
import { PageLoader } from '../components/Common/Loader';
import RecordPaymentModal from '../components/Common/RecordPaymentModal';
import EditPaymentModal from '../components/Common/EditPaymentModal';
import ManualEntryModal from '../components/ManualEntry/ManualEntryModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { invalidateCachePattern, useMotionConfig } from '../hooks';

const LARGE_ROW_THRESHOLD = 20;

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
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [manualEntries, setManualEntries] = useState([]);
  const [loading, setLoading] = useState(true);
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


  useEffect(() => {
    loadCustomer();
    setLedgerData({ ledger: [], summary: null });
  }, [id]);

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

  const loadCustomer = async (bypassCache = false) => {
    try {
      // When bypassCache=true, pass useCache=false to get fresh data
      const [customerData, paymentsData, entriesData] = await Promise.all([
        customerService.getCustomer(id, !bypassCache),
        getPaymentsByCustomer(id).catch(() => ({ payments: [] })),
        manualEntryService.getManualEntriesByCustomer(id).catch(() => ({ manualEntries: [] }))
      ]);
      setCustomer(customerData.customer);
      setInvoices(customerData.invoices || []);
      setPayments(paymentsData.payments || []);
      setManualEntries(entriesData.manualEntries || []);
    } catch (error) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Invalidate cache for all tabs so payment shows everywhere
    invalidateCachePattern('customers');
    invalidateCachePattern('invoices');
    invalidateCachePattern('dashboard');
    invalidateCachePattern('credits'); // Credit reports need refresh
    // Bypass cache to get fresh data after payment
    await loadCustomer(true);
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
        customerName: customer.customerName || '',
        address: customer.address || '',
        phone: customer.phone || '',
        email: customer.email || '',
        gstin: customer.gstin || '',
        dlNo: customer.dlNo || '',
        customerCode: customer.customerCode || '',
        theme: themeId
      });
      setCustomer(prev => ({ ...prev, theme: themeId }));
      invalidateCachePattern('customers');
      success('Customer theme updated');
    } catch (err) {
      console.error('Failed to update customer theme:', err);
      error('Failed to update customer theme');
    } finally {
      setThemeSaving(false);
    }
  };

  const unpaidInvoices = useMemo(() => invoices.filter(inv => {
    if (inv.status === 'Cancelled') return false;
    if (inv.paymentStatus === 'Paid') return false;

    const remaining = (inv.totals?.netTotal || 0) - (inv.paidAmount || 0);
    return remaining > 0;
  }), [invoices]);

  const invoiceOutstanding = useMemo(() => invoices.reduce((sum, inv) => {
    if (inv.status === 'Cancelled') return sum;
    const remaining = (inv.totals?.netTotal || 0) - (inv.paidAmount || 0);
    return sum + (remaining > 0 ? remaining : 0);
  }, 0), [invoices]);

  const manualEntryOutstanding = useMemo(() => manualEntries.reduce((sum, entry) => {
    if (entry.entryType === 'opening_balance' && entry.paymentType === 'Credit') {
      const remaining = entry.amount - (entry.paidAmount || 0);
      return sum + remaining;
    }
    return sum;
  }, 0), [manualEntries]);

  const calculatedOutstanding = invoiceOutstanding + manualEntryOutstanding;

  const rowCount = activeTab === 'invoices'
    ? invoices.length
    : activeTab === 'payments'
      ? payments.length + manualEntries.length
      : manualEntries.length;
  const denseRows = rowCount > LARGE_ROW_THRESHOLD;
  const shouldAnimateRows = motionConfig.shouldAnimate && !denseRows;

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

  const paymentAdjustments = useMemo(
    () => manualEntries.filter(e => e.entryType === 'payment_adjustment'),
    [manualEntries]
  );

  const openingBalanceWithDue = useMemo(
    () => manualEntries.some(e => e.entryType === 'opening_balance' && (e.amount - (e.paidAmount || 0)) > 0),
    [manualEntries]
  );

  const allPayments = useMemo(() => {
    const manualPayments = paymentAdjustments.map(e => ({
      _id: e._id,
      amount: e.amount,
      date: e.entryDate,
      method: e.paymentMethod || 'Manual',
      reference: 'Manual Payment',
      invoiceNumber: e.description || 'Opening Balance Payment',
      invoiceId: null,
      isManual: true,
      type: 'Manual Entry'
    }));

    const invoicePayments = payments.map(p => ({
      _id: p._id,
      amount: p.amount,
      date: p.paymentDate,
      method: p.paymentMethod,
      reference: p.referenceNumber,
      notes: p.notes || '',
      invoiceNumber: p.invoice?.invoiceNumber || 'Unknown Invoice',
      invoiceId: p.invoice?._id || null,
      invoiceTotal: p.invoice?.totals?.netTotal || 0,
      invoicePaidAmount: p.invoice?.paidAmount || 0,
      isManual: false,
      type: 'Invoice Payment'
    }));

    return [...invoicePayments, ...manualPayments]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [paymentAdjustments, payments]);

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
    { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.length + paymentAdjustments.length },
    { id: 'ledger', label: 'Ledger', icon: BookOpen, count: ledgerData.ledger.length || null },
  ];

  // Ledger type badge config
  const ledgerTypeConfig = {
    'Invoice': { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: ArrowUpRight },
    'Payment': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: ArrowDownLeft },
    'Credit Note': { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: ArrowDownLeft },
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
        initial="hidden"
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
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
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
        <div className="border-b border-slate-700">
          {/* Top row: tabs + non-ledger actions */}
          <div className="p-3 sm:p-5 flex items-center justify-between gap-3">
            {/* Tabs – scrollable pill bar on mobile */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
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
            <div className="flex gap-2 flex-shrink-0 items-center">
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
              {activeTab !== 'ledger' && (calculatedOutstanding > 0 || unpaidInvoices.length > 0) && (
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
                  <div className="table-container customer-invoices-container">
                    <table className="table customer-invoices-table">
                      <thead>
                        <motion.tr
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <th className="text-left">Invoice #</th>
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
                          const isCancelled = invoice.status === 'Cancelled';
                          
                          return (
                            <motion.tr
                              key={invoice._id}
                              custom={index}
                              variants={tableRowVariants}
                              initial="hidden"
                              animate="visible"
                              className={`transition-colors ${isCancelled ? 'bg-red-500/10' : ''}`}
                              whileHover={denseRows ? { backgroundColor: isCancelled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.5)' } : {
                                backgroundColor: isCancelled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                                x: 4
                              }}
                              transition={denseRows ? { duration: 0.12 } : { type: 'spring', stiffness: 400, damping: 25 }}
                            >
                              <td className={`font-medium ${isCancelled ? 'text-red-400' : 'text-white'}`}>
                                <div className="flex items-center gap-2">
                                  <FileText className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-blue-400'}`} />
                                  {invoice.invoiceNumber}
                                </div>
                              </td>
                              <td className={isCancelled ? 'text-red-400' : 'text-slate-300'}>
                                <div className="flex items-center gap-2">
                                  <Calendar className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                                  {formatDate(invoice.invoiceDate)}
                                </div>
                              </td>
                              <td className={isCancelled ? 'text-red-400' : 'text-slate-300'}>
                                <div className="flex items-center gap-2">
                                  <Package className={`w-4 h-4 ${isCancelled ? 'text-red-400' : 'text-slate-500'}`} />
                                  {invoice.items?.length || 0} items
                                </div>
                              </td>
                              <td className={`font-medium ${isCancelled ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                                {formatCurrency(invoice.totals?.netTotal)}
                              </td>
                              <td>
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
                                        Due: {formatCurrency(remaining)}
                                      </span>
                                    )}
                                  </div>
                                )}
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
                {/* Consolidate Payments */}
                {allPayments.length === 0 ? (
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
                    {(unpaidInvoices.length > 0 || openingBalanceWithDue) && (
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700 text-left">
                          <th className="pb-4 pl-4 font-medium text-slate-400">Reference / Invoice</th>
                          <th className="pb-4 font-medium text-slate-400">Date</th>
                          <th className="pb-4 font-medium text-slate-400">Method</th>
                          <th className="pb-4 font-medium text-slate-400">Amount</th>
                          <th className="pb-4 font-medium text-slate-400">Type</th>
                          {isAdmin && <th className="pb-4 font-medium text-slate-400 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {allPayments.map((payment) => (
                          <tr
                            key={payment._id}
                            className="hover:bg-slate-700/50 transition-colors"
                          >
                              <td className="py-4 pl-4 font-medium text-white">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-400" />
                                  {payment.isManual ? (
                                    <span className="text-slate-300">{payment.reference}</span>
                                  ) : (
                                    <Link to={`/invoices/${payment.invoiceId}`} className="hover:underline hover:text-blue-400 transition-colors">
                                      {payment.invoiceNumber}
                                    </Link>
                                  )}
                                  {payment.reference && !payment.isManual && (
                                    <span className="text-xs text-slate-500 ml-1">({payment.reference})</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 text-slate-300">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-500" />
                                  {formatDate(payment.date)}
                                </div>
                              </td>
                              <td className="py-4">
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-slate-600 bg-slate-700/50 text-slate-300">
                                  <CreditCard className="w-3 h-3" />
                                  {payment.method}
                                </span>
                              </td>
                              <td className="py-4 text-emerald-400 font-medium">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="py-4">
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                                  payment.isManual 
                                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                }`}>
                                  {payment.isManual ? <BookOpen className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                  {payment.type}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="py-4">
                                  {!payment.isManual ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <motion.button
                                        onClick={() => {
                                          setEditingPayment(payment);
                                          setShowEditPaymentModal(true);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        title="Edit Payment"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </motion.button>
                                      <motion.button
                                        onClick={async () => {
                                          if (!window.confirm(`Delete payment of ${formatCurrency(payment.amount)} against ${payment.invoiceNumber}? This will be reversed.`)) return;
                                          setDeletingPaymentId(payment._id);
                                          try {
                                            await deletePayment(payment._id);
                                            success('Payment deleted and reversed');
                                            invalidateCachePattern('customers');
                                            invalidateCachePattern('invoices');
                                            invalidateCachePattern('credits');
                                            invalidateCachePattern('dashboard');
                                            await loadCustomer(true);
                                          } catch (err) {
                                            error(err.response?.data?.message || 'Failed to delete payment');
                                          } finally {
                                            setDeletingPaymentId(null);
                                          }
                                        }}
                                        disabled={deletingPaymentId === payment._id}
                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        title="Delete Payment"
                                      >
                                        {deletingPaymentId === payment._id ? (
                                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <Trash2 className="w-4 h-4" />
                                        )}
                                      </motion.button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1">
                                      <motion.button
                                        onClick={() => {
                                          setEditingPayment({ ...payment, isManual: true });
                                          setShowEditPaymentModal(true);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        title="Edit Manual Entry"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </motion.button>
                                      <motion.button
                                        onClick={async () => {
                                          if (!window.confirm(`Delete manual entry of ${formatCurrency(payment.amount)}? This will be reversed.`)) return;
                                          setDeletingPaymentId(payment._id);
                                          try {
                                            await deleteManualEntry(payment._id);
                                            success('Manual entry deleted and reversed');
                                            invalidateCachePattern('customers');
                                            invalidateCachePattern('manual');
                                            invalidateCachePattern('dashboard');
                                            await loadCustomer(true);
                                          } catch (err) {
                                            error(err.response?.data?.message || 'Failed to delete manual entry');
                                          } finally {
                                            setDeletingPaymentId(null);
                                          }
                                        }}
                                        disabled={deletingPaymentId === payment._id}
                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        title="Delete Manual Entry"
                                      >
                                        {deletingPaymentId === payment._id ? (
                                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <Trash2 className="w-4 h-4" />
                                        )}
                                      </motion.button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                        ))}
                      </tbody>
                    </table>
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
        invoices={unpaidInvoices}
        manualEntries={manualEntries}
        preSelectedInvoice={selectedInvoice}
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
          invalidateCachePattern('customers');
          invalidateCachePattern('invoices');
          invalidateCachePattern('credits');
          invalidateCachePattern('dashboard');
          loadCustomer(true);
        }}
        payment={editingPayment}
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
          loadCustomer(true);
        }}
        preSelectedCustomer={customer}
      />
    </>
  );
}
