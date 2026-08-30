import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, Trash2, ArrowLeft, Search, Truck, Building2, MapPin, Phone,
  Package, FileText, CheckCircle, Calculator, X, Loader2, Plus,
  CreditCard, Clock, ShoppingCart, AlertTriangle, Calendar, RotateCcw
} from 'lucide-react';
import purchaseService from '../../services/purchaseService';
import { supplierService } from '../../services/suppliers/supplierService';
import { productService } from '../../services/products/productService';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { round } from '../../utils/calculations';
import { 
  useDebounce, 
  useMediaQuery, 
  useStockSSE, 
  invalidateCachePattern, 
  subscribeToInvalidation,
  useMotionConfig,
  useFirstVisit
} from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import PurchaseItemMobileCard from './PurchaseItemMobileCard';
import SupplierFormModal from '../../components/Suppliers/SupplierFormModal';

const createPageVariants = (isMobile, shouldStagger) => ({
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      staggerChildren: shouldStagger ? 0.1 : 0, 
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

const dropdownVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    transition: { type: "spring", stiffness: 400, damping: 25 } 
  },
  exit: { 
    opacity: 0, 
    y: -10, 
    scale: 0.95, 
    transition: { duration: 0.15 } 
  }
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({ 
    opacity: 1, 
    x: 0, 
    transition: { delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 } 
  }),
  exit: { 
    opacity: 0, 
    x: 20, 
    transition: { duration: 0.2 } 
  }
};

const DRAFT_STORAGE_KEY = "purchase_working_draft";

const generateCreateRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `purreq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const loadDraftFromStorage = () => {
  try {
    const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load purchase draft:", e);
  }
  return null;
};

const saveDraftToStorage = (draft) => {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (e) {
    console.error("Failed to save purchase draft:", e);
  }
};

const clearDraftFromStorage = () => {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear purchase draft:", e);
  }
};

export default function PurchaseCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const location = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const enableBatchTracking = user?.preferences?.enableBatchTracking === true;
  const isDesktop = useMediaQuery('(min-width: 950px)');

  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('purchase-create');
  const pageVariants = useMemo(() => createPageVariants(motionConfig.isMobile, motionConfig.shouldStagger), [motionConfig.isMobile, motionConfig.shouldStagger]);
  const cardVariants = useMemo(() => createCardVariants(motionConfig.isMobile), [motionConfig.isMobile]);

  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [createRequestId, setCreateRequestId] = useState(() => generateCreateRequestId());

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState('Credit');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  // Supplier Search State
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplierSearch] = useDebounce(supplierSearch, 300);
  const [supplierResults, setSupplierResults] = useState([]);
  const [isSupplierSearchLoading, setIsSupplierSearchLoading] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const latestSupplierSearchRequest = useRef(0);
  const supplierSearchContainerRef = useRef(null);

  // Product Search State
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch] = useDebounce(productSearch, 300);
  const [productResults, setProductResults] = useState([]);
  const [isProductSearchLoading, setIsProductSearchLoading] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const latestProductSearchRequest = useRef(0);
  const productSearchContainerRef = useRef(null);

  // Refs for real-time stock sync
  const itemsRef = useRef(items);
  const isMountedRef = useRef(true);
  const sseConnectionRef = useRef("disconnected");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Click outside to dismiss search dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        supplierSearchContainerRef.current &&
        !supplierSearchContainerRef.current.contains(e.target)
      ) {
        setShowSupplierDropdown(false);
      }
      if (
        productSearchContainerRef.current &&
        !productSearchContainerRef.current.contains(e.target)
      ) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Helper for checking canceled async requests
  const isRequestCanceled = (err) =>
    err?.code === "ERR_CANCELED" ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError";

  // ── Real-time stock sync via SSE ─────────────────────────────────────────
  const { connectionState: sseConnectionState } = useStockSSE({
    onStockUpdate: (updates) => {
      invalidateCachePattern("products");
      setItems((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          const update = updates.find((u) => u.productId === item.productId);
          if (!update) return item;
          if (update.effectiveStockQty === item.currentStock) return item;
          changed = true;
          return {
            ...item,
            currentStock: update.effectiveStockQty
          };
        });
        return changed ? next : prev;
      });
    },
    enabled: true,
  });

  useEffect(() => {
    sseConnectionRef.current = sseConnectionState;
  }, [sseConnectionState]);

  // Load initial data (Edit mode vs Draft mode)
  useEffect(() => {
    isMountedRef.current = true;

    const loadInitialData = async () => {
      try {
        if (isEditMode) {
          const res = await purchaseService.getPurchase(id);
          const purchase = res.purchase;
          if (purchase.status === 'CANCELLED') {
            showToast('Cancelled purchases cannot be edited', 'error');
            navigate(`/purchases/${id}`);
            return;
          }
          if (purchase.supplierId) {
            setSelectedSupplier(purchase.supplierId);
            setSupplierId(purchase.supplierId._id);
            setSupplierSearch(purchase.supplierId.name);
          }
          if (purchase.supplierInvoiceNumber) setSupplierInvoiceNumber(purchase.supplierInvoiceNumber);
          if (purchase.purchaseDate) {
            setPurchaseDate(new Date(purchase.purchaseDate).toISOString().split('T')[0]);
          }
          if (purchase.notes) setNotes(purchase.notes);
          if (purchase.items) {
            setItems(purchase.items.map(item => ({
              productId: item.productId?._id || item.productId,
              productName: item.productId?.productName || item.productName || 'Unknown Product',
              quantity: item.quantity || 1,
              freeQuantity: item.freeQuantity || 0,
              purchaseRate: item.purchaseRate || 0,
              sellingRate: item.sellingRate || item.purchaseRate || 0,
              mrp: item.mrp || 0,
              discount: item.discount || 0,
              gstPercent: item.gstPercent || 12,
              batchNumber: item.batchNumber && item.batchNumber !== 'UNNAMED' ? item.batchNumber : '',
              expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
              currentStock: item.productId?.effectiveStockQty ?? item.productId?.currentStockQty ?? 0
            })));
          }
        } else {
          const savedDraft = loadDraftFromStorage();
          if (savedDraft) {
            if (savedDraft.selectedSupplier) {
              setSelectedSupplier(savedDraft.selectedSupplier);
              setSupplierId(savedDraft.selectedSupplier._id);
              setSupplierSearch(savedDraft.selectedSupplier.name);
            }
            if (savedDraft.supplierInvoiceNumber) setSupplierInvoiceNumber(savedDraft.supplierInvoiceNumber);
            if (savedDraft.purchaseDate) setPurchaseDate(savedDraft.purchaseDate);
            if (savedDraft.paymentType) setPaymentType(savedDraft.paymentType);
            if (savedDraft.notes) setNotes(savedDraft.notes);
            if (savedDraft.items && Array.isArray(savedDraft.items)) {
              setItems(savedDraft.items);
            }
            if (savedDraft.createRequestId) {
              setCreateRequestId(savedDraft.createRequestId);
            }
            showToast('Draft restored from previous session', 'success');
          }
        }
      } catch (error) {
        showToast('Failed to load purchase data', 'error');
      } finally {
        setLoadingInitial(false);
        setDraftLoaded(true);
      }
    };

    loadInitialData();

    return () => {
      isMountedRef.current = false;
    };
  }, [id, isEditMode]);

  // Draft autosave to sessionStorage
  useEffect(() => {
    if (!draftLoaded || isEditMode) return;
    const draft = {
      createRequestId,
      selectedSupplier,
      supplierSearch,
      supplierInvoiceNumber,
      purchaseDate,
      paymentType,
      notes,
      items,
      savedAt: new Date().toISOString(),
    };

    if (selectedSupplier || items.length > 0 || notes || supplierInvoiceNumber) {
      saveDraftToStorage(draft);
    }
  }, [selectedSupplier, supplierSearch, supplierInvoiceNumber, purchaseDate, paymentType, notes, items, draftLoaded, isEditMode, createRequestId]);

  // Debounced Supplier Search
  useEffect(() => {
    const query = debouncedSupplierSearch.trim();
    const abortController = new AbortController();

    if (!showSupplierDropdown) return;

    if (query.length < 1) {
      // Fetch initial popular suppliers
      (async () => {
        try {
          const data = await supplierService.getSuppliers({ limit: 8 }, { signal: abortController.signal });
          if (!isMountedRef.current) return;
          setSupplierResults(data.suppliers || []);
        } catch (err) {
          if (!isRequestCanceled(err)) setSupplierResults([]);
        }
      })();
      setIsSupplierSearchLoading(false);
      return;
    }

    const requestId = latestSupplierSearchRequest.current + 1;
    latestSupplierSearchRequest.current = requestId;
    setIsSupplierSearchLoading(true);

    (async () => {
      try {
        const data = await supplierService.getSuppliers(
          { search: query, limit: 12 },
          { signal: abortController.signal }
        );
        if (latestSupplierSearchRequest.current !== requestId) return;
        setSupplierResults(data.suppliers || []);
      } catch (err) {
        if (isRequestCanceled(err)) return;
        if (latestSupplierSearchRequest.current !== requestId) return;
        setSupplierResults([]);
      } finally {
        if (latestSupplierSearchRequest.current === requestId) {
          setIsSupplierSearchLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [debouncedSupplierSearch, showSupplierDropdown]);

  // Debounced Product Search
  useEffect(() => {
    const query = debouncedProductSearch.trim();
    const abortController = new AbortController();

    if (!showProductDropdown) return;

    if (query.length < 1) {
      setProductResults([]);
      setIsProductSearchLoading(false);
      return;
    }

    const requestId = latestProductSearchRequest.current + 1;
    latestProductSearchRequest.current = requestId;
    setIsProductSearchLoading(true);

    (async () => {
      try {
        const data = await productService.getProducts(
          { search: query, limit: 20 },
          { signal: abortController.signal }
        );
        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults(data.products || []);
      } catch (err) {
        if (isRequestCanceled(err)) return;
        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults([]);
      } finally {
        if (latestProductSearchRequest.current === requestId) {
          setIsProductSearchLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [debouncedProductSearch, showProductDropdown]);

  // Supplier selection handlers
  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierId(supplier._id);
    setSupplierSearch(supplier.name);
    setShowSupplierDropdown(false);
  };

  const handleQuickSupplierAdded = (newSupplier) => {
    if (newSupplier) {
      handleSupplierSelect(newSupplier);
      showToast(`Supplier ${newSupplier.name} added & selected!`, 'success');
    }
  };

  // Product selection and item manipulation
  const handleProductSelect = (product) => {
    const productIdString = String(product._id);
    const existingIndex = items.findIndex(
      (item) => String(item.productId) === productIdString
    );

    if (existingIndex !== -1) {
      // Auto-increment quantity if product already in items
      const currentQty = Number(items[existingIndex].quantity) || 0;
      handleUpdateItem(existingIndex, 'quantity', currentQty + 1);
      setProductSearch('');
      setShowProductDropdown(false);
      showToast(`Incremented ${product.productName} quantity to ${currentQty + 1}`, 'info');
      return;
    }

    const newItem = {
      productId: product._id,
      productName: product.productName,
      hsnCode: product.hsnCode || '',
      quantity: 1,
      freeQuantity: 0,
      purchaseRate: product.purchaseRate || product.rate || 0,
      sellingRate: product.rate || 0,
      mrp: product.newMRP || product.rate || 0,
      discount: 0,
      gstPercent: product.gstPercentage ?? product.gstPercent ?? 12,
      batchNumber: '',
      expiryDate: '',
      currentStock: product.effectiveStockQty ?? product.currentStockQty ?? 0
    };

    setItems(prev => [newItem, ...prev]);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...items];
    let val = value;
    if (['quantity', 'freeQuantity', 'purchaseRate', 'sellingRate', 'mrp', 'discount', 'gstPercent'].includes(field)) {
      val = parseFloat(value);
      if (isNaN(val)) val = '';
    }
    newItems[index][field] = val;
    setItems(newItems);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const { processedItems, totals } = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalGST = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const computedItems = items.map(item => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.purchaseRate) || 0;
      const discount = Number(item.discount) || 0;
      const gstPercent = Number(item.gstPercent) || 0;

      const itemTotal = qty * rate;
      const discountAmount = (itemTotal * discount) / 100;
      const itemTaxable = Math.max(0, itemTotal - discountAmount);
      const itemGst = (itemTaxable * gstPercent) / 100;
      const cgst = round(itemGst / 2, 2);
      const sgst = round(itemGst / 2, 2);

      subtotal += itemTotal;
      totalDiscount += discountAmount;
      totalTaxable += itemTaxable;
      totalGST += itemGst;
      totalCGST += cgst;
      totalSGST += sgst;

      return {
        ...item,
        taxableAmount: round(itemTaxable, 2),
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: 0,
        gstAmount: round(itemGst, 2),
        total: round(itemTaxable + itemGst, 2)
      };
    });

    const grandTotal = round(totalTaxable + totalGST, 2);

    return {
      processedItems: computedItems,
      totals: {
        subtotal: round(subtotal, 2),
        totalDiscount: round(totalDiscount, 2),
        totalTaxable: round(totalTaxable, 2),
        totalGST: round(totalGST, 2),
        totalCGST: round(totalCGST, 2),
        totalSGST: round(totalSGST, 2),
        totalIGST: 0,
        grandTotal
      }
    };
  }, [items]);

  const handleSavePurchase = async () => {
    if (!supplierId) {
      showToast('Please select a supplier', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Please add at least one item to the purchase', 'error');
      return;
    }

    setSaving(true);
    try {
      const purchaseData = {
        supplierId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        purchaseDate: new Date(purchaseDate),
        notes: notes.trim(),
        paymentType,
        createRequestId,
        items: processedItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: Number(item.quantity) || 1,
          freeQuantity: Number(item.freeQuantity) || 0,
          purchaseRate: Number(item.purchaseRate) || 0,
          sellingRate: Number(item.sellingRate) || Number(item.purchaseRate) || 0,
          mrp: Number(item.mrp) || 0,
          discount: Number(item.discount) || 0,
          gstPercent: Number(item.gstPercent) || 12,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount || 0,
          gstAmount: item.gstAmount,
          taxableAmount: item.taxableAmount,
          total: item.total,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
          batchNumber: item.batchNumber ? item.batchNumber.trim() : undefined,
        })),
        totals
      };

      let purchaseId = id;
      if (isEditMode) {
        await purchaseService.updatePurchase(id, purchaseData);
      } else {
        const res = await purchaseService.createPurchase(purchaseData);
        purchaseId = res.purchase._id;
      }
      
      if (!isEditMode) clearDraftFromStorage();
      invalidateCachePattern('purchases');
      invalidateCachePattern('products');
      invalidateCachePattern('batches');
      invalidateCachePattern('suppliers');

      showToast(`Purchase ${isEditMode ? 'updated' : 'created'} & inventory updated!`, 'success');
      navigate(`/purchases/${purchaseId}`);
    } catch (error) {
      console.error('Error saving purchase:', error);
      showToast(error.response?.data?.message || error.message || 'Error saving purchase', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDraft = () => {
    setSelectedSupplier(null);
    setSupplierId('');
    setSupplierSearch('');
    setSupplierInvoiceNumber('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPaymentType('Credit');
    setNotes('');
    setItems([]);
    clearDraftFromStorage();
    setCreateRequestId(generateCreateRequestId());
    showToast("Purchase draft cleared", "info");
  };

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-accent-500" />
          <p className="text-sm text-slate-400">Loading purchase workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={pageVariants} 
      initial="hidden" 
      animate="visible" 
      className="p-6 max-w-7xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/purchases')}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Back to purchases"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {isEditMode ? 'Edit Purchase Invoice' : 'New Purchase Entry'}
            </h1>
            <p className="text-sm text-slate-400">
              {isEditMode ? 'Modify incoming stock, rates, and supplier bill items' : 'Record inward supplier stock, batch lots, and GST invoices'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditMode && (items.length > 0 || selectedSupplier || supplierInvoiceNumber) && (
            <button
              type="button"
              onClick={handleClearDraft}
              className="btn btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Form
            </button>
          )}
        </div>
      </div>

      {/* Supplier Selection Card */}
      <motion.div variants={cardVariants} className="glass-card p-6 relative z-20">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <motion.div 
              className="p-2 bg-blue-500/20 rounded-lg"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <Truck className="w-5 h-5 text-blue-400" />
            </motion.div>
            <h2 className="text-lg font-semibold text-white">Supplier Information</h2>
          </div>

          <button
            type="button"
            onClick={() => setIsAddSupplierModalOpen(true)}
            className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Quick Add Supplier
          </button>
        </div>

        <div ref={supplierSearchContainerRef} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={supplierSearch}
            onChange={(e) => {
              setSupplierSearch(e.target.value);
              setShowSupplierDropdown(true);
            }}
            onFocus={() => setShowSupplierDropdown(true)}
            placeholder="Search supplier by name, phone, or GSTIN..."
            className="input pl-10"
          />

          <AnimatePresence>
            {showSupplierDropdown && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-30 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
              >
                {isSupplierSearchLoading && (
                  <div className="px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    Searching suppliers...
                  </div>
                )}

                {!isSupplierSearchLoading && supplierResults.length === 0 && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-slate-400 mb-2">No suppliers found matching "{supplierSearch}"</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSupplierDropdown(false);
                        setIsAddSupplierModalOpen(true);
                      }}
                      className="btn btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create "{supplierSearch}" as New Supplier
                    </button>
                  </div>
                )}

                {!isSupplierSearchLoading && supplierResults.map((supplier, index) => (
                  <motion.button
                    key={supplier._id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSupplierSelect(supplier);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-slate-700/50 last:border-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    whileHover={{ x: 4, backgroundColor: "rgba(51, 65, 85, 0.9)" }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          {supplier.name}
                        </p>
                        <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                          {supplier.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {supplier.phone}
                            </span>
                          )}
                          {supplier.address && (
                            <span className="flex items-center gap-1 truncate max-w-xs">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {supplier.address}
                            </span>
                          )}
                        </p>
                      </div>
                      {supplier.gstin && (
                        <span className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                          {supplier.gstin}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selected Supplier Card */}
        <AnimatePresence mode="wait">
          {selectedSupplier && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="mt-4 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-teal-500/10 border border-blue-500/30 relative overflow-hidden"
            >
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-teal-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <span className="text-white font-bold text-lg">
                      {selectedSupplier.name ? selectedSupplier.name.charAt(0).toUpperCase() : 'S'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-white text-base">
                      {selectedSupplier.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300 mt-1">
                      {selectedSupplier.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-blue-400" />
                          {selectedSupplier.phone}
                        </span>
                      )}
                      {selectedSupplier.gstin && (
                        <span className="flex items-center gap-1 font-mono text-xs bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                          GSTIN: {selectedSupplier.gstin}
                        </span>
                      )}
                      {selectedSupplier.state && (
                        <span className="text-xs text-slate-400">
                          State: {selectedSupplier.state}
                        </span>
                      )}
                    </div>
                    {selectedSupplier.address && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{selectedSupplier.address}</span>
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSupplier(null);
                    setSupplierId('');
                    setSupplierSearch('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                  title="Change supplier"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Product Selection Card */}
      <motion.div variants={cardVariants} className="glass-card p-6 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <motion.div 
            className="p-2 bg-accent-500/20 rounded-lg"
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            <ShoppingCart className="w-5 h-5 text-accent-400" />
          </motion.div>
          <h2 className="text-lg font-semibold text-white">Add Purchased Items</h2>
          {items.length > 0 && (
            <>
              <motion.span 
                className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full font-medium"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </motion.span>
              <span className="ml-auto flex items-center gap-1.5 text-xs font-medium">
                {sseConnectionState === "connected" ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-emerald-400">Live Inventory</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400">Offline</span>
                  </>
                )}
              </span>
            </>
          )}
        </div>

        <div ref={productSearchContainerRef} className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            placeholder="Search product by name or HSN code..."
            className="input pl-10"
          />

          <AnimatePresence>
            {showProductDropdown && productSearch && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-30 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
              >
                {isProductSearchLoading && (
                  <div className="px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent-500" />
                    Searching products...
                  </div>
                )}

                {!isProductSearchLoading && productResults.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    No products found matching "{productSearch}"
                  </div>
                )}

                {!isProductSearchLoading && productResults.map((product, index) => {
                  const stock = product.effectiveStockQty ?? product.currentStockQty ?? 0;
                  return (
                    <motion.button
                      key={product._id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProductSelect(product);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-slate-700/50 last:border-0"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      whileHover={{ x: 4 }}
                    >
                      <div className="flex justify-between items-center gap-4">
                        <div>
                          <p className="font-medium text-white flex items-center gap-2">
                            <Package className="w-4 h-4 text-accent-400" />
                            {product.productName}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            HSN: {product.hsnCode || 'N/A'} • GST: {product.gstPercentage}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-blue-400">
                            Pur: {formatCurrency(product.purchaseRate || product.rate || 0)}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Stock: <span className="text-emerald-400 font-semibold">{stock}</span>
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Line Items Section */}
        <AnimatePresence mode="popLayout">
          {items.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }} 
              exit={{ opacity: 0, height: 0 }} 
              className="overflow-hidden"
            >
              {isDesktop ? (
                <div className="table-container overflow-x-auto">
                  <table className="table min-w-[1100px]">
                    <thead>
                      <motion.tr initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <th>Product</th>
                        <th className="w-20 text-center">Qty</th>
                        <th className="w-20 text-center">Free</th>
                        <th className="w-28 text-center">Batch (Opt)</th>
                        <th className="w-36 text-center">Expiry (Opt)</th>
                        <th className="w-28 text-center text-blue-400">Pur. Rate</th>
                        <th className="w-28 text-center text-accent-400">Sell Rate</th>
                        <th className="w-24 text-center">MRP</th>
                        <th className="w-20 text-center">Disc %</th>
                        <th className="w-24 text-center">GST %</th>
                        <th className="w-28 text-center text-emerald-400">Total</th>
                        <th className="w-12"></th>
                      </motion.tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {processedItems.map((item, index) => (
                          <motion.tr
                            key={`${item.productId}-${index}`} 
                            custom={index} 
                            variants={tableRowVariants} 
                            initial="hidden" 
                            animate="visible" 
                            exit="exit" 
                            layout
                            whileHover={{ backgroundColor: "rgba(51, 65, 85, 0.5)" }}
                          >
                            <td>
                              <div>
                                <p className="font-medium text-white flex items-center gap-1.5 flex-wrap">
                                  {item.productName}
                                  {enableBatchTracking && (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                                      {item.batchNumber ? item.batchNumber : 'No Batch #'}
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Current Stock: <span className="text-slate-300 font-medium">{item.currentStock}</span>
                                </p>
                              </div>
                            </td>
                            <td>
                              <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)} 
                                className="input py-1.5 text-center font-medium" 
                                min="1" 
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                value={item.freeQuantity} 
                                onChange={(e) => handleUpdateItem(index, 'freeQuantity', e.target.value)} 
                                className="input py-1.5 text-center" 
                                min="0" 
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                value={item.batchNumber} 
                                onChange={(e) => handleUpdateItem(index, 'batchNumber', e.target.value)} 
                                placeholder="New Batch" 
                                className="input py-1.5 text-center font-mono text-xs" 
                              />
                            </td>
                            <td>
                              <input 
                                type="date" 
                                value={item.expiryDate} 
                                onChange={(e) => handleUpdateItem(index, 'expiryDate', e.target.value)} 
                                className="input py-1.5 text-center text-xs" 
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                value={item.purchaseRate} 
                                onChange={(e) => handleUpdateItem(index, 'purchaseRate', e.target.value)} 
                                className="input py-1.5 text-center text-blue-400 font-medium" 
                                min="0" 
                                step="0.01"
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                value={item.sellingRate} 
                                onChange={(e) => handleUpdateItem(index, 'sellingRate', e.target.value)} 
                                className="input py-1.5 text-center text-accent-400 font-medium" 
                                min="0" 
                                step="0.01"
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                value={item.mrp} 
                                onChange={(e) => handleUpdateItem(index, 'mrp', e.target.value)} 
                                className="input py-1.5 text-center" 
                                min="0" 
                                step="0.01"
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                value={item.discount} 
                                onChange={(e) => handleUpdateItem(index, 'discount', e.target.value)} 
                                className="input py-1.5 text-center" 
                                min="0" 
                                max="100"
                              />
                            </td>
                            <td>
                              <select 
                                value={item.gstPercent} 
                                onChange={(e) => handleUpdateItem(index, 'gstPercent', e.target.value)} 
                                className="select py-1.5 text-center text-xs"
                              >
                                {[0, 5, 12, 18, 28].map(gst => (
                                  <option key={gst} value={gst}>{gst}%</option>
                                ))}
                              </select>
                              <span className="block text-[10px] text-slate-400 text-center mt-0.5">
                                ₹{item.gstAmount.toFixed(2)}
                              </span>
                            </td>
                            <td className="text-center font-bold text-emerald-400">
                              {formatCurrency(item.total)}
                            </td>
                            <td>
                              <motion.button 
                                type="button"
                                onClick={() => handleRemoveItem(index)} 
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" 
                                whileHover={{ scale: 1.2, rotate: 90 }} 
                                whileTap={{ scale: 0.9 }}
                                title="Remove line item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  <AnimatePresence mode="popLayout">
                    {processedItems.map((item, index) => (
                      <PurchaseItemMobileCard
                        key={`${item.productId}-${index}`}
                        item={item}
                        index={index}
                        handleUpdateItem={handleUpdateItem}
                        handleRemoveItem={handleRemoveItem}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-400">Search and select items from above to add to this purchase</p>
          </motion.div>
        )}
      </motion.div>

      {/* Bottom Summary & Additional Details Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Additional Details */}
          <div className="glass-card p-6 lg:col-span-2 relative z-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Purchase & Invoice Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Supplier Invoice / Bill No.
                </label>
                <input
                  type="text"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  className="input font-mono"
                  placeholder="e.g. SUPP-INV-2026-089"
                />
              </div>

              <div>
                <label className="label flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  Payment Mode
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="select"
                >
                  <option value="Credit">Credit (Pay Later)</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Notes / Purchase Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  placeholder="Any delivery terms, transporter notes, or remarks..."
                />
              </div>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="glass-card p-6 relative z-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Calculator className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Purchase Summary</h2>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal (Gross)</span>
                  <span className="text-white font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>

                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Discount</span>
                    <span className="text-red-400 font-medium">-{formatCurrency(totals.totalDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-400">Taxable Amount</span>
                  <span className="text-white font-medium">{formatCurrency(totals.totalTaxable)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">CGST</span>
                  <span className="text-white font-medium">{formatCurrency(totals.totalCGST)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">SGST</span>
                  <span className="text-white font-medium">{formatCurrency(totals.totalSGST)}</span>
                </div>

                <div className="flex justify-between pt-3 border-t border-slate-700">
                  <span className="font-semibold text-white text-base">Grand Total</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(totals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSavePurchase}
              disabled={saving}
              className="btn btn-primary w-full mt-6 py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-base"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isEditMode ? 'Updating Purchase...' : 'Completing Purchase...'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {isEditMode ? 'Update Purchase & Stock' : 'Complete Purchase Entry'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      <SupplierFormModal
        isOpen={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        onSuccess={handleQuickSupplierAdded}
      />
    </motion.div>
  );
}
