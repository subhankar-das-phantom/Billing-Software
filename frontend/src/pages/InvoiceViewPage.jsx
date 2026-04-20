import { useState, useEffect, useRef } from 'react';
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
  Check
} from 'lucide-react';
import { invoiceService } from '../services/invoiceService';
import { customerService } from '../services/customerService';
import { manualEntryService } from '../services/manualEntryService';
import { creditNoteService } from '../services/creditNoteService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import { useToast } from '../context/ToastContext';
import { useSWR, invalidateCachePattern } from '../hooks';
import RefreshIndicator from '../components/Common/RefreshIndicator';

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

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  })
};

export default function InvoiceViewPage() {
  const { id } = useParams();
  const [updating, setUpdating] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [isSingleCopy, setIsSingleCopy] = useState(() => {
    try {
      return localStorage.getItem('invoiceCopyMode') === 'single';
    } catch {
      return false;
    }
  });
  const printRef = useRef();
  const { success, error } = useToast();

  // Column definitions
  const ALL_COLUMNS = [
    { key: 'qty', label: 'Qty', width: '4%', align: 'center', render: (item) => item.quantitySold },
    { key: 'free', label: 'Fr', width: '3%', align: 'center', render: (item) => item.freeQuantity || 0 },
    { key: 'productName', label: 'Product Name', width: '33%', align: 'left', render: (item) => item.product?.productName },
    { key: 'hsn', label: 'HSN', width: '7%', align: 'center', render: (item) => item.product?.hsnCode },
    { key: 'batchNo', label: 'Batch', width: '7%', align: 'center', render: (item) => item.product?.batchNo || '-' },
    { key: 'expiry', label: 'Expiry', width: '7%', align: 'center', render: (item) => item.product?.expiryDate ? new Date(item.product.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '-' },
    { key: 'mrp', label: 'MRP', width: '8%', align: 'right', render: (item) => item.product?.newMRP?.toFixed(2) || '-' },
    { key: 'rate', label: 'Rate', width: '7%', align: 'right', render: (item) => item.ratePerUnit.toFixed(2) },
    { key: 'net', label: 'Net', width: '7%', align: 'right', render: (item) => (item.ratePerUnit * (1 + (item.product?.gstPercentage || 0) / 100)).toFixed(2) },
    { key: 'disc', label: 'Disc%', width: '5%', align: 'center', render: (item) => `${item.schemeDiscount || 0}%` },
    { key: 'gst', label: 'GST%', width: '4%', align: 'center', render: (item) => `${item.product?.gstPercentage}%` },
    { key: 'amount', label: 'Amount', width: '9%', align: 'right', render: (item) => (item.quantitySold * item.ratePerUnit).toFixed(2) },
  ];

  const DEFAULT_VISIBLE = ['qty', 'free', 'productName', 'hsn', 'mrp', 'rate', 'net', 'disc', 'gst', 'amount'];

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('invoiceColumns');
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch { return DEFAULT_VISIBLE; }
  });

  const toggleColumn = (key) => {
    setVisibleColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem('invoiceColumns', JSON.stringify(next));
      return next;
    });
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
  const creditNotes = creditNotesData?.creditNotes || [];
  
  // 3. Customer Outstanding Logic (using SWR)
  const customerId = invoice?.customer?._id;
  
  const fetchCustomerBalance = async () => {
    if (!customerId) return 0;
    try {
      const [customerData, entriesData] = await Promise.all([
        customerService.getCustomer(customerId),
        manualEntryService.getManualEntriesByCustomer(customerId).catch(() => ({ manualEntries: [] }))
      ]);
      
      const customerInvoices = customerData?.invoices || [];
      const manualEntries = entriesData?.manualEntries || [];
      
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
      
      return invoiceOutstanding + manualEntryOutstanding;
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
      
      // Set title for PDF filename: "Invoice_CustomerName_Date"
      document.title = `Invoice_${customerName}_${invoiceDate}`;
      
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
    } catch (err) {
      error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleDownload = () => {
    window.print();
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
    } catch (err) {
      error('Failed to cancel invoice');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <PageLoader />;
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
        <div className="grid grid-cols-2 gap-2 border-b border-black pb-1 mb-1">
          <div className="text-left">
            <h1 className="font-bold mb-0.5" style={{ fontSize: '18px' }}>{invoice.distributor?.firmName || 'BHARAT ENTERPRISES'}</h1>
            <p className="text-[11px] leading-tight">{invoice.distributor?.firmAddress || 'Address Line 1, City, State - PIN'}</p>
          </div>
          <div className="text-right text-[11px] leading-tight">
            <p>Phone: {invoice.distributor?.firmPhone || 'XXXXXXXXXX'}</p>
            <p>DL No: DL-XXXXX-XXXXX</p>
            <p>GSTIN: {invoice.distributor?.firmGSTIN || 'XXXXXXXXXXXX'}</p>
          </div>
        </div>

        {/* Buyer & Invoice Details */}
        <div className="grid grid-cols-3 gap-2 mb-1 text-[11px]">
          <div>
            <p className="font-bold mb-0.5">M/s {invoice.customer?.customerName}</p>
            <p className="leading-tight">{invoice.customer?.address || 'Address not provided'}</p>
            <p className="mt-0.5">Ph: {invoice.customer?.phone}</p>
          </div>
          <div className="border-l border-black pl-2">
            {invoice.customer?.gstin && <p>GSTIN: {invoice.customer.gstin}</p>}
            {invoice.customer?.dlNo && <p>DL No: {invoice.customer.dlNo}</p>}
          </div>
          <div className="text-right">
            <p><span className="font-bold">Invoice No:</span> {invoice.invoiceNumber}</p>
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
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
      {/* Actions Bar */}
      <motion.div
        variants={cardVariants}
        className="flex flex-wrap gap-3 no-print"
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link to="/invoices" className="btn btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            Back
          </Link>
        </motion.div>

        {/* Edit Button - only show for non-cancelled invoices */}
        {invoice.status !== 'Cancelled' && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to={`/invoices/${id}/edit`} className="btn btn-secondary flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit
            </Link>
          </motion.div>
        )}

        {/* Create Return / Credit Note - only for non-cancelled invoices */}
        {invoice.status !== 'Cancelled' && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to={`/invoices/${id}/return`} className="btn btn-secondary flex items-center gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
              <RotateCcw className="w-5 h-5" />
              Create Return
            </Link>
          </motion.div>
        )}

        <motion.button
          onClick={handlePrint}
          className="btn btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Printer className="w-5 h-5" />
          Print
        </motion.button>

        <motion.button
          onClick={toggleCopyMode}
          className="btn btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Switch between single and double print copies"
        >
          <FileText className="w-5 h-5" />
          {isSingleCopy ? 'Single Copy' : 'Double Copy'}
        </motion.button>

        <AnimatePresence mode="wait">
          {invoice.status === 'Created' && (
            <motion.button
              onClick={handleMarkPrinted}
              disabled={updating}
              className="btn btn-success flex items-center gap-2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              whileHover={{ scale: updating ? 1 : 1.05 }}
              whileTap={{ scale: updating ? 1 : 0.95 }}
            >
              {updating ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Clock className="w-5 h-5" />
                </motion.div>
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {updating ? 'Updating...' : 'Mark Printed'}
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          onClick={handleDownload}
          className="btn btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download className="w-5 h-5" />
          Download
        </motion.button>

        <motion.button
          className="btn btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Share2 className="w-5 h-5" />
          Share
        </motion.button>

        {/* Cancel Invoice Button */}
        <AnimatePresence>
          {invoice.status !== 'Cancelled' && (
            <motion.button
              onClick={handleCancelInvoice}
              disabled={updating}
              className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 flex items-center gap-2 rounded-xl px-4 py-2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <XCircle className="w-5 h-5" />
              {updating ? 'Cancelling...' : 'Cancel Invoice'}
            </motion.button>
          )}
        </AnimatePresence>

        <motion.div
          className={`badge ${statusConfig[invoice.status]?.badge || 'badge-info'} ml-auto flex items-center gap-2 px-4 py-2`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
        >
          <StatusIcon className="w-4 h-4" />
          {invoice.status}
        </motion.div>
      </motion.div>

      {/* Column Settings Toggle */}
      <motion.div variants={cardVariants} className="no-print">
        <motion.button
          onClick={() => setShowColumnSettings(!showColumnSettings)}
          className="btn btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Settings className="w-5 h-5" />
          Customise Columns
        </motion.button>
        <AnimatePresence>
          {showColumnSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card mt-3 p-4 overflow-hidden"
            >
              <p className="text-sm text-slate-400 mb-3">Select which columns appear on the printed invoice:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_COLUMNS.map(col => {
                  const isActive = visibleColumns.includes(col.key);
                  return (
                    <motion.button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 border transition-colors ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isActive && <Check className="w-3.5 h-3.5" />}
                      {col.label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Credit Notes Section */}
      {creditNotes.length > 0 && (
        <motion.div variants={cardVariants} className="glass-card overflow-hidden no-print">
          <div className="p-5 border-b border-slate-700/50 flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <RotateCcw className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Credit Notes / Returns</h2>
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
                    <ArrowLeft className="w-4 h-4 text-slate-500 rotate-180 group-hover:text-white transition-colors hidden sm:block" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Copy Mode Control */}
      <motion.div variants={cardVariants} className="glass-card p-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Copy Mode</p>
            <p className="text-xs text-slate-400">Choose whether to print one copy or both customer and business copies.</p>
          </div>
          <motion.button
            onClick={toggleCopyMode}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isSingleCopy
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            }`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {isSingleCopy ? 'Single Copy (1x)' : 'Double Copy (2x)'}
          </motion.button>
        </div>
      </motion.div>

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
    </>
  );
}
