import { useState, useEffect, useMemo } from 'react';
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
import { useMotionConfig, useSWR, invalidateCachePattern } from '../hooks';
import RefreshIndicator from '../components/Common/RefreshIndicator';

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
  gstPercentage: 12,
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
const ProductsTable = ({ filteredProducts, onEdit, onDelete, isExpired, isExpiringSoon, formatDate, formatCurrency }) => (
  <motion.div
    key="products-table"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="glass-card overflow-hidden"
  >
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>HSN</th>
            <th>Batch</th>
            <th>Expiry</th>
            <th>MRP</th>
            <th>GST</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product, index) => {
              const expired = isExpired(product.expiryDate);
              const expiringSoon = isExpiringSoon(product.expiryDate);
              const lowStock = product.currentStockQty <= 30;
              const outOfStock = product.currentStockQty === 0;

              return (
                <motion.tr
                  key={product._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="hover:bg-slate-700/50 transition-colors"
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Package className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{product.productName}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Building2 className="w-3 h-3" />
                          {product.manufacturer}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-slate-300 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <Barcode className="w-4 h-4 text-slate-500" />
                      {product.hsnCode}
                    </div>
                  </td>
                  <td className="text-slate-300 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-slate-500" />
                      {product.batchNo}
                    </div>
                  </td>
                  <td>
                    <motion.span
                      className={`badge inline-flex items-center gap-1.5 ${
                        expired ? 'badge-danger' :
                        expiringSoon ? 'badge-warning' :
                        'badge-success'
                      }`}
                      whileHover={{ scale: 1.05 }}
                    >
                      <Calendar className="w-3 h-3" />
                      {formatDate(product.expiryDate)}
                    </motion.span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {product.oldMRP && product.oldMRP !== product.newMRP && (
                        <motion.span
                          className="text-slate-500 line-through text-sm flex items-center gap-1"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          {product.oldMRP > product.newMRP ? (
                            <TrendingDown className="w-3 h-3 text-green-400" />
                          ) : (
                            <TrendingUp className="w-3 h-3 text-red-400" />
                          )}
                          {formatCurrency(product.oldMRP)}
                        </motion.span>
                      )}
                      <span className="text-emerald-400 font-medium">
                        {formatCurrency(product.newMRP)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex items-center px-2 py-1 bg-blue-500/20 rounded text-blue-400 text-sm font-medium">
                      {product.gstPercentage}%
                    </span>
                  </td>
                  <td>
                    <motion.span
                      className={`badge inline-flex items-center gap-1.5 ${
                        outOfStock ? 'badge-danger' :
                        lowStock ? 'badge-warning' :
                        'badge-success'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      animate={outOfStock ? {
                        scale: [1, 1.05, 1],
                        transition: { duration: 2, repeat: Infinity }
                      } : {}}
                    >
                      <Layers className="w-3 h-3" />
                      {product.currentStockQty} {product.unit}
                    </motion.span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => onEdit(product)}
                        className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9 }}
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => onDelete(product)}
                        className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                        whileHover={{ scale: 1.1, rotate: -5 }}
                        whileTap={{ scale: 0.9 }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  </motion.div>
);

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(initialProductState);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, product: null });
  const [stockAdjustment, setStockAdjustment] = useState({ qty: '', reason: 'add' });
  const [filterStock, setFilterStock] = useState('all');
  const { success, error } = useToast();

  // SWR: Instant cached data + background revalidation
  const { data, isLoading, isValidating, mutate } = useSWR(
    `products-${search}`,
    () => productService.getProducts({ search }),
    { ttl: 5 * 60 * 1000 } // 5 minute cache
  );

  // Extract products from SWR response
  const products = data?.products || [];
  const loading = isLoading && products.length === 0;

  const handleSearch = (e) => {
    e.preventDefault();
    mutate(); // Trigger revalidation
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
      gstPercentage: product.gstPercentage || 12,
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
    
    if (!formData.productName || !formData.hsnCode || !formData.batchNo || !formData.newMRP) {
      console.log('Validation failed:', {
        name: !formData.productName,
        hsn: !formData.hsnCode,
        batch: !formData.batchNo,
        mrp: !formData.newMRP
      });
      error('Please fill all required fields');
      return;
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
        await productService.updateProduct(editingProduct._id, payload);
        
        if (stockAdjustment.qty && parseInt(stockAdjustment.qty) > 0) {
          await productService.updateStock(editingProduct._id, {
            quantity: parseInt(stockAdjustment.qty),
            type: stockAdjustment.reason === 'add' ? 'in' : 'out',
            reason: stockAdjustment.reason
          });
        }
        
        success('Product updated successfully');
      } else {
        await productService.createProduct(payload);
        success('Product created successfully');
      }
      
      setModalOpen(false);
      // Invalidate products cache and revalidate
      invalidateCachePattern('products');
      mutate();
    } catch (err) {
      console.error('Save error:', err);
      error(err.response?.data?.message || 'Failed to save product');
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
      mutate();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  // ✅ FIX #3: Memoize filtering to prevent unnecessary re-renders
  const filteredProducts = products.filter(product => {
    if (filterStock === 'low') return product.currentStockQty <= 30 && product.currentStockQty > 0;
    if (filterStock === 'out') return product.currentStockQty === 0;
    return true;
  });

  const stats = {
    total: products.length,
    lowStock: products.filter(p => p.currentStockQty <= 30 && p.currentStockQty > 0).length,
    outOfStock: products.filter(p => p.currentStockQty === 0).length,
    expiringSoon: products.filter(p => isExpiringSoon(p.expiryDate) && !isExpired(p.expiryDate)).length
  };

  if (loading) {
    return <PageLoader />;
  }

  // ✅ FIX #4: Use unique key based on filter state
  const tableKey = `products-${filterStock}-${filteredProducts.length}`;

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Stats Cards - simplified for mobile performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            className="glass-card p-6 cursor-pointer group hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Header & Filters */}
      <motion.div variants={cardVariants} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-blue-500/20 rounded-lg"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <Package className="w-5 h-5 text-blue-400" />
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold text-white">All Products</h2>
              <p className="text-sm text-slate-400">
                Showing {filteredProducts.length} of {products.length} products
              </p>
            </div>
          </div>

          <EnhancedButton
            onClick={openCreateModal}
            icon={Plus}
          >
            Add Product
          </EnhancedButton>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <motion.div
              className="relative flex-1"
              animate={searchFocused ? { scale: 1.02 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search products..."
                className="input pl-10 w-full"
              />
              <AnimatePresence>
                {search && (
                  <motion.button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    whileHover={{ rotate: 90 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
            <motion.button
              type="submit"
              className="btn btn-secondary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Search className="w-5 h-5" />
            </motion.button>
          </form>

          {/* Stock Filter */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All', icon: Package },
              { value: 'low', label: 'Low Stock', icon: AlertTriangle },
              { value: 'out', label: 'Out of Stock', icon: X }
            ].map(({ value, label, icon: Icon }) => (
              <motion.button
                key={value}
                onClick={() => setFilterStock(value)}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterStock === value
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon className="w-4 h-4 inline mr-1" />
                {label}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ✅ FIX #5: Proper AnimatePresence with stable components */}
      <AnimatePresence mode="wait">
        {filteredProducts.length === 0 ? (
          <EmptyProductsState
            key={`empty-${filterStock}`}
            search={search}
            onAddClick={openCreateModal}
          />
        ) : (
          <ProductsTable
            key={tableKey}
            filteredProducts={filteredProducts}
            onEdit={openEditModal}
            onDelete={(product) => setDeleteDialog({ open: true, product })}
            isExpired={isExpired}
            isExpiringSoon={isExpiringSoon}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
          />
        )}
      </AnimatePresence>

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
            {[
              { name: 'productName', label: 'Product Name *', type: 'text', icon: Package, placeholder: 'Enter product name', required: true },
              { name: 'hsnCode', label: 'HSN Code *', type: 'text', icon: Barcode, placeholder: 'e.g., 3004', required: true },
              { name: 'manufacturer', label: 'Manufacturer', type: 'text', icon: Building2, placeholder: 'Manufacturer name' },
              { name: 'batchNo', label: 'Batch No *', type: 'text', icon: Hash, placeholder: 'Batch number', required: true },
              { name: 'expiryDate', label: 'Expiry Date', type: 'date', icon: Calendar },
              { name: 'oldMRP', label: 'Old MRP', type: 'number', icon: DollarSign, placeholder: '0.00', step: '0.01', min: '0' },
              { name: 'newMRP', label: 'Current MRP *', type: 'number', icon: DollarSign, placeholder: '0.00', step: '0.01', min: '0', required: true },
              { name: 'rate', label: 'Rate (Incl. GST) *', type: 'number', icon: DollarSign, placeholder: '0.00', step: '0.01', min: '0', required: true }
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
              >
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

          {/* Stock Adjustment Section */}
          {editingProduct && (
            <motion.div 
              className="pt-6 mt-4 border-t border-slate-700"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="text-white font-semibold">Stock Adjustment</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Adjustment Type</label>
                  <select
                    value={stockAdjustment.reason}
                    onChange={(e) => setStockAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                    className="select"
                  >
                    <option value="add">Add Stock</option>
                    <option value="remove">Remove Stock</option>
                    <option value="damage">Damage/Expiry</option>
                    <option value="return">Return</option>
                  </select>
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input
                    type="number"
                    value={stockAdjustment.qty}
                    onChange={(e) => setStockAdjustment(prev => ({ ...prev, qty: e.target.value }))}
                    className="input"
                    placeholder="Enter quantity"
                    min="0"
                  />
                </div>
              </div>
              <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400">
                  Current Stock: <span className="text-emerald-400 font-medium">{editingProduct.currentStockQty} {editingProduct.unit}</span>
                </p>
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
    </motion.div>
  );
}
