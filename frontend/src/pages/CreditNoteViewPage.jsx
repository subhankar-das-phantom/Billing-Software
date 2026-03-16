import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Printer,
  Download,
  RotateCcw,
  FileText,
  Calendar,
  User,
  Hash,
  Receipt
} from 'lucide-react';
import { creditNoteService } from '../services/creditNoteService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import { useToast } from '../context/ToastContext';
import { useSWR } from '../hooks';
import RefreshIndicator from '../components/Common/RefreshIndicator';

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

export default function CreditNoteViewPage() {
  const { id } = useParams();
  const printRef = useRef();
  const { error } = useToast();

  const { data: creditNoteData, isLoading: loading, isValidating } = useSWR(
    id ? `credit-note-${id}` : null,
    () => creditNoteService.getCreditNote(id)
  );

  const creditNote = creditNoteData?.creditNote || creditNoteData;

  useEffect(() => {
    if (creditNote) {
      const cnNum = creditNote.creditNoteNumber || '';
      document.title = `CreditNote_${cnNum}`;
      return () => { document.title = 'Bharat Enterprise - Billing System'; };
    }
  }, [creditNote]);

  const handlePrint = () => window.print();

  if (loading) return <PageLoader />;
  if (!creditNote) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 text-center"
      >
        <p className="text-slate-400 mb-6 text-lg">Credit note not found</p>
        <Link to="/invoices" className="btn btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          Back to Invoices
        </Link>
      </motion.div>
    );
  }

  // Reusable Credit Note Print Copy
  const CreditNoteCopy = () => (
    <div
      className="invoice-copy bg-white flex flex-col"
      style={{
        width: '100%',
        minHeight: '100mm',
        fontSize: '10px',
        color: '#000000',
        padding: '4mm',
        boxSizing: 'border-box'
      }}
    >
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="border-b-2 border-black pb-1 mb-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-left">
              <h1 className="font-bold mb-0.5" style={{ fontSize: '14px' }}>
                {creditNote.distributor?.firmName || 'BHARAT ENTERPRISES'}
              </h1>
              <p className="text-[9px] leading-tight">
                {creditNote.distributor?.firmAddress || 'North Bazar, Andal, Paschim Bardhaman, 713321 (W.B.)'}
              </p>
            </div>
            <div className="text-right text-[9px] leading-tight">
              <p>Phone: {creditNote.distributor?.firmPhone || '+918906830790'}</p>
              <p>DL No: DL-XXXXX-XXXXX</p>
              <p>GSTIN: {creditNote.distributor?.firmGSTIN || '19BHVPG9900N1ZG'}</p>
            </div>
          </div>
          <div className="text-center mt-1">
            <span className="font-bold text-[12px] border border-black px-3 py-0.5">
              CREDIT NOTE
            </span>
          </div>
        </div>

        {/* Buyer & Credit Note Details */}
        <div className="grid grid-cols-3 gap-2 mb-1 text-[9px]">
          <div>
            <p className="font-bold mb-0.5">M/s {creditNote.customer?.customerName}</p>
            <p className="leading-tight">{creditNote.customer?.address || ''}</p>
            <p className="mt-0.5">Ph: {creditNote.customer?.phone}</p>
          </div>
          <div className="border-l border-black pl-2">
            {creditNote.customer?.gstin && <p>GSTIN: {creditNote.customer.gstin}</p>}
          </div>
          <div className="text-right">
            <p><span className="font-bold">Credit Note No:</span> {creditNote.creditNoteNumber}</p>
            <p><span className="font-bold">Date:</span> {formatDate(creditNote.createdAt)}</p>
            <p><span className="font-bold">Against Invoice:</span> {creditNote.invoiceNumber}</p>
            {creditNote.reason && <p><span className="font-bold">Reason:</span> {creditNote.reason}</p>}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-1">
          <table className="w-full border-collapse text-[8px]" style={{ border: '0.5px solid black' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid black' }}>
                <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '5%' }}>SN</th>
                <th className="border-r border-black p-0.5 text-left font-bold" style={{ width: '35%' }}>Product Name</th>
                <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '8%' }}>Qty</th>
                <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '10%' }}>Rate</th>
                <th className="border-r border-black p-0.5 text-center font-bold" style={{ width: '6%' }}>GST%</th>
                <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '10%' }}>Taxable</th>
                <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '8%' }}>CGST</th>
                <th className="border-r border-black p-0.5 text-right font-bold" style={{ width: '8%' }}>SGST</th>
                <th className="p-0.5 text-right font-bold" style={{ width: '10%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {creditNote.items?.map((item, index) => (
                <tr key={index} style={{ borderBottom: index < creditNote.items.length - 1 ? '0.5px solid #ddd' : 'none' }}>
                  <td className="border-r border-black p-0.5 text-center">{index + 1}</td>
                  <td className="border-r border-black p-0.5 font-bold">{item.productName}</td>
                  <td className="border-r border-black p-0.5 text-center font-bold">{item.quantityReturned}</td>
                  <td className="border-r border-black p-0.5 text-right">{item.rate?.toFixed(2)}</td>
                  <td className="border-r border-black p-0.5 text-center">{item.gstPercent}%</td>
                  <td className="border-r border-black p-0.5 text-right">{item.taxableAmount?.toFixed(2)}</td>
                  <td className="border-r border-black p-0.5 text-right">{item.cgstAmount?.toFixed(2)}</td>
                  <td className="border-r border-black p-0.5 text-right">{item.sgstAmount?.toFixed(2)}</td>
                  <td className="p-0.5 text-right font-bold">{item.totalAmount?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary and Footer */}
      <div className="mt-auto">
        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="text-[9px]">
            <p className="text-[8px] mt-1">This is a system-generated Credit Note as per GST Section 34.</p>
            <p className="text-[8px]">Stock has been restored to inventory.</p>
          </div>
          <div className="text-[9px]">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-0">Taxable:</td>
                  <td className="text-right font-semibold">₹{creditNote.totals?.totalTaxable?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">CGST:</td>
                  <td className="text-right">₹{creditNote.totals?.totalCGST?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-0">SGST:</td>
                  <td className="text-right">₹{creditNote.totals?.totalSGST?.toFixed(2)}</td>
                </tr>
                <tr className="border-t border-black">
                  <td className="py-0.5 font-bold">CREDIT TOTAL:</td>
                  <td className="text-right font-bold text-[11px]">₹{creditNote.totals?.netTotal?.toFixed(2)}</td>
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
    <>
      <RefreshIndicator isRefreshing={isValidating} />
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
      {/* Actions Bar */}
      <motion.div variants={cardVariants} className="flex flex-wrap gap-3 no-print">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link to={`/invoices/${creditNote.invoiceId}`} className="btn btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            Back to Invoice
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

        <motion.button
          onClick={handlePrint}
          className="btn btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download className="w-5 h-5" />
          Download
        </motion.button>

        <motion.div
          className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30 ml-auto flex items-center gap-2 px-4 py-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
        >
          <RotateCcw className="w-4 h-4" />
          Credit Note
        </motion.div>
      </motion.div>

      {/* Credit Note Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <motion.div variants={cardVariants} className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Receipt className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Credit Note</p>
              <p className="text-lg font-bold text-amber-400">{creditNote.creditNoteNumber}</p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Against Invoice:</span>
              <Link to={`/invoices/${creditNote.invoiceId}`} className="text-blue-400 hover:text-blue-300">
                {creditNote.invoiceNumber}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date:</span>
              <span className="text-slate-200">{formatDate(creditNote.createdAt)}</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Customer</p>
              <p className="text-lg font-semibold text-white">{creditNote.customer?.customerName}</p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            {creditNote.customer?.phone && (
              <div className="flex justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="text-slate-200">{creditNote.customer.phone}</span>
              </div>
            )}
            {creditNote.customer?.gstin && (
              <div className="flex justify-between">
                <span className="text-slate-400">GSTIN:</span>
                <span className="text-slate-200">{creditNote.customer.gstin}</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={cardVariants} className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Credit Amount</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(creditNote.totals?.netTotal)}</p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Taxable:</span>
              <span className="text-slate-200">{formatCurrency(creditNote.totals?.totalTaxable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">GST (CGST + SGST):</span>
              <span className="text-slate-200">{formatCurrency(creditNote.totals?.totalGST)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Items Card - no-print */}
      <motion.div variants={cardVariants} className="glass-card p-6 no-print">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-400" />
          Returned Items
        </h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty Returned</th>
                <th>Rate</th>
                <th>GST%</th>
                <th>Taxable</th>
                <th>GST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {creditNote.items?.map((item, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-slate-700/50"
                >
                  <td className="font-medium text-white">{item.productName}</td>
                  <td className="text-white font-semibold">{item.quantityReturned}</td>
                  <td className="text-slate-300">{formatCurrency(item.rate)}</td>
                  <td className="text-slate-300">{item.gstPercent}%</td>
                  <td className="text-slate-300">{formatCurrency(item.taxableAmount)}</td>
                  <td className="text-slate-300">{formatCurrency(item.gstAmount)}</td>
                  <td className="text-emerald-400 font-medium">{formatCurrency(item.totalAmount)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reason */}
        {creditNote.reason && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Return Reason</p>
            <p className="text-slate-200">{creditNote.reason}</p>
          </div>
        )}
      </motion.div>

      {/* Credit Note Print Area */}
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
          <CreditNoteCopy />
        </motion.div>
      </div>
    </motion.div>
    </>
  );
}
