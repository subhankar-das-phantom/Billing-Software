import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Package, XCircle } from 'lucide-react';
import purchaseService from '../../services/purchaseService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

export default function PurchaseDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  
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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  if (!purchase) return <div className="p-8 text-center text-red-500">Purchase not found.</div>;

  const { totals, items, supplierId, status } = purchase;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header Card */}
      <div className="glass-card p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
        <div className="flex items-start md:items-center gap-5">
          <button 
            onClick={() => navigate('/purchases')} 
            className="mt-1 md:mt-0 p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors focus:outline-none"
            title="Back to Purchases"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {purchase.purchaseNumber}
              </h1>
              <span className={`px-3 py-1 text-xs font-bold rounded-full border flex items-center gap-1.5 shadow-sm ${
                status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                status === 'DRAFT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === 'COMPLETED' ? 'bg-emerald-500' :
                  status === 'DRAFT' ? 'bg-amber-500' :
                  'bg-red-500'
                }`}></span>
                {status}
              </span>
            </div>
            <p className="text-sm text-slate-400 font-medium flex items-center flex-wrap gap-2">
              <span>Created on <span className="text-slate-300">{formatDate(purchase.purchaseDate)}</span></span>
              {purchase.supplierInvoiceNumber && (
                <>
                  <span className="hidden sm:inline text-slate-600">•</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">Ref: {purchase.supplierInvoiceNumber}</span>
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
                    className="flex items-center gap-2 bg-slate-800/80 border border-slate-600/50 text-slate-300 px-5 py-2.5 rounded-xl hover:bg-slate-700/80 hover:text-white transition-all font-semibold active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl transition-all font-semibold active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle size={18} />
                    {completing ? 'Completing...' : 'Complete & Receive Stock'}
                  </button>
                </>
              )}
              {(isAdmin || hasPermission('purchases', 'edit')) && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 bg-slate-800/80 border border-red-500/30 text-red-400 px-5 py-2.5 rounded-xl hover:bg-red-500/10 hover:border-red-500/50 transition-all font-semibold active:scale-95"
                >
                  Delete Draft
                </button>
              )}
            </>
          )}

          {status === 'COMPLETED' && (isAdmin || hasPermission('purchases', 'edit')) && (
            <button
              onClick={() => navigate(`/purchases/${id}/edit`)}
              className="flex items-center gap-2 bg-slate-800/80 border border-slate-600/50 text-slate-300 px-6 py-2.5 rounded-xl hover:bg-slate-700/80 hover:text-white transition-all font-semibold active:scale-95"
            >
              Edit
            </button>
          )}
          {status === 'COMPLETED' && (isAdmin || hasPermission('purchases', 'cancel')) && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-2 bg-slate-800/80 border border-red-500/30 text-red-400 px-6 py-2.5 rounded-xl hover:bg-red-500/10 hover:border-red-500/50 disabled:opacity-50 transition-all font-semibold active:scale-95"
            >
              <XCircle size={18} />
              {cancelling ? 'Cancelling...' : 'Cancel Purchase'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Supplier Info */}
          <div className="glass-card p-6 sm:p-8 transition-all hover:border-slate-600">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <Package size={22} />
                </div>
                Supplier Details
              </h2>
            </div>
            
            {supplierId ? (
              <div className="bg-slate-800/50 rounded-xl p-5 sm:p-6 border border-slate-700/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Company Name</p>
                    <p className="font-semibold text-white text-base">{supplierId.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">GSTIN</p>
                    <p className="font-semibold text-slate-300 font-mono text-sm bg-slate-900 px-2 py-1 rounded border border-slate-700 inline-block">{supplierId.gstin || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contact Phone</p>
                    <p className="font-medium text-slate-200">{supplierId.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</p>
                    <p className="font-medium text-slate-200 truncate">{supplierId.email || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20 flex items-center justify-center italic text-sm">
                Supplier removed or unavailable.
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="glass-card transition-all hover:border-slate-600 overflow-hidden">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-white">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800/50 text-slate-300 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Qty</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Free</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Batch</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Expiry</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Rate</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">GST %</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                          {item.productId?.productName || 'Unknown Product'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-200">{item.quantity}</td>
                      <td className="px-6 py-4 text-right text-slate-400">{item.freeQuantity > 0 ? item.freeQuantity : '-'}</td>
                      <td className="px-6 py-4">
                        {item.batchNumber && item.batchNumber !== 'UNNAMED' ? (
                          <span className="text-slate-300 font-mono text-xs bg-slate-800 px-2 py-1 rounded border border-slate-700">{item.batchNumber}</span>
                        ) : (
                          <span className="text-slate-500 italic text-xs">No Batch #</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{item.expiryDate ? formatDate(item.expiryDate) : '-'}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-200">{formatCurrency(item.purchaseRate)}</td>
                      <td className="px-6 py-4 text-right text-slate-400">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {item.gstPercent}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-400">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length === 0 && (
              <div className="p-8 text-center text-slate-500 italic border-t border-slate-700/50">No line items found.</div>
            )}
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-8">
          <div className="glass-card overflow-hidden sticky top-6 transition-all hover:border-slate-600">
            <div className="p-6 border-b border-slate-700/50 bg-slate-800/30">
              <h2 className="text-xl font-bold text-white">Payment Summary</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-sm">Subtotal</span>
                <span className="text-white">{formatCurrency(totals.subtotal)}</span>
              </div>
              
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between items-center text-red-400">
                  <span className="text-sm">Total Discount</span>
                  <span>- {formatCurrency(totals.totalDiscount)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-sm">Total Taxable</span>
                <span className="text-white">{formatCurrency(totals.totalTaxable)}</span>
              </div>
              
              <div className="pt-5 mt-5 border-t border-slate-700/50 space-y-3">
                <div className="flex justify-between items-center text-slate-400 text-sm">
                  <span>CGST</span>
                  <span className="text-slate-300">{formatCurrency(totals.totalCGST)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-sm">
                  <span>SGST</span>
                  <span className="text-slate-300">{formatCurrency(totals.totalSGST)}</span>
                </div>
                {totals.totalIGST > 0 && (
                  <div className="flex justify-between items-center text-slate-400 text-sm">
                    <span>IGST</span>
                    <span className="text-slate-300">{formatCurrency(totals.totalIGST)}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Grand Total</span>
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 text-right">
                    {formatCurrency(totals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
            
            {purchase.notes && (
              <div className="p-6 bg-amber-500/10 border-t border-amber-500/20">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Notes
                </h3>
                <p className="text-sm text-amber-100/80 leading-relaxed font-medium">{purchase.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
