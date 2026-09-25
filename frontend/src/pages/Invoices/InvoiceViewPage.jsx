import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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


const getBatchGroups = (allocations) => {
  const groupsMap = allocations.reduce((acc, alloc) => {
    const displayName = alloc.batchNo && alloc.batchNo !== 'UNNAMED' ? alloc.batchNo : 'No Batch #';
    const expiryStr = alloc.expiryDate 
      ? new Date(alloc.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) 
      : '-';
    
    const key = `${displayName}|${expiryStr}`;
    if (!acc[key]) {
      acc[key] = { name: displayName, expiry: expiryStr, qtys: [] };
    }
    acc[key].qtys.push(alloc.quantity);
    return acc;
  }, {});
  return Object.values(groupsMap);
};

export default function InvoiceViewPage() {
  const { id } = useParams();
  const [updating, setUpdating] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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

  const [isSingleCopy, setIsSingleCopy] = useState(() => {
    try {
      return localStorage.getItem('invoiceCopyMode') === 'single';
    } catch {
      return false;
    }
  });
  const printRef = useRef();
  const { success, error } = useToast();
  const [copiedShare, setCopiedShare] = useState(false);
  const isFirstVisit = useFirstVisit('invoice-view');

  const { user, admin, updateUserPreferences } = useAuth();
  const enableBatchTracking = user?.preferences?.enableBatchTracking === true;

  // Column definitions
  const ALL_COLUMNS = [
    { key: 'qty', label: 'Qty', width: '4%', align: 'center', render: (item) => item.quantitySold ?? item.quantity ?? 0 },
    { key: 'free', label: 'Fr', width: '3%', align: 'center', render: (item) => item.freeQuantity || 0 },
    { key: 'productName', label: 'Product Name', width: '33%', align: 'left', render: (item) => item.product?.productName ?? item.productName ?? item.name ?? '-' },
    { key: 'hsn', label: 'HSN', width: '7%', align: 'center', render: (item) => item.product?.hsnCode ?? item.hsnCode ?? '-' },
    { key: 'batchNo', label: 'Batch', width: '10%', align: 'center', render: (item) => {
        if (enableBatchTracking && item.batchAllocations?.length > 0) {
          const groups = getBatchGroups(item.batchAllocations);

          return (
            <div className="flex flex-col gap-0.5">
              {groups.map((g, idx) => {
                const displayQty = g.name === 'No Batch #' ? g.qtys.join('+') : g.qtys.reduce((sum, q) => sum + q, 0);
                return (
                  <span key={idx} className="whitespace-nowrap">
                    {g.name} ({displayQty})
                  </span>
                );
              })}
            </div>
          );
        }
        const bNo = item.product?.batchNo ?? item.batchNumber ?? item.batchNo;
        return bNo && bNo !== 'UNNAMED' ? bNo : 'No Batch #';
    }},
    { key: 'expiry', label: 'Expiry', width: '7%', align: 'center', render: (item) => {
        if (enableBatchTracking && item.batchAllocations?.length > 0) {
          const groups = getBatchGroups(item.batchAllocations);
          return (
            <div className="flex flex-col gap-0.5">
              {groups.map((g, idx) => (
                <span key={idx} className="whitespace-nowrap">{g.expiry}</span>
              ))}
            </div>
          );
        }
        const expiryRaw = item.product?.expiryDate ?? item.expiryDate ?? null;
        return expiryRaw ? new Date(expiryRaw).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '-';
    }},
    { key: 'mrp', label: 'MRP', width: '8%', align: 'right', render: (item) => (item.product?.newMRP ?? item.mrp ?? item.newMRP)?.toFixed(2) ?? '-' },
    { key: 'rate', label: 'Rate', width: '7%', align: 'right', render: (item) => ((item.ratePerUnit ?? item.rate) || 0).toFixed(2) },
    { key: 'net', label: 'Net', width: '7%', align: 'right', render: (item) => { const rate = (item.ratePerUnit ?? item.rate) || 0; const gst = item.product?.gstPercentage ?? item.gstPercentage ?? item.gstRate ?? 0; return (rate * (1 + gst / 100)).toFixed(2); } },
    { key: 'disc', label: 'Disc%', width: '5%', align: 'center', render: (item) => `${item.schemeDiscount ?? item.discountPercentage ?? 0}%` },
    { key: 'gst', label: 'GST%', width: '4%', align: 'center', render: (item) => `${item.product?.gstPercentage ?? item.gstPercentage ?? item.gstRate ?? 0}%` },
    { key: 'amount', label: 'Amount', width: '9%', align: 'right', render: (item) => { const qty = item.quantitySold ?? item.quantity ?? 0; const rate = (item.ratePerUnit ?? item.rate) || 0; return (item.totalAmount != null ? item.totalAmount : qty * rate).toFixed(2); } },
  ];

  const DEFAULT_INVOICE_COLUMNS = [
    'qty', 'free', 'productName', 'hsn', 'batchNo',
    'expiry', 'mrp', 'rate', 'net', 'disc',
    'gst', 'amount'
  ];

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

  const activeColumns = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key));

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
      const [customerData, entriesData, cnData] = await Promise.all([
        customerService.getCustomer(customerId, true, { params: { includeInvoices: 'true' } }),
        manualEntryService.getManualEntriesByCustomer(customerId).catch(() => ({ manualEntries: [] })),
        creditNoteService.getCreditNotesByCustomer(customerId).catch(() => ({ creditNotes: [] }))
      ]);

      const customerInvoices = customerData?.invoices || [];
      const manualEntries = entriesData?.manualEntries || [];
      const customerCreditNotes = cnData?.creditNotes || [];

      const invoiceOutstanding = customerInvoices.reduce((sum, inv) => {
        if (inv.status === 'Cancelled') return sum;
        const remaining = (inv.totals?.netTotal || 0) - (inv.paidAmount || 0);
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);

      const manualEntryOutstanding = manualEntries.reduce((sum, entry) => {
        if (entry.entryType === 'opening_balance' && entry.paymentType === 'Credit') {
          const remaining = entry.amount - (entry.paidAmount || 0);
          return sum + remaining;
        }
        return sum;
      }, 0);

      // Subtract credit note totals
      const creditNoteTotal = customerCreditNotes.reduce(
        (sum, cn) => sum + (cn.totals?.netTotal || 0), 0
      );

      return Math.max(0, invoiceOutstanding + manualEntryOutstanding - creditNoteTotal);
    } catch (e) {
      console.warn('Failed calculating outstanding', e);
      return 0;
    }
  };

  const { data: customerOutstanding = 0 } = useSWR(
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


  const handlePrint = () => {
    window.print();
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
    window.print();
  };

  const handleShare = async () => {
    if (!invoice) return;
    const invNumber = invoice.invoiceNumber || 'Invoice';
    const custName = invoice.customer?.name || 'Customer';
    const grandTotal = (invoice.grandTotal !== undefined && invoice.grandTotal !== null)
      ? invoice.grandTotal
      : (invoice.totalAmount || 0);
    const formattedTotal = formatCurrency(grandTotal);
    const shareUrl = window.location.href;
    const shareText = `Invoice #${invNumber} for ${custName} — Total: ${formattedTotal}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${invNumber}`,
          text: `${shareText}\n${shareUrl}`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Clipboard copy
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedShare(true);
      success('Invoice link copied to clipboard!');
      setTimeout(() => setCopiedShare(false), 2500);
    } catch (err) {
      console.error('Failed to copy share link:', err);
      error('Failed to copy share link to clipboard');
    }
  };

  const toggleCopyMode = () => {
    setIsSingleCopy((prev) => {
      const next = !prev;
      localStorage.setItem('invoiceCopyMode', next ? 'single' : 'double');
      return next;
    });
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
    await Promise.all([
      mutateInvoice(),
      mutateCN()
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
        <Link to="/invoices" className="btn btn-primary inline-flex items-center gap-2">
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

  // Reusable Invoice Copy Component
  const InvoiceCopy = () => (
    <div
      className="invoice-copy bg-white flex flex-col"
      style={{
        width: '100%',
        minHeight: '130mm',
        fontSize: '12px',
        color: '#000000',
        padding: '4mm',
        boxSizing: 'border-box'
      }}
    >
      {/* Main content wrapper */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="grid grid-cols-2 gap-2 border-b border-black pb-1 mb-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid black', paddingBottom: '4px', marginBottom: '4px' }}>
          <div className="text-left">
            <h1 className="font-bold mb-0.5" style={{ fontSize: '18px', margin: 0 }}>{admin?.firmName || invoice.distributor?.firmName || 'BHARAT ENTERPRISES'}</h1>
            <p className="text-[11px] leading-tight" style={{ margin: '2px 0 0 0' }}>{admin?.firmAddress || invoice.distributor?.firmAddress || 'Address Line 1, City, State - PIN'}</p>
          </div>
          <div className="flex justify-end text-[11px] leading-tight" style={{ display: 'flex', justifyContent: 'flex-end', textAlign: 'right' }}>
            {invoice.distributor?.paymentInformation?.enabled && (
              <div className="text-left border-l border-r border-black px-2 mr-2" style={{ borderLeft: '1px solid black', borderRight: '1px solid black', padding: '0 8px', marginRight: '8px', textAlign: 'left' }}>
                <p style={{ margin: '1px 0' }}>UPI: {invoice.distributor.paymentInformation.upiId}</p>
                <p style={{ margin: '1px 0' }}>A/C: {invoice.distributor.paymentInformation.accountNumber}</p>
                <p style={{ margin: '1px 0' }}>IFSC: {invoice.distributor.paymentInformation.ifscCode}</p>
              </div>
            )}
            <div className="text-left" style={{ textAlign: 'left' }}>
              <p style={{ margin: '1px 0' }}>Phone: {admin?.firmPhone || invoice.distributor?.firmPhone || 'XXXXXXXXXX'}</p>
              <p style={{ margin: '1px 0' }}>DL No: {admin?.firmDL || invoice.distributor?.firmDL || user?.firmDL || 'XXXXXXXXXX'}</p>
              <p style={{ margin: '1px 0' }}>GSTIN: {admin?.firmGSTIN || invoice.distributor?.firmGSTIN || 'XXXXXXXXXXXX'}</p>
            </div>
          </div>
        </div>

        {/* Buyer & Invoice Details */}
        <div className="grid grid-cols-3 gap-2 mb-1 text-[11px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '4px' }}>
          <div>
            <p className="font-bold mb-0.5">M/s {invoice.customer?.customerName}</p>
            <p className="leading-tight">{invoice.customer?.address || 'Address not provided'}</p>
            <p className="mt-0.5">Ph: {invoice.customer?.phone}</p>
          </div>
          <div className="border-l border-black pl-2" style={{ borderLeft: '1px solid black', paddingLeft: '8px' }}>
            {invoice.customer?.gstin && <p>GSTIN: {invoice.customer.gstin}</p>}
            {invoice.customer?.dlNo && <p>DL No: {invoice.customer.dlNo}</p>}
          </div>
          <div className="text-right" style={{ textAlign: 'right' }}>
            <p className="font-bold">Invoice No: {invoice.invoiceNumber}</p>
            <p><span className="font-bold">Date:</span> {formatDate(invoice.invoiceDate)}</p>
            <p><span className="font-bold">Bill Type:</span> {invoice.paymentType?.toUpperCase() || 'CREDIT'}</p>
          </div>
        </div>

        {/* Products Table */}
        <div className="mb-1">
          <table className="w-full border-collapse text-[9px]" style={{ border: '0.5px solid black' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid black' }}>
                {activeColumns.map((col, i) => (
                  <th key={col.key} className={`${i < activeColumns.length - 1 ? 'border-r border-black' : ''} p-0.5 font-bold text-${col.align}`} style={{ width: col.width }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => (
                <tr key={index} style={{ borderBottom: index < invoice.items.length - 1 ? '0.5px solid #ddd' : 'none' }}>
                  {activeColumns.map((col, i) => (
                    <td key={col.key} className={`${i < activeColumns.length - 1 ? 'border-r border-black' : ''} p-0.5 font-bold text-${col.align}`}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary and Footer */}
      <div className="mt-auto">
        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="text-[11px]">
            <p className="font-bold">Current Dues: ₹{Math.round(customerOutstanding)}</p>
            <div className="border-t border-black mt-1 pt-0.5">
              <p className="font-bold mb-0.5">Amount in Words:</p>
              <p className="uppercase">{invoice.totals?.amountInWords || 'Rupees Zero Only'}</p>
            </div>
          </div>
          <div className="text-[11px]">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-0">Taxable:</td>
                  <td className="text-right font-semibold">₹{invoice.totals?.totalTaxable?.toFixed(2)}</td>
                </tr>
                {invoice.totals?.totalDiscount > 0 && (
                  <tr>
                    <td className="py-0">Discount:</td>
                    <td className="text-right" style={{ color: '#dc2626' }}>-₹{invoice.totals?.totalDiscount?.toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-0">CGST:</td>
                  <td className="text-right">₹{invoice.totals?.totalCGST?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">SGST:</td>
                  <td className="text-right">₹{invoice.totals?.totalSGST?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">Round Off:</td>
                  <td className="text-right">
                    {(() => {
                      const net = invoice.totals?.netTotal || 0;
                      const rounded = Math.round(net);
                      const diff = rounded - net;
                      return diff >= 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`;
                    })()}
                  </td>
                </tr>
                <tr className="border-t border-black">
                  <td className="py-0.5 font-bold">NET:</td>
                  <td className="text-right font-bold text-[13px]">₹{Math.round(invoice.totals?.netTotal || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-black pt-1 text-[11px]">
          <div className="flex justify-between items-end">
            <div>
              <p>E & O E</p>
            </div>
            <div className="text-center">
              <div className="h-6"></div>
              <p className="border-t border-black pt-0.5">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
                to="/invoices"
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
                  onClick={() => { if (!isSingleCopy) toggleCopyMode(); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isSingleCopy
                      ? 'bg-slate-800 text-slate-100 shadow-xs border border-slate-700/80'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Print single copy"
                >
                  1x Single
                </button>
                <button
                  type="button"
                  onClick={() => { if (isSingleCopy) toggleCopyMode(); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    !isSingleCopy
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Print customer and business copies"
                >
                  2x Double
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
                  <span className="pointer-events-none px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {visibleColumns.length}/{ALL_COLUMNS.length}
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

              <button
                type="button"
                onClick={handleShare}
                className="btn btn-secondary flex items-center gap-1.5 py-1.5 px-2.5 text-xs font-medium hover:text-slate-100 border-slate-700/70"
                title="Share invoice link"
              >
                {copiedShare ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copiedShare ? 'Copied' : 'Share'}</span>
              </button>

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

        {/* Invoice Print Area */}
        <div className="flex justify-center">
          <motion.div
            ref={printRef}
            variants={cardVariants}
            className="invoice-print bg-white border-2 border-slate-300 shadow-lg"
            style={{
              width: '190mm',
              fontSize: '10px',
              color: '#000000',
              margin: '0 auto',
              padding: '2mm'
            }}
          >
            <InvoiceCopy />

            {!isSingleCopy && (
              <>
                <div className="flex items-center my-2" style={{ borderTop: '1px dashed #000' }}>
                  <span className="text-[9px] text-gray-600 mx-auto bg-white px-2" style={{ marginTop: '-10px' }}>
                    Cut Here
                  </span>
                </div>
                <InvoiceCopy />
              </>
            )}
          </motion.div>
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
    </>
  );
}
