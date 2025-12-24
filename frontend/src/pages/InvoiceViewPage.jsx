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
  XCircle
} from 'lucide-react';
import { invoiceService } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import { useToast } from '../context/ToastContext';

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
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const printRef = useRef();
  const { success, error } = useToast();

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const data = await invoiceService.getInvoice(id);
      setInvoice(data.invoice);
    } catch (err) {
      error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMarkPrinted = async () => {
    setUpdating(true);
    try {
      await invoiceService.updateStatus(id, 'Printed');
      setInvoice(prev => ({ ...prev, status: 'Printed' }));
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

  const handleCancelInvoice = async () => {
    if (!window.confirm('Are you sure you want to cancel this invoice? This action cannot be undone.')) {
      return;
    }
    
    setUpdating(true);
    try {
      await invoiceService.updateStatus(id, 'Cancelled');
      setInvoice(prev => ({ ...prev, status: 'Cancelled' }));
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
  const InvoiceCopy = ({ copyType }) => (
    <div 
      className="invoice-copy bg-white flex flex-col"
      style={{ 
        width: '100%',
        minHeight: '130mm',
        fontSize: '10px',
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
            <h1 className="font-bold mb-0.5" style={{ fontSize: '14px' }}>{invoice.distributor?.firmName || 'BHARAT ENTERPRISES'}</h1>
            <p className="text-[9px] leading-tight">{invoice.distributor?.firmAddress || 'Address Line 1, City, State - PIN'}</p>
          </div>
          <div className="text-right text-[9px] leading-tight">
            <p>Phone: {invoice.distributor?.firmPhone || 'XXXXXXXXXX'}</p>
            <p>DL No: DL-XXXXX-XXXXX</p>
            <p>GSTIN: {invoice.distributor?.firmGSTIN || 'XXXXXXXXXXXX'}</p>
          </div>
        </div>

        {/* Buyer & Invoice Details */}
        <div className="grid grid-cols-3 gap-2 mb-1 text-[9px]">
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
          <table className="w-full border-collapse text-[7px]" style={{ border: '0.5px solid black' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid black' }}>
                <th className="border-r border-black p-0.5 text-center" style={{ width: '4%' }}>Qty</th>
                <th className="border-r border-black p-0.5 text-center" style={{ width: '3%' }}>Fr</th>
                <th className="border-r border-black p-0.5 text-left" style={{ width: '20%' }}>Product Name</th>
                <th className="border-r border-black p-0.5 text-center" style={{ width: '7%' }}>HSN</th>
                <th className="border-r border-black p-0.5 text-center" style={{ width: '8%' }}>Batch</th>
                <th className="border-r border-black p-0.5 text-center" style={{ width: '5%' }}>Exp</th>
                <th className="border-r border-black p-0.5 text-right" style={{ width: '8%' }}>MRP</th>
                <th className="border-r border-black p-0.5 text-right" style={{ width: '8%' }}>Rate</th>
                <th className="border-r border-black p-0.5 text-center" style={{ width: '5%' }}>Disc%</th>
                <th className="border-r border-black p-0.5 text-center" style={{ width: '4%' }}>GST%</th>
                <th className="p-0.5 text-right" style={{ width: '10%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => {
                const expDate = item.product?.expiryDate 
                  ? new Date(item.product.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })
                  : 'N/A';
                const itemAmount = item.quantitySold * item.ratePerUnit;
                
                return (
                  <tr key={index} style={{ borderBottom: index < invoice.items.length - 1 ? '0.5px solid #ddd' : 'none' }}>
                    <td className="border-r border-black p-0.5 text-center">{item.quantitySold}</td>
                    <td className="border-r border-black p-0.5 text-center">{item.freeQuantity || 0}</td>
                    <td className="border-r border-black p-0.5">{item.product?.productName}</td>
                    <td className="border-r border-black p-0.5 text-center">{item.product?.hsnCode}</td>
                    <td className="border-r border-black p-0.5 text-center">{item.product?.batchNo}</td>
                    <td className="border-r border-black p-0.5 text-center">{expDate}</td>
                    <td className="border-r border-black p-0.5 text-right">{item.product?.newMRP?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-0.5 text-right">{item.ratePerUnit.toFixed(2)}</td>
                    <td className="border-r border-black p-0.5 text-center">{item.schemeDiscount || 0}%</td>
                    <td className="border-r border-black p-0.5 text-center">{item.product?.gstPercentage}%</td>
                    <td className="p-0.5 text-right font-semibold">{itemAmount.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary and Footer */}
      <div className="mt-auto">
        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="text-[9px]">
            <p className="font-bold mb-0.5">Amount in Words:</p>
            <p className="uppercase">{invoice.totals?.amountInWords || 'Rupees Zero Only'}</p>
          </div>
          <div className="text-[9px]">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-0">Taxable:</td>
                  <td className="text-right font-semibold">₹{invoice.totals?.totalTaxable?.toFixed(2)}</td>
                </tr>
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
                  <td className="text-right font-bold text-[11px]">₹{Math.round(invoice.totals?.netTotal || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-black pt-1 text-[9px]">
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

        <motion.button
          onClick={handlePrint}
          className="btn btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Printer className="w-5 h-5" />
          Print
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

      {/* Invoice Print Area - Two Copies on A4 */}
      <div className="flex justify-center">
        <motion.div
          ref={printRef}
          variants={cardVariants}
          className="invoice-print bg-white border-2 border-slate-300 shadow-lg"
          style={{ 
            width: '190mm',
            fontSize: '8px',
            color: '#000000',
            margin: '0 auto',
            padding: '2mm'
          }}
        >
          {/* Customer Copy - Top Half */}
          <InvoiceCopy />
          
          {/* Cut Line */}
          <div className="flex items-center my-2" style={{ borderTop: '1px dashed #000' }}>
            <span className="text-[7px] text-gray-600 mx-auto bg-white px-2" style={{ marginTop: '-8px' }}>
              ✂ Cut Here
            </span>
          </div>
          
          {/* Office Copy - Bottom Half */}
          <InvoiceCopy  />
        </motion.div>
      </div>
    </motion.div>
  );
}

