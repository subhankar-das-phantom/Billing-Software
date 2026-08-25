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
  Ruler,
  History,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp
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

  const { success, error } = useToast();
  const isFirstVisit = useFirstVisit('product-details');
  const { isDesktop } = useDeviceType();
  const queryClient = useQueryClient();

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

  if (loading) return <ProductDetailsPageSkeleton />;
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
      initial={isFirstVisit ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Back button */}
      <motion.div variants={cardVariants} initial={isFirstVisit ? "hidden" : false} animate="visible" className="flex justify-between items-center mb-4">
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
