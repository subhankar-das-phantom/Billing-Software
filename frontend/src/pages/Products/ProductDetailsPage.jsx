import { useState, useEffect, useCallback } from 'react';
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
  Ruler,
  History,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Box,
  AlertTriangle
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { productService } from '../../services/products/productService';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { ProductDetailsPageSkeleton } from './ProductDetailsPageSkeleton';
import { InfiniteVirtualizedList } from '../../components/Common/InfiniteVirtualizedList';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';
import Modal from '../../components/Common/Modals/Modal';
import EnhancedButton from '../../components/Common/Buttons/EnhancedButton';
import { useToast } from '../../contexts/ToastContext';
import { invalidateCachePattern, useFirstVisit, useDeviceType } from '../../hooks';
import ConfirmDialog from '../../components/Common/Dialogs/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

// Stock history movement type configuration
const STOCK_HISTORY_TYPE_CONFIG = {
  opening:                 { label: 'Opening Stock',     color: 'emerald' },
  adjustment:              { label: 'Manual Adjustment', color: 'orange' },
  invoice:                 { label: 'Invoice / Sale',    color: 'red' },
  invoice_edit:            { label: 'Stock Correction',  color: 'slate' },
  invoice_edit_reversal:   { label: 'Stock Correction',  color: 'slate' },
  invoice_cancelled:       { label: 'Invoice Cancelled', color: 'slate' },
  sales_return:            { label: 'Sales Return',      color: 'amber' }
};

const getTypeConfig = (type) => STOCK_HISTORY_TYPE_CONFIG[type] || { label: type || 'Unknown', color: 'slate' };

const getAdjustedByLabel = (adjustedBy) => {
  if (!adjustedBy) return 'System';
  if (adjustedBy.userModel) return adjustedBy.userModel;
  return 'Unknown User';
};

const EMPTY_BATCH_FORM = {
  batchNo: '',
  expiryDate: '',
  mrp: '',
  rate: '',
  gstPercent: '12',
  initialQty: ''
};

export default function ProductDetailsPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stock adjust
  const [stockAdjustModal, setStockAdjustModal] = useState(false);
  const [stockAdjust, setStockAdjust] = useState({ qty: '', type: 'in', reason: '' });

  // Stock history accordion toggle
  const [showHistory, setShowHistory] = useState(false);

  // Batch state
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [showBatches, setShowBatches] = useState(true);
  const [batchModal, setBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH_FORM);
  const [deletingBatchId, setDeletingBatchId] = useState(null);
  const [confirmDeleteBatchId, setConfirmDeleteBatchId] = useState(null);
  
  // Batch adjust
  const [batchAdjustModal, setBatchAdjustModal] = useState(false);
  const [batchAdjust, setBatchAdjust] = useState({ batchId: null, batchName: '', qty: '', type: 'in', reason: '', remainingQty: 0 });

  const { success, error } = useToast();
  const isFirstVisit = useFirstVisit('product-details');
  const { isDesktop } = useDeviceType();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const enableBatchTracking = user?.preferences?.enableBatchTracking === true;
  const isBatchMode = product?.inventoryRepresentation === 'BATCH';
  const effectiveStock = product?.effectiveStockQty ?? product?.currentStockQty ?? 0;

  useEffect(() => {
    loadProduct();
  }, [id]);

  useEffect(() => {
    if (product && enableBatchTracking) {
      loadBatches();
    }
  }, [product?._id, enableBatchTracking]);

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

  const loadBatches = async () => {
    setBatchesLoading(true);
    try {
      const data = await productService.getBatches(id);
      setBatches(data.batches || []);
    } catch (err) {
      console.error('Failed to load batches', err);
      setBatches([]);
    } finally {
      setBatchesLoading(false);
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
      // Dual invalidation: sync both product details and stock history
      queryClient.invalidateQueries({ queryKey: ['products', id, 'stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['products', id] });
      loadProduct();
    } catch (err) {
      error(err.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  // ── Batch CRUD ──────────────────────────────────────────────────────────
  const openAddBatch = () => {
    setEditingBatch(null);
    setBatchForm({
      ...EMPTY_BATCH_FORM,
      mrp: product?.newMRP?.toString() || '',
      rate: product?.rate?.toString() || '',
      gstPercent: product?.gstPercentage?.toString() || '12'
    });
    setBatchModal(true);
  };

  const openEditBatch = (batch) => {
    setEditingBatch(batch);
    setBatchForm({
      batchNo: batch.batchNo || '',
      expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().split('T')[0] : '',
      mrp: batch.mrp?.toString() || '',
      rate: batch.rate?.toString() || '',
      gstPercent: batch.gstPercent?.toString() || '12',
      initialQty: batch.initialQty?.toString() || ''
    });
    setBatchModal(true);
  };

  const handleBatchSave = async () => {
    if (!batchForm.mrp || Number(batchForm.mrp) <= 0) {
      error('MRP is required');
      return;
    }
    if (!editingBatch && (!batchForm.initialQty || Number(batchForm.initialQty) <= 0)) {
      error('Initial quantity is required for new batches');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        batchNo: batchForm.batchNo || null,
        expiryDate: batchForm.expiryDate || null,
        mrp: Number(batchForm.mrp),
        rate: Number(batchForm.rate) || 0,
        gstPercent: Number(batchForm.gstPercent),
        ...(editingBatch ? {} : { initialQty: Number(batchForm.initialQty), remainingQty: Number(batchForm.initialQty) })
      };

      if (editingBatch) {
        await productService.updateBatch(editingBatch._id, payload);
        success('Batch updated');
      } else {
        await productService.addBatch(product._id, payload);
        success('Batch added');
      }

      setBatchModal(false);
      setEditingBatch(null);
      setBatchForm(EMPTY_BATCH_FORM);
      invalidateCachePattern('products');
      loadProduct();
      loadBatches();
    } catch (err) {
      error(err?.response?.data?.message || err.message || 'Failed to save batch');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteBatch = (batchId) => {
    setConfirmDeleteBatchId(batchId);
  };

  const handleDeleteBatch = async () => {
    if (!confirmDeleteBatchId) return;
    
    setDeletingBatchId(confirmDeleteBatchId);
    try {
      await productService.deleteBatch(confirmDeleteBatchId);
      success('Batch deleted');
      invalidateCachePattern('products');
      loadProduct();
      loadBatches();
    } catch (err) {
      error(err?.response?.data?.message || err.message || 'Failed to delete batch');
    } finally {
      setDeletingBatchId(null);
      setConfirmDeleteBatchId(null);
    }
  };

  const handleBatchAdjustStock = async (e) => {
    e.preventDefault();
    const adjustQty = Number(batchAdjust.qty);
    if (!batchAdjust.qty || isNaN(batchAdjust.qty) || adjustQty <= 0) {
      error('Please enter a valid quantity');
      return;
    }
    if (batchAdjust.type === 'out' && adjustQty > batchAdjust.remainingQty) {
      error(`Cannot remove more than available stock (${batchAdjust.remainingQty})`);
      return;
    }
    setSaving(true);
    try {
      await productService.adjustBatchStock(batchAdjust.batchId, {
        quantity: Number(batchAdjust.qty),
        type: batchAdjust.type,
        reason: batchAdjust.reason
      });
      success('Batch stock adjusted');
      setBatchAdjustModal(false);
      setBatchAdjust({ batchId: null, batchName: '', qty: '', type: 'in', reason: '', remainingQty: 0 });
      invalidateCachePattern('products');
      loadProduct();
      loadBatches();
    } catch (err) {
      error(err?.response?.data?.message || err.message || 'Failed to adjust batch stock');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ProductDetailsPageSkeleton />;
  if (!product) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-slate-400 mb-6">Product not found</p>
        <Link to="/products" className="btn btn-primary">Back to Products</Link>
      </div>
    );
  }

  const activeBatches = batches.filter(b => b.isActive && b.remainingQty > 0);
  const depletedBatches = batches.filter(b => !b.isActive || b.remainingQty <= 0);

  return (
    <motion.div
      initial={isFirstVisit ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Back button + Actions */}
      <motion.div variants={cardVariants} initial={isFirstVisit ? "hidden" : false} animate="visible" className="flex justify-between items-center mb-4">
        <Link to="/products" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>
        <div className="flex items-center gap-2">
          {enableBatchTracking && (
            <EnhancedButton
              onClick={openAddBatch}
              icon={Plus}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Add Batch
            </EnhancedButton>
          )}
          {!isBatchMode && (
            <EnhancedButton 
               onClick={() => setStockAdjustModal(true)} 
               icon={ArrowUpDown}
               className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Adjust Stock
            </EnhancedButton>
          )}
        </div>
      </motion.div>

      {/* Product Info Card */}
      <motion.div variants={cardVariants} initial={isFirstVisit ? "hidden" : false} animate="visible" className="glass-card p-6">
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
                {enableBatchTracking && (
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    isBatchMode 
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' 
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  }`}>
                    <Layers className="w-3 h-3" />
                    {isBatchMode ? 'Batch Mode' : 'Free Stock'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'MRP', value: formatCurrency(product.newMRP), icon: DollarSign, color: 'emerald' },
            { label: 'Rate', value: formatCurrency(product.rate), icon: DollarSign, color: 'violet' },
            { label: 'GST', value: `${product.gstPercentage}%`, icon: Percent, color: 'blue' },
            { label: 'Unit', value: product.unit || 'Pieces', icon: Ruler, color: 'accent' },
            { label: isBatchMode ? 'Batch Stock' : 'Current Stock', value: `${effectiveStock}`, icon: Layers, color: effectiveStock > 0 ? 'amber' : 'red' }
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

      {/* Batches Section — only when batch tracking is enabled */}
      {enableBatchTracking && (
        <motion.div variants={cardVariants} initial={isFirstVisit ? "hidden" : false} animate="visible" className="glass-card p-6">
          <button
            type="button"
            onClick={() => setShowBatches(prev => !prev)}
            className="w-full flex items-center justify-between group focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                <Box className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-white group-hover:text-blue-200 transition-colors">
                  Batches
                </h2>
                <p className="text-xs text-slate-500">
                  {activeBatches.length} active · {depletedBatches.length} depleted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400 group-hover:text-white transition-colors">
              <span>{showBatches ? 'Hide' : 'Show'}</span>
              {showBatches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          <AnimatePresence>
            {showBatches && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-5"
              >
                {batchesLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <ShimmerBone key={i} className="h-16 rounded-xl" />)}
                  </div>
                ) : batches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-700 rounded-xl">
                    <Box className="w-10 h-10 text-slate-600 mb-4" />
                    <p className="text-slate-400 font-medium mb-1">No batches yet</p>
                    <p className="text-slate-500 text-sm max-w-md mb-4">
                      Add a batch to start tracking inventory with FIFO allocation.
                    </p>
                    <EnhancedButton onClick={openAddBatch} icon={Plus} className="bg-blue-500 hover:bg-blue-600 text-white">
                      Add First Batch
                    </EnhancedButton>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Active batches */}
                    {activeBatches.map(batch => (
                      <div key={batch._id} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:border-slate-600/60 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-emerald-500/15 rounded-lg flex-shrink-0">
                              <Box className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-white truncate">
                                  {batch.batchNo && batch.batchNo !== 'UNNAMED' ? batch.batchNo : 'No Batch #'}
                                </span>
                                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                  {batch.remainingQty} left
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span>MRP: {formatCurrency(batch.mrp)}</span>
                                <span>Rate: {formatCurrency(batch.rate)}</span>
                                <span>GST: {batch.gstPercent}%</span>
                                {batch.expiryDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(batch.expiryDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                            <button
                              onClick={() => {
                                setBatchAdjust({ 
                                  batchId: batch._id, 
                                  batchName: batch.batchNo && batch.batchNo !== 'UNNAMED' ? batch.batchNo : 'No Batch #', 
                                  qty: '', 
                                  type: 'in', 
                                  reason: '',
                                  remainingQty: batch.remainingQty
                                });
                                setBatchAdjustModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                              title="Adjust stock"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditBatch(batch)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                              title="Edit batch"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => confirmDeleteBatch(batch._id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Depleted batches (collapsed) */}
                    {depletedBatches.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Depleted / Inactive</p>
                        {depletedBatches.map(batch => (
                          <div key={batch._id} className="p-3 bg-slate-800/20 border border-slate-700/30 rounded-lg mb-1.5 opacity-60">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-400">
                                  {batch.batchNo && batch.batchNo !== 'UNNAMED' ? batch.batchNo : 'No Batch #'}
                                </span>
                                <span className="text-xs text-slate-600">
                                  {batch.remainingQty} left
                                </span>
                                {batch.expiryDate && (
                                  <span className="text-xs text-slate-600">· Exp: {formatDate(batch.expiryDate)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBatchAdjust({ 
                                      batchId: batch._id, 
                                      batchName: batch.batchNo && batch.batchNo !== 'UNNAMED' ? batch.batchNo : 'No Batch #', 
                                      qty: '', 
                                      type: 'in', 
                                      reason: '',
                                      remainingQty: batch.remainingQty
                                    });
                                    setBatchAdjustModal(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-md transition-colors"
                                  title="Adjust stock"
                                >
                                  <ArrowUpDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditBatch(batch); }}
                                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                  title="Edit batch"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); confirmDeleteBatch(batch._id); }}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors disabled:opacity-50"
                                  title="Delete batch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Stock History Section */}
      <motion.div variants={cardVariants} initial={isFirstVisit ? "hidden" : false} animate="visible" className="glass-card p-6">
        <button
          type="button"
          onClick={() => setShowHistory(prev => !prev)}
          className="w-full flex items-center justify-between group focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg group-hover:bg-violet-500/30 transition-colors">
              <History className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-white group-hover:text-violet-200 transition-colors">Stock History</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400 group-hover:text-white transition-colors">
            <span>{showHistory ? 'Hide History' : 'View History'}</span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-5"
            >
              {/* Desktop table header */}
              {isDesktop && (
                <div className="grid grid-cols-[160px_150px_100px_130px_1fr_100px] gap-2 px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1">
                  <div>Date / Time</div>
                  <div>Type</div>
                  <div>Change</div>
                  <div>Stock Level</div>
                  <div>Reference</div>
                  <div>By</div>
                </div>
              )}

              <InfiniteVirtualizedList
                enabled={showHistory}
                queryKey={['products', id, 'stock-history']}
                queryFn={({ pageParam }) =>
                  productService.getStockHistory(id, {
                    ...(pageParam && typeof pageParam === 'string' ? { before: pageParam } : {}),
                    limit: 20
                  })
                }
                getNextPageParam={(lastPage) =>
                  lastPage.pagination?.hasMore
                    ? lastPage.pagination.nextCursor
                    : undefined
                }
                staleTime={30_000}
                overscan={5}
                estimateSize={() => isDesktop ? 64 : 160}
                getKey={(item) => item._id}
                className={isDesktop ? 'min-h-[64px]' : 'min-h-[160px]'}
                itemClassName={isDesktop ? '' : 'mb-3'}
                emptyState={
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-700 rounded-xl">
                    <History className="w-10 h-10 text-slate-600 mb-4" />
                    <p className="text-slate-400 font-medium mb-1">No stock movements have been recorded yet.</p>
                    <p className="text-slate-500 text-sm max-w-md">
                      Invoices, purchases, returns and manual stock adjustments will appear here as they occur.
                    </p>
                  </div>
                }
                renderItem={(entry) => {
                  if (!entry) return null;
                  const config = getTypeConfig(entry.type);
                  const isPositive = entry.changeQty > 0;
                  const changePrefix = isPositive ? '+' : '';
                  const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400';
                  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;
                  const byLabel = getAdjustedByLabel(entry.adjustedBy);
                  const isoTimestamp = entry.timestamp ? new Date(entry.timestamp).toISOString() : '';

                  const referenceContent = entry.invoiceId ? (
                    <Link
                      to={`/invoices/${entry.invoiceId}`}
                      className="text-blue-400 hover:text-blue-300 hover:underline transition-colors truncate"
                    >
                      {entry.reference || 'View Invoice'}
                    </Link>
                  ) : (
                    <span className="text-slate-300 truncate">{entry.reference || '-'}</span>
                  );

                  // Desktop: table row
                  if (isDesktop) {
                    return (
                      <div className="grid grid-cols-[160px_150px_100px_130px_1fr_100px] gap-2 items-center px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <div className="text-sm text-slate-300" title={isoTimestamp}>
                          {formatDateTime(entry.timestamp)}
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-${config.color}-500/15 text-${config.color}-400 border border-${config.color}-500/20`}>
                            {config.label}
                          </span>
                        </div>
                        <div className={`font-semibold text-sm flex items-center gap-1 ${changeColor}`}>
                          <ChangeIcon className="w-3.5 h-3.5" />
                          {changePrefix}{entry.changeQty}
                        </div>
                        <div className="text-sm text-slate-400">
                          {entry.previousQty ?? '-'} → <span className="text-white font-medium">{entry.newQty ?? '-'}</span>
                        </div>
                        <div className="text-sm truncate">
                          {referenceContent}
                        </div>
                        <div className="text-xs text-slate-500">
                          {byLabel}
                        </div>
                      </div>
                    );
                  }

                  // Mobile: card layout
                  return (
                    <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-${config.color}-500/15 text-${config.color}-400 border border-${config.color}-500/20`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-slate-500" title={isoTimestamp}>
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={`text-xl font-bold flex items-center gap-1.5 ${changeColor}`}>
                          <ChangeIcon className="w-5 h-5" />
                          {changePrefix}{entry.changeQty}
                        </div>
                        <div className="text-sm text-slate-400">
                          {entry.previousQty ?? '-'} → <span className="text-white font-medium">{entry.newQty ?? '-'}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="truncate flex-1 mr-3">{referenceContent}</div>
                        <span className="text-xs text-slate-500 flex-shrink-0">{byLabel}</span>
                      </div>
                    </div>
                  );
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stock Adjustment Modal (only for FREE stock mode) */}
      <Modal
        isOpen={stockAdjustModal}
        onClose={() => setStockAdjustModal(false)}
        title="Adjust Product Stock"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
            Current Stock: <span className="font-bold text-white">{effectiveStock}</span>
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

      {/* Add / Edit Batch Modal */}
      <Modal
        isOpen={batchModal}
        onClose={() => { setBatchModal(false); setEditingBatch(null); }}
        title={editingBatch ? 'Edit Batch' : 'Add New Batch'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Batch Number</label>
              <input
                type="text"
                value={batchForm.batchNo}
                onChange={(e) => setBatchForm(prev => ({ ...prev, batchNo: e.target.value }))}
                className="input"
                placeholder="e.g., B001"
              />
            </div>
            <div>
              <label className="label">Expiry Date</label>
              <input
                type="date"
                value={batchForm.expiryDate}
                onChange={(e) => setBatchForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">MRP *</label>
              <input
                type="number"
                value={batchForm.mrp}
                onChange={(e) => setBatchForm(prev => ({ ...prev, mrp: e.target.value }))}
                className="input"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="label">Rate</label>
              <input
                type="number"
                value={batchForm.rate}
                onChange={(e) => setBatchForm(prev => ({ ...prev, rate: e.target.value }))}
                className="input"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="label">GST %</label>
              <select
                value={batchForm.gstPercent}
                onChange={(e) => setBatchForm(prev => ({ ...prev, gstPercent: e.target.value }))}
                className="select"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>
          {!editingBatch && (
            <div>
              <label className="label">Initial Quantity *</label>
              <input
                type="number"
                value={batchForm.initialQty}
                onChange={(e) => setBatchForm(prev => ({ ...prev, initialQty: e.target.value }))}
                className="input"
                placeholder="Enter quantity"
                min="1"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setBatchModal(false); setEditingBatch(null); }} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleBatchSave} disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingBatch ? 'Update Batch' : 'Add Batch'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Batch Adjust Modal */}
      <Modal isOpen={batchAdjustModal} onClose={() => setBatchAdjustModal(false)} title="Adjust Batch Stock">
        <form onSubmit={handleBatchAdjustStock} className="p-4 space-y-4">
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <p className="text-sm text-slate-400 mb-1">Adjusting Batch</p>
            <p className="font-medium text-white">{batchAdjust.batchName}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBatchAdjust(prev => ({ ...prev, type: 'in' }))}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${batchAdjust.type === 'in' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}
                >
                  Stock In
                </button>
                <button
                  type="button"
                  onClick={() => setBatchAdjust(prev => ({ ...prev, type: 'out' }))}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${batchAdjust.type === 'out' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}
                >
                  Stock Out
                </button>
              </div>
            </div>
            <div>
              <label className="label">Quantity {batchAdjust.type === 'out' && <span className="text-slate-500 font-normal">(Max: {batchAdjust.remainingQty})</span>}</label>
              <input
                type="number"
                value={batchAdjust.qty}
                onChange={(e) => setBatchAdjust(prev => ({ ...prev, qty: e.target.value }))}
                className="input"
                placeholder="Enter quantity"
                min="1"
                max={batchAdjust.type === 'out' ? batchAdjust.remainingQty : undefined}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Reason (Optional)</label>
            <input
              type="text"
              value={batchAdjust.reason}
              onChange={(e) => setBatchAdjust(prev => ({ ...prev, reason: e.target.value }))}
              className="input"
              placeholder="e.g. Damage, Return, Count mismatch"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setBatchAdjustModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Adjust Stock
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteBatchId}
        onClose={() => setConfirmDeleteBatchId(null)}
        onConfirm={handleDeleteBatch}
        title="Delete Batch"
        message="Are you sure you want to delete this batch? This action cannot be undone."
        confirmText="Delete"
        isDanger={true}
        loading={!!deletingBatchId}
      />
    </motion.div>
  );
}
