import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Building2,
  Layers,
  Percent,
  DollarSign,
  Loader2,
  CheckCircle,
  Barcode,
  ArrowUpDown,
  Ruler
} from 'lucide-react';
import { productService } from '../services/productService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import Modal from '../components/Common/Modal';
import EnhancedButton from '../components/Common/EnhancedButton';
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

export default function ProductDetailsPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stock adjust
  const [stockAdjustModal, setStockAdjustModal] = useState(false);
  const [stockAdjust, setStockAdjust] = useState({ qty: '', type: 'in', reason: '' });

  const { success, error } = useToast();

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const data = await productService.getProduct(id, false);
      setProduct(data.product);
    } catch (err) {
      error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleStockAdjust = async () => {
    if (!stockAdjust.qty || parseInt(stockAdjust.qty) <= 0) {
      error('Enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      await productService.adjustStock(product._id, {
        quantity: parseInt(stockAdjust.qty),
        type: stockAdjust.type,
        reason: stockAdjust.reason
      });
      success('Stock adjusted successfully');
      setStockAdjustModal(false);
      setStockAdjust({ qty: '', type: 'in', reason: '' });
      invalidateCachePattern('products');
      loadProduct();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!product) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-slate-400 mb-6">Product not found</p>
        <Link to="/products" className="btn btn-primary">Back to Products</Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Back button */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="flex justify-between items-center mb-4">
        <Link to="/products" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>
        <EnhancedButton 
           onClick={() => setStockAdjustModal(true)} 
           icon={ArrowUpDown}
           className="bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          Adjust Stock
        </EnhancedButton>
      </motion.div>

      {/* Product Info Card */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Package className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{product.productName}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                {product.manufacturer && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> {product.manufacturer}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5" /> HSN: {product.hsnCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'MRP', value: formatCurrency(product.newMRP), icon: DollarSign, color: 'emerald' },
            { label: 'GST', value: `${product.gstPercentage}%`, icon: Percent, color: 'blue' },
            { label: 'Unit', value: product.unit || 'Pieces', icon: Ruler, color: 'purple' },
            { label: 'Current Stock', value: `${product.currentStockQty}`, icon: Layers, color: product.currentStockQty > 0 ? 'amber' : 'red' }
          ].map(stat => (
            <div key={stat.label} className={`p-4 rounded-xl bg-${stat.color}-500/10 border border-${stat.color}-500/20`}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
                <span className="text-sm text-slate-400">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={stockAdjustModal}
        onClose={() => setStockAdjustModal(false)}
        title="Adjust Product Stock"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
            Current Stock: <span className="font-bold text-white">{product.currentStockQty || 0}</span>
          </div>
          <div>
            <label className="label">Type</label>
            <select
              value={stockAdjust.type}
              onChange={(e) => setStockAdjust(prev => ({ ...prev, type: e.target.value }))}
              className="select"
            >
              <option value="in">Add Stock</option>
              <option value="out">Remove Stock</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input
              type="number"
              value={stockAdjust.qty}
              onChange={(e) => setStockAdjust(prev => ({ ...prev, qty: e.target.value }))}
              className="input"
              placeholder="Enter quantity"
              min="1"
            />
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <input
              type="text"
              value={stockAdjust.reason}
              onChange={(e) => setStockAdjust(prev => ({ ...prev, reason: e.target.value }))}
              className="input"
              placeholder="e.g., New purchase, Damaged, Expired"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setStockAdjustModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleStockAdjust} disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Adjust Stock
            </button>
          </div>
        </div>
      </Modal>

    </motion.div>
  );
}
