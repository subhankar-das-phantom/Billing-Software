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
  Hash,
  Building2,
  Layers,
  Percent,
  DollarSign,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Barcode,
  ArrowUpDown,
  Ruler
} from 'lucide-react';
import { productService } from '../services/productService';
import { formatCurrency, formatDate, isExpired, isExpiringSoon, formatDateForInput } from '../utils/formatters';
import { GST_RATES } from '../utils/calculations';
import { PageLoader } from '../components/Common/Loader';
import Modal from '../components/Common/Modal';
import ConfirmDialog from '../components/Common/ConfirmDialog';
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

const initialBatchState = {
  batchNo: '',
  expiryDate: '',
  purchaseRate: '',
  mrp: '',
  gstPercent: 12,
  stock: ''
};

export default function ProductDetailsPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [totalStock, setTotalStock] = useState(0);

  // Modals
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchForm, setBatchForm] = useState(initialBatchState);
  const [saving, setSaving] = useState(false);

  // Stock adjust
  const [stockAdjustModal, setStockAdjustModal] = useState({ open: false, batch: null });
  const [stockAdjust, setStockAdjust] = useState({ qty: '', type: 'in', reason: '' });

  // Delete
  const [deleteDialog, setDeleteDialog] = useState({ open: false, batch: null });

  const { success, error } = useToast();

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const data = await productService.getProduct(id, false);
      setProduct(data.product);
      const productBatches = data.product.batches || [];
      setBatches(productBatches);
      // Use batch stock if batches exist, otherwise fall back to legacy currentStockQty
      setTotalStock(
        productBatches.length > 0
          ? data.product.totalBatchStock || 0
          : data.product.currentStockQty || 0
      );
    } catch (err) {
      error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const openAddBatch = () => {
    setEditingBatch(null);
    setBatchForm({ ...initialBatchState, gstPercent: product?.gstPercentage || 12 });
    setBatchModalOpen(true);
  };

  const openEditBatch = (batch) => {
    setEditingBatch(batch);
    setBatchForm({
      batchNo: batch.batchNo || '',
      expiryDate: formatDateForInput(batch.expiryDate),
      purchaseRate: batch.purchaseRate || '',
      mrp: batch.mrp || '',
      gstPercent: batch.gstPercent || 12,
      stock: batch.stock || 0
    });
    setBatchModalOpen(true);
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchForm.batchNo || !batchForm.mrp) {
      error('Batch number and MRP are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        batchNo: batchForm.batchNo,
        expiryDate: batchForm.expiryDate || undefined,
        purchaseRate: parseFloat(batchForm.purchaseRate) || 0,
        mrp: parseFloat(batchForm.mrp),
        gstPercent: parseInt(batchForm.gstPercent)
      };

      if (editingBatch) {
        await productService.updateBatch(editingBatch._id, payload);
        success('Batch updated successfully');
      } else {
        payload.stock = parseInt(batchForm.stock) || 0;
        await productService.addBatch(id, payload);
        success('Batch added successfully');
      }

      setBatchModalOpen(false);
      invalidateCachePattern('products');
      loadProduct();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to save batch');
    } finally {
      setSaving(false);
    }
  };

  const handleStockAdjust = async () => {
    if (!stockAdjust.qty || parseInt(stockAdjust.qty) <= 0) {
      error('Enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      await productService.adjustBatchStock(stockAdjustModal.batch._id, {
        quantity: parseInt(stockAdjust.qty),
        type: stockAdjust.type,
        reason: stockAdjust.reason
      });
      success('Stock adjusted successfully');
      setStockAdjustModal({ open: false, batch: null });
      setStockAdjust({ qty: '', type: 'in', reason: '' });
      invalidateCachePattern('products');
      loadProduct();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBatch = async () => {
    try {
      await productService.deleteBatch(deleteDialog.batch._id);
      success('Batch deleted successfully');
      setDeleteDialog({ open: false, batch: null });
      invalidateCachePattern('products');
      loadProduct();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to delete batch');
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
      <motion.div variants={cardVariants} initial="hidden" animate="visible">
        <Link to="/products" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>
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
            { label: 'GST', value: `${product.gstPercentage}%`, icon: Percent, color: 'blue' },
            { label: 'Unit', value: product.unit || 'Pieces', icon: Ruler, color: 'purple' },
            { label: 'Total Stock', value: `${totalStock}`, icon: Layers, color: totalStock > 0 ? 'emerald' : 'red' },
            { label: 'Batches', value: `${batches.length}`, icon: Hash, color: 'amber' }
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

      {/* Batch Inventory */}
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Batch Inventory</h2>
              <p className="text-sm text-slate-400">
                {batches.length} {batches.length === 1 ? 'batch' : 'batches'} · {totalStock} total units
              </p>
            </div>
          </div>
          <EnhancedButton onClick={openAddBatch} icon={Plus}>
            Add Batch
          </EnhancedButton>
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
              <Layers className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-400 mb-4">No batches yet. Add your first batch!</p>
            <EnhancedButton onClick={openAddBatch} icon={Plus}>Add Batch</EnhancedButton>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch No</th>
                  <th>Expiry</th>
                  <th>Purchase Rate</th>
                  <th>MRP</th>
                  <th>GST</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch, index) => {
                  const expired = batch.expiryDate && isExpired(batch.expiryDate);
                  const expiringSoon = batch.expiryDate && isExpiringSoon(batch.expiryDate);
                  const outOfStock = batch.stock === 0;

                  return (
                    <motion.tr
                      key={batch._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-slate-700/50 transition-colors"
                    >
                      <td>
                        <span className="font-mono text-white flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-slate-500" />
                          {batch.batchNo}
                        </span>
                      </td>
                      <td>
                        <span className={`badge inline-flex items-center gap-1.5 ${
                          expired ? 'badge-danger' :
                          expiringSoon ? 'badge-warning' :
                          'badge-success'
                        }`}>
                          <Calendar className="w-3 h-3" />
                          {batch.expiryDate ? formatDate(batch.expiryDate) : 'N/A'}
                        </span>
                      </td>
                      <td className="text-slate-300">{formatCurrency(batch.purchaseRate)}</td>
                      <td className="text-emerald-400 font-medium">{formatCurrency(batch.mrp)}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-1 bg-blue-500/20 rounded text-blue-400 text-sm font-medium">
                          {batch.gstPercent}%
                        </span>
                      </td>
                      <td>
                        <span className={`badge inline-flex items-center gap-1.5 ${
                          outOfStock ? 'badge-danger' :
                          batch.stock <= 30 ? 'badge-warning' :
                          'badge-success'
                        }`}>
                          <Layers className="w-3 h-3" />
                          {batch.stock}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <motion.button
                            onClick={() => openEditBatch(batch)}
                            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Edit Batch"
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            onClick={() => {
                              setStockAdjust({ qty: '', type: 'in', reason: '' });
                              setStockAdjustModal({ open: true, batch });
                            }}
                            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Adjust Stock"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            onClick={() => setDeleteDialog({ open: true, batch })}
                            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Delete Batch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Add/Edit Batch Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={editingBatch ? 'Edit Batch' : 'Add New Batch'}
        size="md"
      >
        <form onSubmit={handleBatchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-400" /> Batch No *
              </label>
              <input
                type="text"
                value={batchForm.batchNo}
                onChange={(e) => setBatchForm(prev => ({ ...prev, batchNo: e.target.value }))}
                className="input"
                placeholder="e.g., CA2434159"
                required
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" /> Expiry Date
              </label>
              <input
                type="date"
                value={batchForm.expiryDate}
                onChange={(e) => setBatchForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" /> Purchase Rate
              </label>
              <input
                type="number"
                value={batchForm.purchaseRate}
                onChange={(e) => setBatchForm(prev => ({ ...prev, purchaseRate: e.target.value }))}
                className="input"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" /> MRP *
              </label>
              <input
                type="number"
                value={batchForm.mrp}
                onChange={(e) => setBatchForm(prev => ({ ...prev, mrp: e.target.value }))}
                className="input"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Percent className="w-4 h-4 text-slate-400" /> GST %
              </label>
              <select
                value={batchForm.gstPercent}
                onChange={(e) => setBatchForm(prev => ({ ...prev, gstPercent: e.target.value }))}
                className="select"
              >
                {GST_RATES.map(rate => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </select>
            </div>
            {!editingBatch && (
              <div>
                <label className="label flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" /> Initial Stock
                </label>
                <input
                  type="number"
                  value={batchForm.stock}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, stock: e.target.value }))}
                  className="input"
                  placeholder="0"
                  min="0"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setBatchModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingBatch ? 'Update Batch' : 'Add Batch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={stockAdjustModal.open}
        onClose={() => setStockAdjustModal({ open: false, batch: null })}
        title={`Adjust Stock — ${stockAdjustModal.batch?.batchNo || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
            Current Stock: <span className="font-bold text-white">{stockAdjustModal.batch?.stock || 0}</span>
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
            <button onClick={() => setStockAdjustModal({ open: false, batch: null })} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleStockAdjust} disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Adjust Stock
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Batch Confirm */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, batch: null })}
        onConfirm={handleDeleteBatch}
        title="Delete Batch"
        message={`Are you sure you want to delete batch ${deleteDialog.batch?.batchNo}? This can only be done if the batch has 0 stock.`}
        confirmText="Delete"
        type="danger"
      />
    </motion.div>
  );
}
