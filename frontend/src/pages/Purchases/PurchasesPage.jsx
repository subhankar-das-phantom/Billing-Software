import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Eye, CheckCircle, Trash2, XCircle } from 'lucide-react';
import purchaseService from '../../services/purchaseService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const data = await purchaseService.getPurchases();
      setPurchases(data.purchases || []);
    } catch (error) {
      showToast('Error fetching purchases', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this draft purchase?')) return;
    try {
      await purchaseService.deletePurchase(id);
      showToast('Purchase deleted successfully', 'success');
      fetchPurchases();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error deleting purchase', 'error');
    }
  };

  const handleComplete = async (id) => {
    if (!window.confirm('Completing this purchase will permanently receive stock. Continue?')) return;
    try {
      await purchaseService.completePurchase(id);
      showToast('Purchase completed successfully. Inventory updated.', 'success');
      fetchPurchases();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error completing purchase', 'error');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancelling this purchase will reverse the inventory received from it. Continue?')) return;
    try {
      await purchaseService.cancelPurchase(id);
      showToast('Purchase cancelled successfully. Inventory reversed.', 'success');
      fetchPurchases();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error cancelling purchase', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">Purchases</h1>
        <Link
          to="/purchases/new"
          className="btn bg-gradient-to-r from-blue-600 to-accent2-600 hover:from-blue-700 hover:to-accent2-700 text-white shadow-lg shadow-blue-500/20 border-0 flex items-center gap-2"
        >
          <Plus size={20} />
          <span>New Purchase</span>
        </Link>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading purchases...</div>
        ) : purchases.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No purchases found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800/50 border-b border-white/5">
              <tr>
                <th className="p-4 font-semibold text-slate-300">Date</th>
                <th className="p-4 font-semibold text-slate-300">Purchase #</th>
                <th className="p-4 font-semibold text-slate-300">Supplier</th>
                <th className="p-4 font-semibold text-slate-300">Total</th>
                <th className="p-4 font-semibold text-slate-300">Status</th>
                <th className="p-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {purchases.map((purchase) => (
                <tr key={purchase._id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-slate-300">{formatDate(purchase.purchaseDate)}</td>
                  <td className="p-4 font-medium text-blue-400">
                    <Link to={`/purchases/${purchase._id}`}>{purchase.purchaseNumber}</Link>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{purchase.supplierId?.name || 'Unknown Supplier'}</div>
                  </td>
                  <td className="p-4 font-semibold text-slate-200">{formatCurrency(purchase.totals?.grandTotal || 0)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      purchase.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                      purchase.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      title="View Details"
                      onClick={() => navigate(`/purchases/${purchase._id}`)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                    >
                      <Eye size={18} />
                    </button>
                    {purchase.status === 'DRAFT' && (
                      <>
                        {(isAdmin || hasPermission('purchases', 'edit')) && (
                          <button
                            title="Complete Purchase"
                            onClick={() => handleComplete(purchase._id)}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {(isAdmin || hasPermission('purchases', 'delete')) && (
                          <button
                            title="Delete Draft"
                            onClick={() => handleDelete(purchase._id)}
                            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </>
                    )}
                    {purchase.status === 'COMPLETED' && (isAdmin || hasPermission('purchases', 'cancel')) && (
                      <button
                        title="Cancel Purchase"
                        onClick={() => handleCancel(purchase._id)}
                        className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
