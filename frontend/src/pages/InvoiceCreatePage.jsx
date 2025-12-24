import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  User,
  Phone,
  MapPin,
  FileText,
  Package,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Calculator,
  CreditCard,
  Clock,
  ShoppingCart,
  X,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { productService } from '../services/productService';
import { customerService } from '../services/customerService';
import { invoiceService } from '../services/invoiceService';
import { formatCurrency } from '../utils/formatters';
import { calculateItemAmounts, calculateInvoiceTotals, GST_RATES, removeGST, round } from '../utils/calculations';
import { PageLoader } from '../components/Common/Loader';
import { useToast } from '../context/ToastContext';

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

const dropdownVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25
    }
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
    transition: {
      delay: i * 0.05,
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }),
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 }
  }
};

const DRAFT_STORAGE_KEY = 'invoice_working_draft';

// Helper to load draft from sessionStorage (tab-specific)
const loadDraftFromStorage = () => {
  try {
    const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load invoice draft:', e);
  }
  return null;
};

// Helper to save draft to sessionStorage (tab-specific)
const saveDraftToStorage = (draft) => {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (e) {
    console.error('Failed to save invoice draft:', e);
  }
};

// Helper to clear draft from sessionStorage (tab-specific)
const clearDraftFromStorage = () => {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear invoice draft:', e);
  }
};

// Helper to get storage key (for debugging)
const getDraftStorageKey = () => DRAFT_STORAGE_KEY;

export default function InvoiceCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editInvoiceId } = useParams();
  const location = useLocation();
  const { success, error } = useToast();

  // Detect if we're in edit mode
  const isEditMode = Boolean(editInvoiceId && location.pathname.includes('/edit'));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [paymentType, setPaymentType] = useState('Credit');
  const [notes, setNotes] = useState('');
  
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState(null);

  // Save draft to sessionStorage whenever relevant state changes (works for both create and edit modes)
  useEffect(() => {
    if (!draftLoaded) return; // Don't save until draft is loaded/initialized
    
    const draft = {
      editInvoiceId: isEditMode ? editInvoiceId : null,  // Store edit mode info in draft
      selectedCustomer,
      customerSearch,
      invoiceItems,
      paymentType,
      notes,
      savedAt: new Date().toISOString()
    };
    
    // Only save if there's meaningful data
    if (selectedCustomer || invoiceItems.length > 0 || notes) {
      saveDraftToStorage(draft);
    }
  }, [selectedCustomer, customerSearch, invoiceItems, paymentType, notes, draftLoaded, isEditMode, editInvoiceId]);

  useEffect(() => {
    loadInitialData();
  }, [editInvoiceId]);

  const loadInitialData = async () => {
    try {
      const [productsData, customersData] = await Promise.all([
        productService.getProducts({ limit: 100 }),
        customerService.getCustomers({ limit: 100, includeInactive: true })
      ]);
      
      setProducts(productsData.products || []);
      setCustomers(customersData.customers || []);

      // Load saved draft (works for both create and edit modes)
      const savedDraft = loadDraftFromStorage();
      console.log('Draft key:', getDraftStorageKey());
      console.log('Loaded draft:', savedDraft);
      
      // Check if we have a valid draft with items
      if (savedDraft && savedDraft.invoiceItems?.length > 0) {
        // If we're in edit mode via URL, make sure the draft matches this invoice
        // Or if we're in create mode, check if draft has an edit session
        const draftIsForThisEdit = isEditMode && savedDraft.editInvoiceId === editInvoiceId;
        const draftIsEdit = savedDraft.editInvoiceId != null;
        
        if (isEditMode && draftIsForThisEdit) {
          // Editing this specific invoice - restore the draft
          console.log('Restoring edit draft for invoice:', editInvoiceId);
          if (savedDraft.selectedCustomer) {
            setSelectedCustomer(savedDraft.selectedCustomer);
            setCustomerSearch(savedDraft.customerSearch || savedDraft.selectedCustomer.customerName);
          }
          
          const restoredItems = savedDraft.invoiceItems.map(item => {
            const currentProduct = productsData.products?.find(p => p._id === item.product._id);
            return {
              ...item,
              product: {
                ...item.product,
                currentStock: currentProduct?.currentStockQty || item.product.currentStock || 0
              }
            };
          });
          setInvoiceItems(restoredItems);
          
          if (savedDraft.paymentType) setPaymentType(savedDraft.paymentType);
          if (savedDraft.notes !== undefined) setNotes(savedDraft.notes);
          
          success('Edit draft restored');
        } else if (!isEditMode && draftIsEdit) {
          // We're on create page but draft has edit session - redirect to edit page
          console.log('Redirecting to edit page:', savedDraft.editInvoiceId);
          navigate(`/invoices/${savedDraft.editInvoiceId}/edit`);
          return;
        } else if (!isEditMode && !draftIsEdit) {
          // Regular create draft on create page - restore it
          console.log('Restoring create draft');
          if (savedDraft.selectedCustomer) {
            const customer = customersData.customers?.find(c => c._id === savedDraft.selectedCustomer._id);
            if (customer) {
              setSelectedCustomer(customer);
              setCustomerSearch(savedDraft.customerSearch || customer.customerName);
            }
          }
          
          if (savedDraft.invoiceItems && savedDraft.invoiceItems.length > 0) {
            const validItems = savedDraft.invoiceItems.filter(item => {
              const product = productsData.products?.find(p => p._id === item.product._id);
              return product && product.currentStockQty > 0;
            }).map(item => {
              const product = productsData.products?.find(p => p._id === item.product._id);
              return {
                ...item,
                product: {
                  ...item.product,
                  currentStock: product?.currentStockQty || 0
                }
              };
            });
            setInvoiceItems(validItems);
          }
          
          if (savedDraft.paymentType) setPaymentType(savedDraft.paymentType);
          if (savedDraft.notes) setNotes(savedDraft.notes);
          
          success('Draft restored');
        } else if (isEditMode && !draftIsForThisEdit) {
          // Edit mode but draft is for different invoice or is a create draft - load from database
          console.log('Loading invoice from database:', editInvoiceId);
          try {
            const invoiceData = await invoiceService.getInvoice(editInvoiceId, false);
            const invoice = invoiceData.invoice;
            setOriginalInvoice(invoice);
            
            setSelectedCustomer(invoice.customer);
            setCustomerSearch(invoice.customer.customerName);
            
            const loadedItems = invoice.items.map(item => {
              const currentProduct = productsData.products?.find(p => p._id === item.product._id);
              const baseRate = item.ratePerUnit;
              const amounts = calculateItemAmounts(
                item.quantitySold,
                baseRate,
                item.product.gstPercentage,
                item.schemeDiscount || 0
              );
              
              return {
                product: {
                  ...item.product,
                  rate: item.product.newMRP,
                  currentStock: (currentProduct?.currentStockQty || 0) + item.quantitySold + (item.freeQuantity || 0)
                },
                quantitySold: item.quantitySold,
                freeQuantity: item.freeQuantity || 0,
                baseRate: baseRate,
                netRate: round(baseRate * (1 + item.product.gstPercentage / 100), 2),
                schemeDiscount: item.schemeDiscount || 0,
                ...amounts
              };
            });
            setInvoiceItems(loadedItems);
            
            setPaymentType(invoice.paymentType || 'Credit');
            setNotes(invoice.notes || '');
            
          } catch (err) {
            error('Failed to load invoice for editing');
            navigate('/invoices');
            return;
          }
        }
      } else if (isEditMode) {
        // Edit mode with no draft at all - load from database
        console.log('No draft found, loading invoice from database:', editInvoiceId);
        try {
          const invoiceData = await invoiceService.getInvoice(editInvoiceId, false);
          const invoice = invoiceData.invoice;
          setOriginalInvoice(invoice);
          
          setSelectedCustomer(invoice.customer);
          setCustomerSearch(invoice.customer.customerName);
          
          const loadedItems = invoice.items.map(item => {
            const currentProduct = productsData.products?.find(p => p._id === item.product._id);
            const baseRate = item.ratePerUnit;
            const amounts = calculateItemAmounts(
              item.quantitySold,
              baseRate,
              item.product.gstPercentage,
              item.schemeDiscount || 0
            );
            
            return {
              product: {
                ...item.product,
                rate: item.product.newMRP,
                currentStock: (currentProduct?.currentStockQty || 0) + item.quantitySold + (item.freeQuantity || 0)
              },
              quantitySold: item.quantitySold,
              freeQuantity: item.freeQuantity || 0,
              baseRate: baseRate,
              netRate: round(baseRate * (1 + item.product.gstPercentage / 100), 2),
              schemeDiscount: item.schemeDiscount || 0,
              ...amounts
            };
          });
          setInvoiceItems(loadedItems);
          
          setPaymentType(invoice.paymentType || 'Credit');
          setNotes(invoice.notes || '');
          
        } catch (err) {
          error('Failed to load invoice for editing');
          navigate('/invoices');
          return;
        }
      } else {
        // Create mode with no draft - check for customer from URL params
        const customerId = searchParams.get('customer');
        if (customerId) {
          const customer = customersData.customers?.find(c => c._id === customerId);
          if (customer) {
            setSelectedCustomer(customer);
            setCustomerSearch(customer.customerName);
          }
        }
      }
    } catch (err) {
      error('Failed to load data');
    } finally {
      setLoading(false);
      setDraftLoaded(true); // Mark as loaded to enable auto-save
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch) ||
    c.gstin?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.hsnCode.includes(productSearch) ||
    p.batchNo.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.customerName);
    setShowCustomerDropdown(false);
  };

  const handleProductSelect = (product) => {
    const exists = invoiceItems.find(item => item.product._id === product._id);
    if (exists) {
      error('Product already added to invoice');
      return;
    }

    // Calculate base rate (without GST) for display
    const baseRate = removeGST(product.rate, product.gstPercentage);
    const amounts = calculateItemAmounts(1, baseRate, product.gstPercentage, 0);
    const netRate = round(baseRate * (1 + product.gstPercentage / 100), 2);
    
    setInvoiceItems(prev => [...prev, {
      product: {
        _id: product._id,
        productName: product.productName,
        hsnCode: product.hsnCode,
        batchNo: product.batchNo,
        expiryDate: product.expiryDate,
        newMRP: product.newMRP,
        rate: product.rate,
        gstPercentage: product.gstPercentage,
        currentStock: product.currentStockQty
      },
      quantitySold: 1,
      freeQuantity: 0,
      baseRate: round(baseRate, 2),
      netRate: netRate,
      schemeDiscount: 0,
      ...amounts
    }]);

    setProductSearch('');
    setShowProductDropdown(false);
  };

  const updateItemQuantity = (index, field, value) => {
    setInvoiceItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      let newValue = parseFloat(value) || 0;
      
      // Validate against available stock
      const maxStock = item.product.currentStock;
      if (field === 'quantitySold') {
        const maxAllowed = maxStock - item.freeQuantity;
        newValue = Math.min(Math.max(0, newValue), Math.max(0, maxAllowed));
      } else if (field === 'freeQuantity') {
        const maxAllowed = maxStock - item.quantitySold;
        newValue = Math.min(Math.max(0, newValue), Math.max(0, maxAllowed));
      }
      
      // If user is changing totalAmount, recalculate baseRate
      if (field === 'totalAmount') {
        item.totalAmount = newValue;
        // Work backwards: totalAmount = taxable + gst = taxable * (1 + gstPercentage/100)
        // And taxable = baseRate * qty * (1 - discount/100)
        // So: totalAmount = baseRate * qty * (1 - discount/100) * (1 + gstPercentage/100)
        const qty = item.quantitySold || 1;
        const discountMultiplier = (100 - (item.schemeDiscount || 0)) / 100;
        const gstMultiplier = (100 + item.product.gstPercentage) / 100;
        
        if (qty > 0 && discountMultiplier > 0) {
          item.baseRate = round(newValue / (qty * discountMultiplier * gstMultiplier), 2);
        }
        
        // Recalculate other amounts based on new baseRate
        const amounts = calculateItemAmounts(
          item.quantitySold,
          item.baseRate,
          item.product.gstPercentage,
          item.schemeDiscount
        );
        // But keep the user-entered totalAmount
        updated[index] = { ...item, ...amounts, totalAmount: newValue };
      } else if (field === 'netRate') {
        // Store the user-entered netRate directly (allow empty string while typing)
        item.netRate = value === '' ? '' : newValue;
        
        // Only recalculate if we have a valid number
        if (value !== '' && newValue > 0) {
          // Net Rate = baseRate * (1 + gst/100), so baseRate = netRate / (1 + gst/100)
          const gstMultiplier = (100 + item.product.gstPercentage) / 100;
          item.baseRate = round(newValue / gstMultiplier, 2);
          
          // Recalculate all amounts based on new baseRate
          const amounts = calculateItemAmounts(
            item.quantitySold,
            item.baseRate,
            item.product.gstPercentage,
            item.schemeDiscount
          );
          updated[index] = { ...item, ...amounts, netRate: newValue };
        } else {
          updated[index] = { ...item, netRate: value === '' ? '' : newValue };
        }
      } else if (field === 'baseAmount') {
        // baseAmount = baseRate * qty, so baseRate = baseAmount / qty
        const qty = item.quantitySold || 1;
        item.baseRate = round(newValue / qty, 2);
        item.baseAmount = newValue;
        
        // Recalculate all amounts based on new baseRate
        const amounts = calculateItemAmounts(
          item.quantitySold,
          item.baseRate,
          item.product.gstPercentage,
          item.schemeDiscount
        );
        // Keep the user-entered baseAmount but update netRate
        const netRate = round(item.baseRate * (1 + item.product.gstPercentage / 100), 2);
        updated[index] = { ...item, ...amounts, baseAmount: newValue, netRate };
      } else {
        item[field] = newValue;
        
        // Use baseRate for calculations (this is the rate without GST)
        const amounts2 = calculateItemAmounts(
          item.quantitySold,
          item.baseRate,
          item.product.gstPercentage,
          item.schemeDiscount
        );
        
        updated[index] = { ...item, ...amounts2, netRate: round(item.baseRate * (1 + item.product.gstPercentage / 100), 2) };
      }
      
      return updated;
    });
  };

  const removeItem = (index) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  // Use useMemo to ensure totals recalculate when invoiceItems changes
  const totals = useMemo(() => {
    try {
      return calculateInvoiceTotals(invoiceItems);
    } catch (err) {
      console.error('Error calculating totals:', err);
      return {
        baseAmount: 0,
        totalDiscount: 0,
        totalTaxable: 0,
        totalCGST: 0,
        totalSGST: 0,
        netTotal: 0
      };
    }
  }, [invoiceItems]);

  const validateInvoice = () => {
    if (!selectedCustomer) {
      error('Please select a customer');
      return false;
    }
    if (invoiceItems.length === 0) {
      error('Please add at least one product');
      return false;
    }
    for (const item of invoiceItems) {
      const totalQty = item.quantitySold + item.freeQuantity;
      if (totalQty > item.product.currentStock) {
        error(`Insufficient stock for ${item.product.productName}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateInvoice()) return;

    setSaving(true);
    try {
      const invoiceData = {
        customerId: selectedCustomer._id,
        items: invoiceItems.map(item => ({
          productId: item.product._id,
          quantitySold: item.quantitySold,
          freeQuantity: item.freeQuantity,
          ratePerUnit: item.baseRate,
          schemeDiscount: item.schemeDiscount
        })),
        paymentType,
        notes
      };

      let result;
      if (isEditMode && editInvoiceId) {
        result = await invoiceService.updateInvoice(editInvoiceId, invoiceData);
        // Clear the draft after successful update
        clearDraftFromStorage();
        success('Invoice updated successfully!');
      } else {
        result = await invoiceService.createInvoice(invoiceData);
        // Clear the draft after successful creation
        clearDraftFromStorage();
        success('Invoice created successfully!');
      }
      
      navigate(`/invoices/${result.invoice._id}`);
    } catch (err) {
      error(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} invoice`);
    } finally {
      setSaving(false);
    }
  };

  // Clear draft and reset form
  const handleClearDraft = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setInvoiceItems([]);
    setPaymentType('Credit');
    setNotes('');
    clearDraftFromStorage();
    success('Draft cleared');
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      {/* Customer Selection */}
      <motion.div variants={cardVariants} className="glass-card p-6 relative z-20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-blue-500/20 rounded-lg"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <User className="w-5 h-5 text-blue-400" />
            </motion.div>
            <h2 className="text-lg font-semibold text-white">Customer Details</h2>
          </div>
          
          {/* Clear Draft Button - only show when there's data */}
          {(selectedCustomer || invoiceItems.length > 0) && (
            <motion.button
              onClick={handleClearDraft}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="w-4 h-4" />
              Clear Draft
            </motion.button>
          )}
        </div>
        
        <div className={`relative ${showCustomerDropdown && customerSearch && filteredCustomers.length > 0 ? 'pb-64' : ''}`}>
          <motion.div
            className="relative"
            whileFocus={{ scale: 1.01 }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
                if (selectedCustomer && e.target.value !== selectedCustomer.customerName) {
                  setSelectedCustomer(null);
                }
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="Search customer by name, phone, or GSTIN..."
              className="input pl-10"
            />
          </motion.div>
          
          <AnimatePresence>
            {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
              >
                {filteredCustomers.slice(0, 10).map((customer, index) => (
                  <motion.button
                    key={customer._id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCustomerSelect(customer);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ x: 4, backgroundColor: 'rgba(51, 65, 85, 0.9)' }}
                  >
                    <p className="font-medium text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      {customer.customerName}
                    </p>
                    <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                      <Phone className="w-3 h-3" />
                      {customer.phone}
                      {customer.gstin && <><span className="text-slate-600">•</span> {customer.gstin}</>}
                    </p>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {selectedCustomer && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <motion.div
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className="text-white font-bold text-lg">
                      {selectedCustomer.customerName.charAt(0)}
                    </span>
                  </motion.div>
                  <div>
                    <p className="font-medium text-white">{selectedCustomer.customerName}</p>
                    <p className="text-sm text-slate-300 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {selectedCustomer.phone}
                    </p>
                    {selectedCustomer.address && (
                      <p className="text-sm text-slate-300 flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{selectedCustomer.address}</span>
                      </p>
                    )}
                  </div>
                </div>
                <motion.button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-4 h-4 text-slate-400" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Product Selection */}
      <motion.div variants={cardVariants} className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <motion.div
            className="p-2 bg-purple-500/20 rounded-lg"
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            <ShoppingCart className="w-5 h-5 text-purple-400" />
          </motion.div>
          <h2 className="text-lg font-semibold text-white">Add Products</h2>
          {invoiceItems.length > 0 && (
            <motion.span
              className="ml-auto px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full font-medium"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {invoiceItems.length} {invoiceItems.length === 1 ? 'item' : 'items'}
            </motion.span>
          )}
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            placeholder="Search product by name, HSN, or batch..."
            className="input pl-10"
          />
          
          <AnimatePresence>
            {showProductDropdown && productSearch && filteredProducts.length > 0 && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
              >
                {filteredProducts.slice(0, 10).map((product, index) => (
                  <motion.button
                    key={product._id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductSelect(product);
                    }}
                    disabled={product.currentStockQty <= 0}
                    className={`w-full px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${
                      product.currentStockQty <= 0 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-slate-700'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={product.currentStockQty > 0 ? { x: 4 } : {}}
                  >
                    <div className="flex justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-white flex items-center gap-2">
                          <Package className="w-4 h-4 text-purple-400" />
                          {product.productName}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          Batch: {product.batchNo} • GST: {product.gstPercentage}%
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium text-emerald-400">{formatCurrency(product.rate)}</p>
                        <p className={`text-sm mt-1 flex items-center gap-1 ${
                          product.currentStockQty <= 10 ? 'text-red-400' : 'text-slate-400'
                        }`}>
                          <Package className="w-3 h-3" />
                          {product.currentStockQty}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Invoice Items Table */}
        <AnimatePresence mode="popLayout">
          {invoiceItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="table-container">
                <table className="table">
                  <thead>
                    <motion.tr
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <th>Product</th>
                      <th className="w-20">Qty</th>
                      <th className="w-20">Free</th>
                      <th className="w-24">Base</th>
                      <th className="w-24">Net Rate</th>
                      <th className="w-20">Disc %</th>
                      <th className="w-20">GST</th>
                      <th className="w-28">Total</th>
                      <th className="w-12"></th>
                    </motion.tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {invoiceItems.map((item, index) => (
                        <motion.tr
                          key={item.product._id}
                          custom={index}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          layout
                          whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}
                        >
                          <td>
                            <div>
                              <p className="font-medium text-white">{item.product.productName}</p>
                              <p className="text-xs text-slate-400">
                                Batch: {item.product.batchNo} • Stock: {item.product.currentStock}
                              </p>
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.quantitySold}
                              onChange={(e) => updateItemQuantity(index, 'quantitySold', e.target.value)}
                              className="input py-1.5 text-center"
                              min="1"
                              max={item.product.currentStock}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.freeQuantity}
                              onChange={(e) => updateItemQuantity(index, 'freeQuantity', e.target.value)}
                              className="input py-1.5 text-center"
                              min="0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.baseRate}
                              onChange={(e) => updateItemQuantity(index, 'baseRate', e.target.value)}
                              className="input py-1.5 text-center"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="text-center text-blue-400 font-medium">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.netRate !== undefined ? item.netRate : round(item.baseRate * (1 + item.product.gstPercentage / 100), 2)}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Allow empty, numbers, and decimals
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  updateItemQuantity(index, 'netRate', val);
                                }
                              }}
                              onBlur={(e) => {
                                // On blur, ensure we have a valid number
                                const val = parseFloat(e.target.value) || 0;
                                updateItemQuantity(index, 'netRate', val.toString());
                              }}
                              className="input py-1.5 text-center text-blue-400"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.schemeDiscount}
                              onChange={(e) => updateItemQuantity(index, 'schemeDiscount', e.target.value)}
                              className="input py-1.5 text-center"
                              min="0"
                              max="100"
                            />
                          </td>
                          <td className="text-slate-300">
                            {item.product.gstPercentage}%
                            <span className="block text-xs text-slate-500">
                              ₹{item.gstAmount.toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.baseAmount}
                              onChange={(e) => updateItemQuantity(index, 'baseAmount', e.target.value)}
                              className="input py-1.5 text-center text-emerald-400 font-medium"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <motion.button
                              onClick={() => removeItem(index)}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                              whileHover={{ scale: 1.2, rotate: 90 }}
                              whileTap={{ scale: 0.9 }}
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
            </motion.div>
          )}
        </AnimatePresence>

        {invoiceItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <Package className="w-8 h-8 text-slate-400" />
            </motion.div>
            <p className="text-slate-400">Search and add products above</p>
          </motion.div>
        )}
      </motion.div>

      {/* Summary Section */}
      {invoiceItems.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Additional Details */}
          <div className="glass-card p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Additional Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  Payment Type
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="select"
                >
                  <option value="Credit">Credit</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  placeholder="Any special notes..."
                />
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Calculator className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Invoice Summary</h2>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white">{formatCurrency(totals.baseAmount)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Discount</span>
                  <span className="text-red-400">-{formatCurrency(totals.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Taxable Amount</span>
                <span className="text-white">{formatCurrency(totals.totalTaxable)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CGST</span>
                <span className="text-white">{formatCurrency(totals.totalCGST)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SGST</span>
                <span className="text-white">{formatCurrency(totals.totalSGST)}</span>
              </div>
              
              <div className="flex justify-between pt-3 border-t border-slate-700">
                <span className="font-semibold text-white">Grand Total</span>
                <span className="text-xl font-bold text-emerald-400">
                  {formatCurrency(totals.netTotal)}
                </span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn btn-primary w-full mt-6 py-3 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Invoice...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Backdrop removed - was intercepting clicks */}
    </motion.div>
  );
}
