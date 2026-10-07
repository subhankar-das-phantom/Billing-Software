import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  Barcode,
  Building2,
  Box,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  Loader2,
  Hash,
  Layers,
  Percent,
  Ruler,
  Eye,
  Download
} from 'lucide-react';
import { productService } from '../../services/products/productService';
import { formatCurrency, formatDateForInput } from '../../utils/formatters';
import { GST_RATES } from '../../utils/calculations';
import { ProductsPageSkeleton } from './ProductsPageSkeleton';
import Modal from '../../components/Common/Modals/Modal';
import ConfirmDialog from '../../components/Common/Dialogs/ConfirmDialog';
import EnhancedButton from '../../components/Common/Buttons/EnhancedButton';
import { VirtualizedList } from '../../components/Common/VirtualizedList';
import ExportModal from '../../components/Common/Modals/ExportModal';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce, useMotionConfig, useFirstVisit, useSWR, invalidateCachePattern, useMediaQuery, useTransitionDelay, useQueryAccumulatedList, useListFilterParams } from '../../hooks';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import { useInfiniteScrollSentinel } from '../../utils/scrollUtils';

// Helper to create adaptive variants - faster on mobile
const createPageVariants = (isMobile, shouldStagger) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: shouldStagger ? 0.08 : 0,
      delayChildren: 0  // No delay
    }
  }
});

const createCardVariants = (isMobile) => ({
  hidden: { opacity: 0, y: isMobile ? 10 : 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: isMobile
      ? { type: 'tween', duration: 0.15, ease: 'easeOut' }  // Faster
      : { type: 'spring', stiffness: 300, damping: 24 }
  }
});

const createTableRowVariants = (isMobile, shouldStagger) => ({
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: shouldStagger ? i * 0.03 : 0,
      type: isMobile ? 'tween' : 'spring',
      duration: isMobile ? 0.2 : undefined,
      stiffness: isMobile ? undefined : 300,
      damping: isMobile ? undefined : 24
    }
  })
});

const createFormItemVariants = (shouldStagger) => ({
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: shouldStagger ? i * 0.05 : 0,
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  })
});

const initialProductState = {
  productName: '',
  hsnCode: '',
  manufacturer: '',
  batchNo: '',
  expiryDate: '',
  oldMRP: '',
  newMRP: '',
  rate: '',
  gstPercentage: '',
  openingStockQty: '',
  unit: 'Pieces'
};

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  })
};

const formItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  })
};

// ✅ FIX #1: Separate component for empty state
const EmptyProductsState = ({ search, onAddClick }) => (
  <motion.div
    key="empty-state"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.3 }}
    className="glass-card p-12 text-center"
  >
    <motion.div
      className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
    >
      <Package className="w-10 h-10 text-slate-400" />
    </motion.div>
    <motion.p
      className="text-slate-400 mb-6 text-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {search ? 'No products found matching your search' : 'No products found. Add your first product!'}
    </motion.p>
    {!search && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <EnhancedButton
          onClick={onAddClick}
          icon={Plus}
        >
          Add Product
        </EnhancedButton>
      </motion.div>
    )}
  </motion.div>
);

// ✅ FIX #2: Separate component for table - simplified for mobile
const ProductsTable = ({ filteredProducts, onEdit, onDelete, formatCurrency, observerTarget, hasMore, isLoadingMore, isDesktop, currentPath }) => (
  <div className="space-y-4">
    {/* Desktop/Tablet Table View */}
    {isDesktop ? (
    <div className="glass-card w-full overflow-x-auto overflow-y-hidden" data-horizontal-table-scroll="true">
      <div className="min-w-[800px]">
        {/* Header Row */}
      <div className="grid grid-cols-[minmax(260px,2fr)_120px_180px_120px_100px_150px_130px] items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 bg-slate-800/50">
        <div>Product Name</div>
        <div className="text-center">HSN</div>
        <div className="text-right">MRP</div>
        <div className="text-right">Rate</div>
        <div className="text-center">GST</div>
        <div className="text-center">Stock</div>
        <div className="text-center">Actions</div>
      </div>
      {/* Data Rows */}
      <div>
                <VirtualizedList
                  items={filteredProducts}
                  estimateSize={() => 57}
                  getKey={(product) => product._id}
                  className="min-h-[57px]"
                  itemClassName="border-b border-slate-700/50"
                  renderItem={(product) => {
                    const effectiveStock = product.effectiveStockQty ?? product.currentStockQty ?? 0;
                    const lowStock = effectiveStock <= 30;
                    const outOfStock = effectiveStock === 0;

                    return (
                      <div className="grid grid-cols-[minmax(260px,2fr)_120px_180px_120px_100px_150px_130px] items-center px-4 py-3 hover:bg-slate-700/50 transition-colors">
                        <div>
                          <Link to={`/products/${product._id}`} state={{ from: currentPath }} className="flex items-center gap-3 group">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                              <Package className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-100 group-hover:text-blue-400 transition-colors">{product.productName}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                <Building2 className="w-3 h-3" />
                                {product.manufacturer}
                              </p>
                            </div>
                          </Link>
                        </div>
                        <div className="text-slate-300 font-mono text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Barcode className="w-4 h-4 text-slate-500" />
                            {product.hsnCode}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {product.oldMRP > 0 && product.oldMRP !== product.newMRP && (
                              <span className="text-slate-500 line-through text-sm flex items-center gap-1">
                                {product.oldMRP > product.newMRP ? (
                                  <TrendingDown className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <TrendingUp className="w-3 h-3 text-red-400" />
                                )}
                                {formatCurrency(product.oldMRP)}
                              </span>
                            )}
                            <span className="text-emerald-400 font-medium">
                              {formatCurrency(product.newMRP)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-blue-400 font-medium">
                            {formatCurrency(product.rate)}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="inline-flex items-center px-2 py-1 bg-blue-500/20 rounded text-blue-400 text-sm font-medium">
                            {product.gstPercentage}%
                          </span>
                        </div>
                        <div className="text-center">
                          <span
                            className={`badge inline-flex items-center gap-1.5 ${outOfStock ? 'badge-danger' :
                              lowStock ? 'badge-warning' :
                                'badge-success'
                              }`}
                          >
                            <Layers className="w-3 h-3" />
                            {effectiveStock} {product.unit}
                          </span>
                        </div>
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => onEdit(product)}
                            className="p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-700 hover:text-blue-400 border border-transparent hover:border-slate-600 transition-all hover:scale-110 active:scale-95 tooltip-trigger relative"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                          </button>
                          <button
                            onClick={() => onDelete(product)}
                            className="p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-700 hover:text-red-400 border border-transparent hover:border-slate-600 transition-all hover:scale-110 active:scale-95 tooltip-trigger relative"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    );
                  }}
                />
      </div>
      </div>
    </div>
    ) : (
    /* Mobile Card View */
    <VirtualizedList
      items={filteredProducts}
      estimateSize={() => 220}
      getKey={(product) => product._id}
      gap={16}
      className="min-h-[220px]"
      renderItem={(product) => {
        const effectiveStock = product.effectiveStockQty ?? product.currentStockQty ?? 0;
        const lowStock = effectiveStock <= 30;
        const outOfStock = effectiveStock === 0;

        return (
          <div className="glass-card p-4 flex flex-col gap-4 relative overflow-hidden">
            {/* Product Info Section */}
            <div className="flex justify-between items-start gap-3">
              <Link to={`/products/${product._id}`} state={{ from: currentPath }} className="flex gap-3 flex-1 group">
                <div className="p-2.5 bg-blue-500/20 rounded-xl shrink-0 h-fit">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors text-base truncate mb-1">
                    {product.productName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[120px]">{product.manufacturer}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Barcode className="w-3.5 h-3.5" />
                      <span>{product.hsnCode}</span>
                    </span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Pricing & Stock Grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50 bg-slate-800/30 -mx-4 px-4 pb-1">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Price Details</p>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-emerald-400 font-semibold text-sm">
                      {formatCurrency(product.newMRP)}
                    </span>
                    {product.oldMRP > 0 && product.oldMRP !== product.newMRP && (
                      <span className="text-slate-500 line-through text-xs">
                        {formatCurrency(product.oldMRP)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Rate: <span className="text-blue-400 font-medium">{formatCurrency(product.rate)}</span></span>
                  </div>
                  <div>
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-400 text-[10px] font-medium border border-blue-500/20">
                      GST: {product.gstPercentage}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col items-end">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Stock Status</p>
                <span
                  className={`badge inline-flex items-center gap-1.5 px-2 py-1 text-xs ${outOfStock ? 'badge-danger' :
                    lowStock ? 'badge-warning' :
                      'badge-success'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="font-medium">{effectiveStock}</span>
                  <span className="text-[10px] opacity-90">{product.unit}</span>
                </span>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-2 pt-1 border-t border-slate-700/50 mt-1">
              <button
                onClick={() => onEdit(product)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-blue-400 border border-slate-700 hover:border-blue-500/30 transition-all text-sm font-medium active:scale-[0.98]"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => onDelete(product)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-all text-sm font-medium active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        );
      }}
    />
    )}

    {/* Persistent Sentinel Container (stays mounted in DOM; visibility toggles smoothly) */}
    <div
      ref={observerTarget}
      className={`w-full flex items-center justify-center p-4 min-h-[48px] my-2 transition-all ${
        !hasMore ? 'hidden pointer-events-none' : ''
      }`}
    >
      {isLoadingMore ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mr-3" />
          <span className="text-sm font-medium text-slate-300">Loading more products...</span>
        </div>
      ) : (
        <div className="h-6 w-full opacity-0 pointer-events-none" aria-hidden="true" />
      )}
    </div>
  </div>
);

export default function ProductsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { params: filterParams, setParam } = useListFilterParams({ search: '', stock: 'all' });
  const urlSearch = filterParams.search;
  const filterStock = filterParams.stock;

  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [debouncedSearch, flushSearch] = useDebounce(searchInput);
  const [searchFocused, setSearchFocused] = useState(false);
  const lastSyncedSearchRef = useRef(urlSearch);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(initialProductState);
  const [saving, setSaving] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, product: null });
  const [stockAdjustment, setStockAdjustment] = useState({ qty: '', reason: 'add' });
  const { success, error } = useToast();
  const isFirstVisit = useFirstVisit('products');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const transitionReady = useTransitionDelay(250, isFirstVisit);

  // Sync debounced search to URL
  useEffect(() => {
    setParam('search', debouncedSearch);
    lastSyncedSearchRef.current = debouncedSearch;
  }, [debouncedSearch, setParam]);

  // Sync external URL changes (e.g. browser Back/Forward or direct link) into searchInput
  useEffect(() => {
    if (urlSearch !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = urlSearch;
      setSearchInput(urlSearch);
    }
  }, [urlSearch]);

  // Auto-open Add Product modal if deep-linked: ?action=new&name=...
  useEffect(() => {
    const action = searchParams.get('action');
    const name = searchParams.get('name');
    if (action === 'new' || action === 'add') {
      setEditingProduct(null);
      setFormData({
        ...initialProductState,
        productName: name ? decodeURIComponent(name) : ''
      });
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Infinite Scroll State
  const [page, setPage] = useState(1);
  const observer = useRef(null);

  const currentQueryKey = urlSearch || '';
  const [isFetching, setIsFetching] = useState(false);
  const isFetchingRef = useRef(false);
  const pendingPageRef = useRef(null);

  // State synchronization refs
  const hasMoreRef = useRef(false);
  const isValidatingRef = useRef(false);
  const loadNextPageRef = useRef(null);

  // SWR: Instant cached data + background revalidation
  const { data, isLoading, isValidating, error: swrError, mutate } = useSWR(
    `products-${currentQueryKey}-${page}`,
    async () => {
      const res = await productService.getProducts({ search: urlSearch, page, limit: 25 });
      return { ...res, _queryKey: currentQueryKey, _page: page };
    },
    { ttl: 5 * 60 * 1000 } // 5 minute cache
  );

  // Track whether any data has ever loaded — used to distinguish initial page
  // load (show full ProductsPageSkeleton) from search transitions (show inline
  // loading in the results area only, keeping the page shell mounted).
  const hasInitialDataRef = useRef(false);
  if (data && !hasInitialDataRef.current) {
    hasInitialDataRef.current = true;
  }

  const {
    items: products,
    hasCurrentPageData,
  } = useQueryAccumulatedList({
    queryKey: currentQueryKey,
    page,
    data,
    itemsKey: 'products',
  });
  const currentPageData = hasCurrentPageData ? data : null;

  // SWR: Global Stats
  const { data: statsData, mutate: mutateStats } = useSWR(
    'products-stats-global',
    () => productService.getProductStats(),
    { ttl: 5 * 60 * 1000 } // 5 minute cache
  );

  const hasMore = currentPageData?.pages ? page < currentPageData.pages : false;

  // Keep synchronization refs up-to-date
  hasMoreRef.current = hasMore;
  isValidatingRef.current = isValidating;

  // Reset pagination when debounced search or stock filter changes
  useEffect(() => {
    setPage(1);
    pendingPageRef.current = null;
    isFetchingRef.current = false;
    setIsFetching(false);
  }, [currentQueryKey, filterStock]);

  // Release the pagination lock only after the current query's page completes.
  useEffect(() => {
    if (!currentPageData) return;
    if (pendingPageRef.current !== null && currentPageData._page === pendingPageRef.current) {
      isFetchingRef.current = false;
      setIsFetching(false);
      pendingPageRef.current = null;
    }
  }, [currentPageData]);

  // Failure Path: Release lock on request error so infinite scroll is not permanently disabled
  useEffect(() => {
    if (swrError && pendingPageRef.current !== null) {
      isFetchingRef.current = false;
      setIsFetching(false);
      pendingPageRef.current = null;
    }
  }, [swrError]);

  // Dedicated load trigger function controlling pagination and synchronous request lock
  const loadNextPage = useCallback(() => {
    if (isFetchingRef.current || isValidatingRef.current || !hasMoreRef.current) return;
    isFetchingRef.current = true;
    setIsFetching(true);
    pendingPageRef.current = page + 1;
    setPage(p => p + 1);
  }, [page]);
  loadNextPageRef.current = loadNextPage;

  // Level-triggered reactive infinite scroll sentinel
  const { sentinelRef } = useInfiniteScrollSentinel({
    hasMore,
    isFetching,
    isValidating,
    onLoadMore: loadNextPage
  });

  // Initial load: full skeleton only when NO data has ever loaded (first mount)
  const initialLoading = !hasInitialDataRef.current && isLoading && products.length === 0;
  // Search transition: data has loaded before, but a new query is pending
  const searchLoading = hasInitialDataRef.current && isLoading && products.length === 0;

  const handleSearch = (e) => {
    e.preventDefault();
    flushSearch();
    setParam('search', searchInput);
    lastSyncedSearchRef.current = searchInput;
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    lastSyncedSearchRef.current = '';
    setParam('search', '');
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(initialProductState);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setStockAdjustment({ qty: '', reason: 'add' });
    setFormData({
      productName: product.productName || '',
      hsnCode: product.hsnCode || '',
      manufacturer: product.manufacturer || '',
      batchNo: product.batchNo || '',
      expiryDate: formatDateForInput(product.expiryDate),
      oldMRP: product.oldMRP || '',
      newMRP: product.newMRP || '',
      rate: product.rate || '',
      gstPercentage: product.gstPercentage ?? 12,
      openingStockQty: product.openingStockQty || '',
      unit: product.unit || 'Pieces'
    });
    setModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting form:', formData);
    // In edit mode, only require catalog fields
    if (editingProduct) {
      if (!formData.productName || !formData.hsnCode) {
        error('Please fill all required fields');
        return;
      }
    } else {
      if (!formData.productName || !formData.hsnCode || !formData.newMRP || formData.gstPercentage === '') {
        error('Please fill all required fields');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        oldMRP: parseFloat(formData.oldMRP) || 0,
        newMRP: parseFloat(formData.newMRP),
        rate: parseFloat(formData.rate),
        gstPercentage: parseInt(formData.gstPercentage),
        openingStockQty: parseInt(formData.openingStockQty) || 0
      };

      if (editingProduct) {
        // In edit mode, only send catalog fields
        const editPayload = {
          productName: formData.productName,
          hsnCode: formData.hsnCode,
          manufacturer: formData.manufacturer,
          gstPercentage: parseInt(formData.gstPercentage),
          unit: formData.unit,
          newMRP: parseFloat(formData.newMRP),
          rate: parseFloat(formData.rate),
          batchNo: formData.batchNo || '',
          expiryDate: formData.expiryDate || null
        };
        await productService.updateProduct(editingProduct._id, editPayload);

        success('Product updated successfully');
      } else {
        await productService.createProduct(payload);
        success('Product created successfully');
      }

      setModalOpen(false);
      // Invalidate products cache and revalidate
      invalidateCachePattern('products');
      setPage(1);
      mutate();
      mutateStats();
    } catch (err) {
      console.error('Save error:', err);
      const resData = err.response?.data;
      if (resData?.errors && resData.errors.length > 0) {
        const errorMessages = resData.errors.map(e => e.message).join(', ');
        error(`Validation failed: ${errorMessages}`);
      } else {
        error(resData?.message || 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await productService.deleteProduct(deleteDialog.product._id);
      success('Product deleted successfully');
      setDeleteDialog({ open: false, product: null });
      // Invalidate products cache and revalidate
      invalidateCachePattern('products');
      setPage(1);
      mutate();
      mutateStats();
    } catch (err) {
      error(err.message || 'Failed to delete product');
    }
  };

  // ✅ FIX #3: Memoize filtering to prevent unnecessary re-renders
  const filteredProducts = products.filter(product => {
    if (filterStock === 'low') return product.currentStockQty <= 30 && product.currentStockQty > 0;
    if (filterStock === 'out') return product.currentStockQty === 0;
    return true;
  });

  const handleExport = async ({ format, dateRange }) => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const params = { format };
      if (urlSearch) params.search = urlSearch;
      if (filterStock !== 'all') params.stockFilter = filterStock;

      const blob = await productService.exportProducts(params);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const extensionMap = { excel: 'xlsx', pdf: 'pdf', csv: 'csv' };
      const extension = extensionMap[format] || 'xlsx';
      
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      link.download = `products_export_${y}-${m}-${d}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setShowExportModal(false);
      success(`Successfully exported products as ${format.toUpperCase()}`);
    } catch (err) {
      error(err.message || 'Failed to export products');
    } finally {
      setIsExporting(false);
    }
  };

  const exportStats = {
    total: filteredProducts.length
  };

  const stats = {
    total: statsData?.total || 0,
    lowStock: statsData?.lowStock || 0,
    outOfStock: statsData?.outOfStock || 0,
    expiringSoon: statsData?.expiringSoon || 0
  };

  if (initialLoading) {
    return <ProductsPageSkeleton />;
  }

  // ✅ FIX #4: Use unique key based on filter state (excluding search and
  // length to prevent table remounts during search transitions or infinite scroll)
  const tableKey = `products-${filterStock}`;

  return (
    <motion.div
      variants={pageVariants}
      initial={isFirstVisit ? "hidden" : false}
      animate="visible"
      className="space-y-6"
    >
      {/* Stats Cards - compact 2x2 grid on mobile for high viewport density */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          {
            label: 'Total Products',
            value: stats.total,
            icon: Package,
            color: 'text-blue-400',
            bg: 'bg-blue-500/20'
          },
          {
            label: 'Low Stock',
            value: stats.lowStock,
            icon: AlertTriangle,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/20'
          },
          {
            label: 'Out of Stock',
            value: stats.outOfStock,
            icon: X,
            color: 'text-red-400',
            bg: 'bg-red-500/20'
          },
          {
            label: 'Expiring Soon',
            value: stats.expiringSoon,
            icon: Clock,
            color: 'text-orange-400',
            bg: 'bg-orange-500/20'
          }
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={cardVariants}
            className="glass-card p-3 sm:p-5 lg:p-6 cursor-pointer group hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-1">
                <p className="text-[11px] sm:text-xs lg:text-sm text-slate-400 mb-0.5 sm:mb-1 truncate">{stat.label}</p>
                <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono text-slate-100">{stat.value}</p>
              </div>
              <div className={`p-1.5 sm:p-2.5 lg:p-3 rounded-lg sm:rounded-xl shrink-0 ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Header & Filters */}
      <motion.div variants={cardVariants} className="glass-card p-3.5 sm:p-6">
        <div className="flex flex-row justify-between items-center mb-3 sm:mb-6 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-1">
            <div className="p-2 sm:p-2.5 bg-slate-800 border border-slate-700/60 rounded-lg text-blue-400 shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-semibold text-slate-100 truncate">All Products</h2>
              <p className="text-xs sm:text-sm text-slate-400 truncate">
                Showing {filteredProducts.length} of {currentPageData?.total || 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowExportModal(true)}
              className="p-2 sm:px-4 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs border-0 active:scale-[0.98] transition-all"
              title="Export Products"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <EnhancedButton
              onClick={openCreateModal}
              icon={Plus}
              className="!px-2.5 !py-2 sm:!px-4 sm:!py-2.5 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </EnhancedButton>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <motion.div
              className="relative flex-1 rounded-lg"
              animate={searchFocused ? { boxShadow: '0 0 0 2px rgba(59,130,246,0.5)' } : { boxShadow: '0 0 0 0px rgba(59,130,246,0)' }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search products..."
                className="input pl-9 sm:pl-10 w-full text-xs sm:text-sm py-2 sm:py-2.5"
              />
              <AnimatePresence>
                {searchInput && (
                  <motion.button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    whileHover={{ rotate: 90 }}
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
            <motion.button
              type="submit"
              className="btn btn-secondary px-3 sm:px-4"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          </form>

          {/* Stock Filter */}
          <div className="flex gap-1.5 sm:gap-2">
            {[
              { value: 'all', label: 'All', icon: Package },
              { value: 'low', label: 'Low Stock', icon: AlertTriangle },
              { value: 'out', label: 'Out of Stock', icon: X }
            ].map(({ value, label, icon: Icon }) => (
              <motion.button
                key={value}
                onClick={() => setParam('stock', value === 'all' ? '' : value)}
                className={`flex-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center ${filterStock === value
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
                  }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 shrink-0" />
                <span className="truncate">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {!transitionReady ? (
        <div className="glass-card p-12 flex justify-center items-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : filteredProducts.length === 0 && !searchLoading ? (
        <EmptyProductsState
          search={urlSearch}
          onAddClick={openCreateModal}
        />
      ) : (
        <ProductsTable
          key={tableKey}
          filteredProducts={filteredProducts}
          onEdit={openEditModal}
          onDelete={(product) => setDeleteDialog({ open: true, product })}
          formatCurrency={formatCurrency}
          observerTarget={sentinelRef}
          hasMore={hasMore || searchLoading}
          isLoadingMore={searchLoading || isFetching || (isValidating && page > 1)}
          isDesktop={isDesktop}
          currentPath={location.pathname + location.search}
        />
      )}

      {/* Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            initial="hidden"
            animate="visible"
          >
            {/* Catalog fields - always visible */}
            {[
              { name: 'productName', label: 'Product Name *', type: 'text', icon: Package, placeholder: 'Enter product name', required: true },
              { name: 'hsnCode', label: 'HSN Code *', type: 'text', icon: Barcode, placeholder: 'e.g., 3004', required: true },
              { name: 'manufacturer', label: 'Manufacturer', type: 'text', icon: Building2, placeholder: 'Manufacturer name' },
              { name: 'batchNo', label: 'Batch No', type: 'text', icon: Hash, placeholder: 'e.g., B-001 (optional)' },
              { name: 'expiryDate', label: 'Expiry Date', type: 'date', icon: Calendar }
            ].map((field, index) => (
              <motion.div
                key={field.name}
                custom={index}
                variants={formItemVariants}
              >
                <label className="label flex items-center gap-2">
                  <field.icon className="w-4 h-4 text-slate-400" />
                  {field.label}
                </label>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  className="input"
                  placeholder={field.placeholder}
                  required={field.required}
                />
              </motion.div>
            ))}

            {/* Pricing fields */}
            {[
              { name: 'newMRP', label: 'MRP *', type: 'number', icon: DollarSign, placeholder: '0.00', step: '0.01', min: '0', required: true },
              { name: 'rate', label: 'Rate (Incl. GST) *', type: 'number', icon: DollarSign, placeholder: '0.00', step: '0.01', min: '0', required: true },
              ...(!editingProduct ? [{ name: 'oldMRP', label: 'Old MRP', type: 'number', icon: DollarSign, placeholder: '0.00', step: '0.01', min: '0' }] : [])
            ].map((field, index) => (
              <motion.div
                key={field.name}
                custom={index + 3}
                variants={formItemVariants}
              >
                <label className="label flex items-center gap-2">
                  <field.icon className="w-4 h-4 text-slate-400" />
                  {field.label}
                </label>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  className="input"
                  placeholder={field.placeholder}
                  required={field.required}
                  step={field.step}
                  min={field.min}
                />
              </motion.div>
            ))}

            <motion.div custom={8} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <Percent className="w-4 h-4 text-slate-400" />
                GST %
              </label>
              <select
                name="gstPercentage"
                value={formData.gstPercentage}
                onChange={handleInputChange}
                className="select"
                required
              >
                <option value="" disabled>Select GST %</option>
                {GST_RATES.map(rate => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </select>
            </motion.div>

            <motion.div custom={9} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <Ruler className="w-4 h-4 text-slate-400" />
                Unit
              </label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                className="select"
              >
                {['Pieces', 'Strips', 'Bottles', 'Boxes', 'ML', 'GM'].map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </motion.div>

            {!editingProduct && (
              <motion.div custom={10} variants={formItemVariants}>
                <label className="label flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  Opening Stock
                </label>
                <input
                  type="number"
                  name="openingStockQty"
                  value={formData.openingStockQty}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="0"
                  min="0"
                />
              </motion.div>
            )}
          </motion.div>

          {/* Stock Management Link - only in edit mode */}
          {editingProduct && (
            <motion.div
              className="pt-6 mt-4 border-t border-slate-700"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-100 font-medium flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      Stock Management
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Adjust stock and view inventory on the Product Details page
                    </p>
                  </div>
                  <Link
                    to={`/products/${editingProduct._id}`}
                    state={{ from: location.pathname + location.search }}
                    onClick={() => setModalOpen(false)}
                    className="btn btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <motion.button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel
            </motion.button>
            <EnhancedButton
              type="submit"
              disabled={saving}
              icon={saving ? Loader2 : null}
            >
              {saving ? 'Saving...' : (editingProduct ? 'Update Product' : 'Add Product')}
            </EnhancedButton>
          </motion.div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, product: null })}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteDialog.product?.productName}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          if (!isExporting) setShowExportModal(false);
        }}
        data={filteredProducts}
        stats={exportStats}
        onExport={handleExport}
        isExporting={isExporting}
        entityType="Products"
        showDateRange={false}
      />
    </motion.div>
  );
}
