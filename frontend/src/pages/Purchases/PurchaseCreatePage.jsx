import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, Trash2, ArrowLeft, Search, Truck, MapPin, Phone,
  Package, FileText, CheckCircle, Calculator, X, Loader2
} from 'lucide-react';
import purchaseService from '../../services/purchaseService';
import { supplierService } from '../../services/suppliers/supplierService';
import { productService } from '../../services/products/productService';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { useDebounce, useMediaQuery } from '../../hooks';
import PurchaseItemMobileCard from './PurchaseItemMobileCard';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const dropdownVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } },
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 } }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

const DRAFT_STORAGE_KEY = "purchase_working_draft";

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
  const isEditMode = !!id;
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  
  // Selection State
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch] = useDebounce(productSearch, 300);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isProductSearchLoading, setIsProductSearchLoading] = useState(false);

  const [draftLoaded, setDraftLoaded] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 950px)');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await supplierService.getSuppliers();
        setSuppliers(data.suppliers || []);

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
          if (purchase.notes) setNotes(purchase.notes);
          if (purchase.items) {
            setItems(purchase.items.map(item => ({
              ...item,
              productId: item.productId._id,
              productName: item.productId.productName,
              batchNumber: item.batchNumber && item.batchNumber !== 'UNNAMED' ? item.batchNumber : ''
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
            if (savedDraft.notes) setNotes(savedDraft.notes);
            if (savedDraft.items) setItems(savedDraft.items);
            showToast('Draft restored', 'success');
          }
        }
      } catch (error) {
        showToast('Failed to load data', 'error');
      } finally {
        setLoadingInitial(false);
        setDraftLoaded(true);
      }
    };
    loadInitialData();
  }, [id, isEditMode]);

  useEffect(() => {
    if (!draftLoaded || isEditMode) return;
    const draft = {
      selectedSupplier,
      supplierInvoiceNumber,
      notes,
      items,
      savedAt: new Date().toISOString(),
    };
    if (selectedSupplier || items.length > 0 || notes || supplierInvoiceNumber) {
      saveDraftToStorage(draft);
    }
  }, [selectedSupplier, supplierInvoiceNumber, notes, items, draftLoaded]);

  useEffect(() => {
    const loadProducts = async () => {
      if (debouncedProductSearch.length < 2) {
        setProducts([]);
        setIsProductSearchLoading(false);
        return;
      }
      setIsProductSearchLoading(true);
      try {
        const data = await productService.getProducts({ search: debouncedProductSearch, limit: 15 });
        setProducts(data.products || []);
      } catch (error) {
        // ignore
      } finally {
        setIsProductSearchLoading(false);
      }
    };
    loadProducts();
  }, [debouncedProductSearch]);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || 
    (s.gstin && s.gstin.toLowerCase().includes(supplierSearch.toLowerCase()))
  );

  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierId(supplier._id);
    setSupplierSearch(supplier.name);
    setShowSupplierDropdown(false);
  };

  const handleAddItem = (product) => {
    setItems(prev => [
      ...prev,
      {
        productId: product._id,
        productName: product.productName,
        quantity: 1,
        freeQuantity: 0,
        purchaseRate: product.purchaseRate || product.rate || 0,
        sellingRate: product.rate || 0,
        mrp: product.newMRP || 0,
        discount: 0,
        gstPercent: product.gstPercentage || product.gstPercent || 12,
        batchNumber: '',
        expiryDate: '',
        currentStock: product.effectiveStockQty ?? product.currentStockQty ?? 0
      }
    ]);
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

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalGST = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const processedItems = items.map(item => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.purchaseRate) || 0;
      const discount = Number(item.discount) || 0;
      const gstPercent = Number(item.gstPercent) || 0;

      const itemTotal = qty * rate;
      const discountAmount = (itemTotal * discount) / 100;
      const itemTaxable = Math.max(0, itemTotal - discountAmount);
      const itemGst = (itemTaxable * gstPercent) / 100;
      const cgst = itemGst / 2;
      const sgst = itemGst / 2;

      subtotal += itemTotal;
      totalDiscount += discountAmount;
      totalTaxable += itemTaxable;
      totalGST += itemGst;
      totalCGST += cgst;
      totalSGST += sgst;

      return {
        ...item,
        taxableAmount: itemTaxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: 0,
        gstAmount: itemGst,
        total: itemTaxable + itemGst
      };
    });

    const grandTotal = totalTaxable + totalGST;
    return {
      processedItems,
      totals: { subtotal, totalDiscount, totalTaxable, totalGST, totalCGST, totalSGST, totalIGST, grandTotal }
    };
  };

  const handleSavePurchase = async () => {
    if (!supplierId) return showToast('Please select a supplier', 'error');
    if (items.length === 0) return showToast('Please add at least one item', 'error');

    setSaving(true);
    try {
      const { processedItems, totals } = calculateTotals();
      const purchaseData = {
        supplierId,
        supplierInvoiceNumber,
        notes,
        items: processedItems.map(item => ({
          ...item,
          expiryDate: item.expiryDate || undefined,
          batchNumber: item.batchNumber || undefined,
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
      showToast(`Purchase ${isEditMode ? 'updated' : 'completed'} and inventory updated!`, 'success');
      navigate(`/purchases/${purchaseId}`);
    } catch (error) {
      showToast(error.response?.data?.message || 'Error saving purchase', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDraft = () => {
    setSelectedSupplier(null);
    setSupplierId('');
    setSupplierSearch('');
    setSupplierInvoiceNumber('');
    setNotes('');
    setItems([]);
    clearDraftFromStorage();
    showToast("Form cleared", "success");
  };

  const { processedItems, totals } = calculateTotals();

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
      </div>
    );
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="p-6 max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <button 
            onClick={() => navigate(isEditMode ? `/purchases/${id}` : '/purchases')}
            className="text-slate-400 hover:text-white flex items-center text-sm font-medium transition-colors mb-2 w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to {isEditMode ? 'Purchase' : 'Purchases'}
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
            {isEditMode ? 'Edit Purchase' : 'Create New Purchase'}
          </h1>
        </div>
      </div>

      <motion.div variants={cardVariants} className="glass-card p-6 relative z-20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div className="p-2 bg-blue-500/20 rounded-lg" whileHover={{ rotate: 360 }} transition={{ duration: 0.6 }}>
              <Truck className="w-5 h-5 text-blue-400" />
            </motion.div>
            <h2 className="text-lg font-semibold text-white">Supplier Details</h2>
          </div>
          
          {(selectedSupplier || items.length > 0) && (
            <motion.button
              onClick={handleClearDraft}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="w-4 h-4" /> Clear Form
            </motion.button>
          )}
        </div>

        <div className={`relative ${showSupplierDropdown && supplierSearch ? "pb-48" : "mb-6"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Search Supplier *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setShowSupplierDropdown(true);
                    if (selectedSupplier && e.target.value !== selectedSupplier.name) {
                      setSelectedSupplier(null);
                      setSupplierId('');
                    }
                  }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  placeholder="Search supplier by name or GSTIN..."
                  className="input pl-10 w-full"
                />
              </div>

              <AnimatePresence>
                {showSupplierDropdown && supplierSearch && (
                  <motion.div
                    variants={dropdownVariants} initial="hidden" animate="visible" exit="exit"
                    className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
                  >
                    {filteredSuppliers.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">No suppliers found</div>
                    ) : (
                      filteredSuppliers.map((supplier, index) => (
                        <motion.button
                          key={supplier._id}
                          onClick={() => handleSupplierSelect(supplier)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}
                          whileHover={{ x: 4, backgroundColor: "rgba(51, 65, 85, 0.9)" }}
                        >
                          <p className="font-medium text-white flex items-center gap-2">
                            <Truck className="w-4 h-4 text-blue-400" />
                            {supplier.name}
                          </p>
                          <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                            {supplier.address && <><MapPin className="w-3 h-3" />{supplier.address}</>}
                            {supplier.gstin && <><span className="text-slate-600">•</span> {supplier.gstin}</>}
                          </p>
                        </motion.button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Supplier Invoice Number</label>
              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2024-888"
                className="input w-full"
              />
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedSupplier && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="mt-4 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 relative overflow-hidden"
            >
              <motion.div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <motion.div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30" whileHover={{ rotate: 360, scale: 1.1 }}>
                    <span className="text-white font-bold text-lg">{selectedSupplier.name.charAt(0)}</span>
                  </motion.div>
                  <div>
                    <p className="font-medium text-white">{selectedSupplier.name}</p>
                    {selectedSupplier.phone && <p className="text-sm text-slate-300 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" /> {selectedSupplier.phone}</p>}
                    {selectedSupplier.address && <p className="text-sm text-slate-300 flex items-start gap-1 mt-1"><MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{selectedSupplier.address}</span></p>}
                  </div>
                </div>
                <motion.button
                  onClick={() => { setSelectedSupplier(null); setSupplierSearch(''); setSupplierId(''); }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors" whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                >
                  <X className="w-4 h-4 text-slate-400" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div variants={cardVariants} className="glass-card p-6 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <motion.div className="p-2 bg-accent-500/20 rounded-lg" whileHover={{ rotate: 360 }} transition={{ duration: 0.6 }}>
            <Package className="w-5 h-5 text-accent-400" />
          </motion.div>
          <h2 className="text-lg font-semibold text-white">Add Products to Purchase</h2>
          {items.length > 0 && (
            <motion.span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full font-medium" initial={{ scale: 0 }} animate={{ scale: 1 }}>
              {items.length} {items.length === 1 ? "item" : "items"}
            </motion.span>
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
            onFocus={() => setShowProductDropdown(true)}
            placeholder="Search product by name..."
            className="input pl-10 w-full"
          />

          <AnimatePresence>
            {showProductDropdown && productSearch && (
              <motion.div
                variants={dropdownVariants} initial="hidden" animate="visible" exit="exit"
                className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
              >
                {isProductSearchLoading && (
                  <div className="px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching products...
                  </div>
                )}
                {!isProductSearchLoading && productSearch.trim().length >= 2 && products.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400">No products found</div>
                )}
                {!isProductSearchLoading && products.map((product, index) => (
                  <motion.button
                    key={product._id}
                    onClick={() => handleAddItem(product)}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-700 first:rounded-t-xl last:rounded-b-xl"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-white flex items-center gap-2">
                          <Package className="w-4 h-4 text-accent-400" />
                          {product.productName}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">GST: {product.gstPercentage || product.gstPercent}%</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium text-emerald-400">{formatCurrency(product.rate || product.newMRP)}</p>
                        <p className="text-sm text-slate-400 mt-1 flex items-center justify-end gap-1"><Package className="w-3 h-3" /> {product.effectiveStockQty ?? product.currentStockQty ?? 0}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="popLayout">
          {items.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              {isDesktop ? (
                <div className="table-container overflow-x-auto">
                  <table className="table min-w-[1100px]">
                    <thead>
                      <motion.tr initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <th>Product</th>
                        <th className="w-20">Qty</th>
                        <th className="w-20">Free</th>
                        <th className="w-28">Batch (Opt)</th>
                        <th className="w-32">Expiry (Opt)</th>
                        <th className="w-24">Pur. Rate</th>
                        <th className="w-24 text-accent-400">Sell Rate</th>
                        <th className="w-24">MRP</th>
                        <th className="w-20">Disc %</th>
                        <th className="w-20">GST %</th>
                        <th className="w-28">Total</th>
                        <th className="w-12"></th>
                      </motion.tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {processedItems.map((item, index) => (
                          <motion.tr
                            key={`${item.productId}-${index}`} custom={index} variants={tableRowVariants} initial="hidden" animate="visible" exit="exit" layout
                            whileHover={{ backgroundColor: "rgba(51, 65, 85, 0.5)" }}
                          >
                            <td>
                              <div>
                                <p className="font-medium text-white">{item.productName}</p>
                                <p className="text-xs text-slate-400">Current Stock: {item.currentStock}</p>
                              </div>
                            </td>
                            <td>
                              <input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)} className="input py-1.5 text-center" min="1" />
                            </td>
                            <td>
                              <input type="number" value={item.freeQuantity} onChange={(e) => handleUpdateItem(index, 'freeQuantity', e.target.value)} className="input py-1.5 text-center" min="0" />
                            </td>
                            <td>
                              <input type="text" value={item.batchNumber} onChange={(e) => handleUpdateItem(index, 'batchNumber', e.target.value)} placeholder="New Batch" className="input py-1.5 text-center" />
                            </td>
                            <td>
                              <input type="date" value={item.expiryDate} onChange={(e) => handleUpdateItem(index, 'expiryDate', e.target.value)} className="input py-1.5 text-center" />
                            </td>
                            <td>
                              <input type="number" value={item.purchaseRate} onChange={(e) => handleUpdateItem(index, 'purchaseRate', e.target.value)} className="input py-1.5 text-center text-blue-400" min="0" />
                            </td>
                            <td>
                              <input type="number" value={item.sellingRate} onChange={(e) => handleUpdateItem(index, 'sellingRate', e.target.value)} className="input py-1.5 text-center text-accent-400" min="0" />
                            </td>
                            <td>
                              <input type="number" value={item.mrp} onChange={(e) => handleUpdateItem(index, 'mrp', e.target.value)} className="input py-1.5 text-center" min="0" />
                            </td>
                            <td>
                              <input type="number" value={item.discount} onChange={(e) => handleUpdateItem(index, 'discount', e.target.value)} className="input py-1.5 text-center" min="0" />
                            </td>
                            <td>
                              <select value={item.gstPercent} onChange={(e) => handleUpdateItem(index, 'gstPercent', e.target.value)} className="select py-1.5 w-full">
                                {[0, 5, 12, 18, 28].map(gst => <option key={gst} value={gst}>{gst}%</option>)}
                              </select>
                            </td>
                            <td className="text-center font-medium text-emerald-400">
                              {formatCurrency(item.total)}
                            </td>
                            <td>
                              <motion.button onClick={() => handleRemoveItem(index)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" whileHover={{ scale: 1.2, rotate: 90 }} whileTap={{ scale: 0.9 }}>
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
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
            <motion.div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}>
              <Package className="w-8 h-8 text-slate-400" />
            </motion.div>
            <p className="text-slate-400">Search and add products to purchase above</p>
          </motion.div>
        )}
      </motion.div>

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 lg:col-span-2 relative z-0 h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Additional Notes</h2>
            </div>
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input w-full min-h-[120px] resize-y"
                placeholder="Add any specific instructions, delivery notes, or remarks..."
              ></textarea>
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-6">
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Calculator className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Payment Summary</h2>
              </div>

              <div className="space-y-4 text-sm relative z-10">
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-white font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                  <span className="text-slate-400">Total Taxable</span>
                  <span className="text-white font-medium">{formatCurrency(totals.totalTaxable)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                  <span className="text-slate-400">Total GST</span>
                  <span className="text-amber-400 font-medium">+{formatCurrency(totals.totalGST)}</span>
                </div>

                <div className="pt-4 mt-2 border-t border-slate-700/50">
                  <div className="flex justify-between items-end p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                    <div>
                      <p className="text-sm text-emerald-400 mb-1 font-medium">Grand Total</p>
                      <p className="text-xs text-slate-400">Including all taxes</p>
                    </div>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      {formatCurrency(totals.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <motion.button
                  onClick={handleSavePurchase}
                  disabled={saving}
                  className="w-full relative group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-2 bg-slate-900/40 backdrop-blur-sm px-6 py-4 rounded-xl font-medium text-white transition-all group-hover:bg-slate-900/20">
                    {saving ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                    ) : (
                      <><CheckCircle className="w-5 h-5 text-emerald-400" /> {isEditMode ? 'Update Purchase' : 'Save Purchase'}</>
                    )}
                  </div>
                </motion.button>
              </div>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-800/30 p-2 rounded-lg text-center">
                Saving will instantly update your inventory & stock.
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
