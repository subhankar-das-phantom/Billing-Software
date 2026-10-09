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
import { creditNoteService } from '../../services/credits/creditNoteService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CreditNoteViewPageSkeleton } from './CreditNoteViewPageSkeleton';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSWR, useFirstVisit } from '../../hooks';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import PrintDialog from '../../features/documentPrinting/components/PrintDialog';
import CreditNoteDocument from '../../features/documentPrinting/renderers/CreditNoteDocument';
import { resolveDocumentPrintFormat, DOCUMENT_TYPES } from '../../features/documentPrinting/formats/documentPrintFormats';

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
  const { user, admin } = useAuth();
  const isFirstVisit = useFirstVisit('credit-note-view');

  const { data: creditNoteData, isLoading: loading, isValidating } = useSWR(
    id ? `credit-note-${id}` : null,
    () => creditNoteService.getCreditNote(id)
  );

  const creditNote = creditNoteData?.creditNote || creditNoteData;
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const configuredFormat = resolveDocumentPrintFormat(
    user?.preferences || admin?.preferences,
    DOCUMENT_TYPES.CREDIT_NOTE
  );

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

  useEffect(() => {
    if (creditNote) {
      const cnNum = creditNote.creditNoteNumber || '';
      document.title = `CreditNote_${cnNum}`;
      return () => { document.title = 'Bharat Enterprise - Billing System'; };
    }
  }, [creditNote]);

  const handlePrint = () => setShowPrintDialog(true);

  if (loading) return <CreditNoteViewPageSkeleton />;
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


  return (
    <>
      <RefreshIndicator isRefreshing={isValidating} />
      <motion.div
        variants={pageVariants}
        initial={isFirstVisit ? "hidden" : false}
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
              <p className="text-lg font-semibold text-slate-100">{creditNote.customer?.customerName}</p>
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
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-400" />
          Returned Items
        </h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="text-left">Product</th>
                <th className="text-center">Qty Returned</th>
                <th className="text-right">Rate</th>
                <th className="text-center">GST%</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">GST</th>
                <th className="text-right">Total</th>
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
                  <td className="font-medium text-slate-100 text-left">{item.productName}</td>
                  <td className="text-slate-100 font-semibold text-center">{item.quantityReturned}</td>
                  <td className="text-slate-300 text-right">{formatCurrency(item.rate)}</td>
                  <td className="text-slate-300 text-center">{item.gstPercent}%</td>
                  <td className="text-slate-300 text-right">{formatCurrency(item.taxableAmount)}</td>
                  <td className="text-slate-300 text-right">{formatCurrency(item.gstAmount)}</td>
                  <td className="text-emerald-400 font-medium text-right">{formatCurrency(item.totalAmount)}</td>
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

        {/* Credit Note Format-Aware Document Preview Area */}
        <div className="w-full space-y-3 no-print">
          {/* Format Selection Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
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

            <div className="flex items-center gap-1.5 flex-wrap">
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
                      ? 'bg-amber-600 text-white shadow-sm'
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
              <CreditNoteDocument
                creditNote={creditNote}
                format={previewFormat}
                admin={admin}
              />
            </motion.div>
          </div>
        </div>
      </motion.div>
      <PrintDialog
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        documentType={DOCUMENT_TYPES.CREDIT_NOTE}
        title={`Print Credit Note ${creditNote.creditNoteNumber || ''}`}
        initialFormat={previewFormat}
        renderDocument={(activeFormat) => (
          <CreditNoteDocument
            creditNote={creditNote}
            format={activeFormat}
            admin={admin}
          />
        )}
      />
    </>
  );
}
