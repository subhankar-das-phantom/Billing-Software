import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  CheckCircle, 
  Package, 
  XCircle, 
  Clock, 
  Edit3, 
  Trash2, 
  Calendar, 
  FileText, 
  DollarSign,
  Loader2
} from 'lucide-react';
import purchaseService from '../../services/purchaseService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMotionConfig, useFirstVisit, useMediaQuery } from '../../hooks';
import PurchaseDetailsPageSkeleton from './PurchaseDetailsPageSkeleton';

const createPageVariants = (isMobile, shouldStagger) => ({
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      staggerChildren: shouldStagger ? 0.08 : 0, 
      delayChildren: isMobile ? 0 : 0.1 
    } 
  }
});

const createCardVariants = (isMobile) => ({
  hidden: { opacity: 0, y: isMobile ? 12 : 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: isMobile 
      ? { type: "tween", duration: 0.2, ease: "easeOut" }
      : { type: "spring", stiffness: 300, damping: 24 } 
  }
});

export default function PurchaseDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('purchase-details');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const pageVariants = useMemo(() => createPageVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);
  const cardVariants = useMemo(() => createCardVariants(motionConfig.isMobile), [motionConfig.isMobile]);
  
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchPurchase = async () => {
    try {
      const data = await purchaseService.getPurchase(id);
      setPurchase(data.purchase);
    } catch (error) {
      showToast('Error fetching purchase details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchase();
  }, [id]);

  const handleComplete = async () => {
    if (!window.confirm('Completing this purchase will permanently receive stock. Continue?')) {
      return;
    }
    setCompleting(true);
    try {
      await purchaseService.completePurchase(id);
      showToast('Purchase completed successfully. Inventory received.', 'success');
      fetchPurchase();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error completing purchase', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancelling this purchase will reverse the inventory received from it. Continue?')) {
      return;
    }
    setCancelling(true);
    try {
      await purchaseService.cancelPurchase(id);
      showToast('Purchase cancelled successfully. Inventory reversed.', 'success');
      fetchPurchase();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error cancelling purchase', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this draft purchase?')) {
      return;
    }
    try {
      await purchaseService.deletePurchase(id);
      showToast('Purchase draft deleted successfully', 'success');
      navigate('/purchases');
    } catch (error) {
      showToast(error.response?.data?.message || 'Error deleting purchase', 'error');
    }
  };

  if (loading) {
    return <PurchaseDetailsPageSkeleton />;
  }

  if (!purchase) {
    return (
      <div className="p-8 text-center glass-card max-w-lg mx-auto my-12">
        <h2 className="text-xl font-bold text-white mb-2">Purchase Not Found</h2>
        <p className="text-slate-400 mb-6">The requested purchase record could not be found.</p>
        <Link to="/purchases" className="btn btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Purchases
        </Link>
      </div>
    );
  }

  const { totals, items, supplierId, status } = purchase;

  return (
    <motion.div 
      variants={pageVariants}
      initial={isFirstVisit ? "hidden" : false}
      animate="visible"
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
    >
      {/* Back Button */}
      <motion.div variants={cardVariants}>
        <Link
          to="/purchases"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Back to Purchases
        </Link>
      </motion.div>

      {/* Header Card */}
      <motion.div variants={cardVariants} className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
        <div className="flex items-start md:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {purchase.purchaseNumber}
              </h1>
              <span className={`px-3 py-1 text-xs font-bold rounded-full border flex items-center gap-1.5 shadow-sm ${
                status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                status === 'DRAFT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === 'COMPLETED' ? 'bg-emerald-500' :
                  status === 'DRAFT' ? 'bg-amber-500' :
                  'bg-rose-500'
                }`}></span>
                {status}
              </span>
            </div>
            <p className="text-sm text-slate-400 font-medium flex items-center flex-wrap gap-2">
              <span>Date: <strong className="text-slate-200">{formatDate(purchase.purchaseDate)}</strong></span>
              {purchase.supplierInvoiceNumber && (
                <>
                  <span className="hidden sm:inline text-slate-600">•</span>
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-slate-700 font-mono text-xs">
                    Ref: {purchase.supplierInvoiceNumber}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {status === 'DRAFT' && (
            <>
              {(isAdmin || hasPermission('purchases', 'edit')) && (
                <>
                  <button
                    onClick={() => navigate(`/purchases/${id}/edit`)}
                    className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="btn btn-primary flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {completing ? 'Completing...' : 'Complete & Receive Stock'}
                  </button>
                </>
              )}
              {(isAdmin || hasPermission('purchases', 'edit')) && (
                <button
                  onClick={handleDelete}
                  className="btn btn-secondary border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Draft
                </button>
              )}
            </>
          )}

          {status === 'COMPLETED' && (isAdmin || hasPermission('purchases', 'edit')) && (
            <button
              onClick={() => navigate(`/purchases/${id}/edit`)}
              className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          )}
          {status === 'COMPLETED' && (isAdmin || hasPermission('purchases', 'cancel')) && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn btn-secondary border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
            >
              <XCircle className="w-4 h-4" />
              {cancelling ? 'Cancelling...' : 'Cancel Purchase'}
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Info */}
          <motion.div variants={cardVariants} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <Package className="w-5 h-5 text-blue-400" />
                Supplier Details
              </h2>
            </div>
            
            {supplierId ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Company Name</p>
                  <p className="font-semibold text-white text-base">{supplierId.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">GSTIN</p>
                  <p className="font-semibold text-slate-300 font-mono text-xs bg-slate-800/80 px-2 py-1 rounded border border-slate-700 inline-block uppercase">
                    {supplierId.gstin || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Phone</p>
                  <p className="font-medium text-slate-200">{supplierId.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Email</p>
                  <p className="font-medium text-slate-200 truncate">{supplierId.email || 'N/A'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20 text-sm">
                Supplier details unavailable.
              </div>
            )}
          </motion.div>

          {/* Items Table */}
          <motion.div variants={cardVariants} className="glass-card overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-700/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Line Items ({items?.length || 0})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-700/50">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Free</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">GST %</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">
                          {item.productId?.productName || 'Unknown Product'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-200">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{item.freeQuantity > 0 ? item.freeQuantity : '-'}</td>
                      <td className="px-4 py-3">
                        {item.batchNumber && item.batchNumber !== 'UNNAMED' ? (
                          <span className="text-slate-300 font-mono text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{item.batchNumber}</span>
                        ) : (
                          <span className="text-slate-500 italic text-xs">No Batch #</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{item.expiryDate ? formatDate(item.expiryDate) : '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-200">{formatCurrency(item.purchaseRate)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {item.gstPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length === 0 && (
              <div className="p-8 text-center text-slate-500 italic">No line items found.</div>
            )}
          </motion.div>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <motion.div variants={cardVariants} className="glass-card overflow-hidden sticky top-6">
            <div className="p-4 sm:p-6 border-b border-slate-700/50 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white">Payment Summary</h2>
            </div>
            
            <div className="p-4 sm:p-6 space-y-3 text-sm">
              <div className="flex justify-between items-center text-slate-300">
                <span>Subtotal</span>
                <span className="text-white font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between items-center text-rose-400">
                  <span>Total Discount</span>
                  <span>- {formatCurrency(totals.totalDiscount)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center text-slate-300">
                <span>Taxable Amount</span>
                <span className="text-white font-medium">{formatCurrency(totals.totalTaxable)}</span>
              </div>
              
              <div className="pt-3 border-t border-slate-700/50 space-y-2">
                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>CGST</span>
                  <span className="text-slate-300">{formatCurrency(totals.totalCGST)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>SGST</span>
                  <span className="text-slate-300">{formatCurrency(totals.totalSGST)}</span>
                </div>
                {totals.totalIGST > 0 && (
                  <div className="flex justify-between items-center text-slate-400 text-xs">
                    <span>IGST</span>
                    <span className="text-slate-300">{formatCurrency(totals.totalIGST)}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grand Total</span>
                  <span className="text-2xl font-black text-emerald-400">
                    {formatCurrency(totals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
            
            {purchase.notes && (
              <div className="p-4 bg-amber-500/10 border-t border-amber-500/20 text-xs">
                <p className="font-bold text-amber-400 uppercase tracking-wider mb-1">Notes:</p>
                <p className="text-amber-100/90 leading-relaxed">{purchase.notes}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
