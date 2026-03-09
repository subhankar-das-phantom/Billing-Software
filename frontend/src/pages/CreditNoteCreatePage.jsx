import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  RotateCcw,
  Package,
  Hash,
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calculator,
  Layers
} from 'lucide-react';
import { invoiceService } from '../services/invoiceService';
import { creditNoteService } from '../services/creditNoteService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import { useToast } from '../context/ToastContext';
import { invalidateCachePattern } from '../hooks';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

export default function CreditNoteCreatePage() {
  const { id: invoiceId } = useParams();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [existingReturns, setExistingReturns] = useState({});
  const [returnItems, setReturnItems] = useState([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadData();
  }, [invoiceId]);

  const loadData = async () => {
    try {
      const invoiceData = await invoiceService.getInvoice(invoiceId, false);
      
      if (!invoiceData?.invoice) {
        error('Invoice not found');
        navigate('/invoices');
        return;
      }

      setInvoice(invoiceData.invoice);

      // Try to get existing credit notes (may be empty for first return)
      let returnSummary = {};
      try {
        const creditNoteData = await creditNoteService.getCreditNotesByInvoice(invoiceId);
        returnSummary = creditNoteData.returnSummary || {};
      } catch (cnErr) {
        // No existing credit notes — that's fine, continue
        console.log('No existing credit notes:', cnErr.message);
      }

      setExistingReturns(returnSummary);

      // Initialize return items from invoice
      const items = invoiceData.invoice.items.map(item => {
        const productKey = item.product._id?.toString() || item.product._id;
        const alreadyReturned = returnSummary[productKey]?.totalReturned || 0;
        const maxReturnable = item.quantitySold - alreadyReturned;

        return {
          productId: item.product._id,
          productName: item.product.productName,
          batchId: item.product.batchId || null,
          batchNo: item.product.batchNo || '',
          quantitySold: item.quantitySold,
          alreadyReturned,
          maxReturnable,
          quantityReturned: 0,
          rate: item.ratePerUnit,
          gstPercent: item.product.gstPercentage
        };
      });

      setReturnItems(items);
    } catch (err) {
      console.error('Failed to load credit note data:', err);
      error('Failed to load invoice data');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  const updateReturnQty = (index, qty) => {
    const parsed = parseInt(qty) || 0;
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantityReturned: Math.min(Math.max(0, parsed), updated[index].maxReturnable)
      };
      return updated;
    });
  };

  const calculateReturnAmounts = () => {
    let totalTaxable = 0;
    let totalGST = 0;
    let netTotal = 0;

    for (const item of returnItems) {
      if (item.quantityReturned <= 0) continue;
      const taxable = item.rate * item.quantityReturned;
      const gst = taxable * (item.gstPercent / 100);
      totalTaxable += taxable;
      totalGST += gst;
      netTotal += taxable + gst;
    }

    return {
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      totalGST: Math.round(totalGST * 100) / 100,
      totalCGST: Math.round(totalGST * 50) / 100,
      totalSGST: Math.round(totalGST * 50) / 100,
      netTotal: Math.round(netTotal * 100) / 100
    };
  };

  const returnTotals = calculateReturnAmounts();
  const hasReturns = returnItems.some(i => i.quantityReturned > 0);

  const handleSubmit = async () => {
    if (!hasReturns) {
      error('Select at least one item to return');
      return;
    }

    setSubmitting(true);
    try {
      const items = returnItems
        .filter(i => i.quantityReturned > 0)
        .map(i => ({
          productId: i.productId,
          batchId: i.batchId,
          batchNo: i.batchNo,
          quantityReturned: i.quantityReturned
        }));

      const result = await creditNoteService.createCreditNote({
        invoiceId,
        items,
        reason
      });

      success('Credit note created successfully!');
      invalidateCachePattern('invoices');
      invalidateCachePattern('products');
      invalidateCachePattern('credit-notes');
      // Navigate to the newly created credit note view page
      const creditNoteId = result.creditNote?._id;
      if (creditNoteId) {
        navigate(`/credit-notes/${creditNoteId}`);
      } else {
        navigate(`/invoices/${invoiceId}`);
      }
    } catch (err) {
      error(err.response?.data?.message || 'Failed to create credit note');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!invoice) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-slate-400 mb-6">Invoice not found</p>
        <Link to="/invoices" className="btn btn-primary">Back to Invoices</Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Back + header */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible">
        <Link to={`/invoices/${invoiceId}`} className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Invoice
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 rounded-xl">
            <RotateCcw className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Create Credit Note</h1>
            <p className="text-slate-400">Invoice: {invoice.invoiceNumber} · {invoice.customer.customerName}</p>
          </div>
        </div>
      </motion.div>

      {/* Invoice Info */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-4 bg-slate-800/50">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-500">Invoice Date:</span>{' '}
            <span className="text-slate-300">{formatDate(invoice.invoiceDate)}</span>
          </div>
          <div>
            <span className="text-slate-500">Total:</span>{' '}
            <span className="text-emerald-400 font-medium">{formatCurrency(invoice.totals.netTotal)}</span>
          </div>
          <div>
            <span className="text-slate-500">Payment:</span>{' '}
            <span className="text-slate-300">{invoice.paymentType}</span>
          </div>
        </div>
      </motion.div>

      {/* Return Items Table */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-400" />
          Select Items to Return
        </h2>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch</th>
                <th>Sold Qty</th>
                <th>Already Returned</th>
                <th>Max Returnable</th>
                <th>Return Qty</th>
                <th>Return Total</th>
              </tr>
            </thead>
            <tbody>
              {returnItems.map((item, index) => {
                const itemTotal = item.quantityReturned > 0
                  ? (item.rate * item.quantityReturned * (1 + item.gstPercent / 100))
                  : 0;

                return (
                  <motion.tr
                    key={item.productId + (item.batchId || index)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className={`hover:bg-slate-700/50 transition-colors ${item.maxReturnable === 0 ? 'opacity-50' : ''}`}
                  >
                    <td className="font-medium text-white">{item.productName}</td>
                    <td>
                      <span className="font-mono text-sm text-slate-400 flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {item.batchNo || '—'}
                      </span>
                    </td>
                    <td className="text-slate-300">{item.quantitySold}</td>
                    <td>
                      <span className={`text-sm ${item.alreadyReturned > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {item.alreadyReturned}
                      </span>
                    </td>
                    <td className="text-slate-300">{item.maxReturnable}</td>
                    <td>
                      <input
                        type="number"
                        value={item.quantityReturned || ''}
                        onChange={(e) => updateReturnQty(index, e.target.value)}
                        className="input w-24 text-center"
                        placeholder="0"
                        min="0"
                        max={item.maxReturnable}
                        disabled={item.maxReturnable === 0}
                      />
                    </td>
                    <td className="text-emerald-400 font-medium">
                      {itemTotal > 0 ? formatCurrency(itemTotal) : '—'}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Return Summary */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-purple-400" />
          Credit Note Summary
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label">Reason for Return</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              placeholder="e.g., Damaged goods, Wrong product, Near expiry"
            />
          </div>

          <div className="bg-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Taxable Amount:</span>
              <span className="text-slate-200">{formatCurrency(returnTotals.totalTaxable)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">CGST:</span>
              <span className="text-slate-200">{formatCurrency(returnTotals.totalCGST)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">SGST:</span>
              <span className="text-slate-200">{formatCurrency(returnTotals.totalSGST)}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between text-lg">
              <span className="text-white font-semibold">Credit Amount:</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(returnTotals.netTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link to={`/invoices/${invoiceId}`} className="btn btn-secondary">
              Cancel
            </Link>
            <motion.button
              onClick={handleSubmit}
              disabled={!hasReturns || submitting}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={hasReturns ? { scale: 1.02 } : {}}
              whileTap={hasReturns ? { scale: 0.98 } : {}}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Create Credit Note
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
