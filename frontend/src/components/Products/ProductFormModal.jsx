import { useState, useEffect } from 'react';
import { 
  Package, 
  Barcode, 
  Building2, 
  Hash, 
  Calendar, 
  DollarSign, 
  Percent, 
  Ruler, 
  Layers, 
  Loader2 
} from 'lucide-react';
import Modal from '../Common/Modals/Modal';
import EnhancedButton from '../Common/Buttons/EnhancedButton';
import { productService } from '../../services/products/productService';
import { GST_RATES } from '../../utils/calculations';
import { useToast } from '../../contexts/ToastContext';
import { invalidateCachePattern } from '../../hooks';

const initialProductState = {
  productName: '',
  hsnCode: '',
  manufacturer: '',
  batchNo: '',
  expiryDate: '',
  oldMRP: '',
  newMRP: '',
  rate: '',
  gstPercentage: '12',
  openingStockQty: '0',
  unit: 'Pieces'
};

const UNIT_OPTIONS = ['Pieces', 'Strips', 'Bottles', 'Boxes', 'ML', 'GM'];

export default function ProductFormModal({ 
  isOpen, 
  onClose, 
  initialName = '', 
  product = null, 
  onSuccess 
}) {
  const [formData, setFormData] = useState(initialProductState);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (product) {
      setFormData({
        productName: product.productName || '',
        hsnCode: product.hsnCode || '',
        manufacturer: product.manufacturer || '',
        batchNo: product.batchNo || '',
        expiryDate: product.expiryDate ? product.expiryDate.split('T')[0] : '',
        oldMRP: product.oldMRP != null ? String(product.oldMRP) : '',
        newMRP: product.newMRP != null ? String(product.newMRP) : '',
        rate: product.rate != null ? String(product.rate) : '',
        gstPercentage: product.gstPercentage != null ? String(product.gstPercentage) : '12',
        openingStockQty: product.openingStockQty != null ? String(product.openingStockQty) : '0',
        unit: product.unit || 'Pieces'
      });
    } else {
      setFormData({
        ...initialProductState,
        productName: initialName || ''
      });
    }
  }, [product, initialName, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.productName.trim()) {
      showToast('Product Name is required', 'error');
      return;
    }
    if (!formData.hsnCode.trim()) {
      showToast('HSN Code is required', 'error');
      return;
    }
    if (!formData.newMRP || Number(formData.newMRP) <= 0) {
      showToast('A valid MRP is required', 'error');
      return;
    }
    if (!formData.rate || Number(formData.rate) < 0) {
      showToast('A valid Rate is required', 'error');
      return;
    }
    if (formData.gstPercentage === '') {
      showToast('GST % is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        productName: formData.productName.trim(),
        hsnCode: formData.hsnCode.trim(),
        manufacturer: formData.manufacturer.trim(),
        batchNo: formData.batchNo.trim(),
        expiryDate: formData.expiryDate || null,
        oldMRP: parseFloat(formData.oldMRP) || 0,
        newMRP: parseFloat(formData.newMRP),
        rate: parseFloat(formData.rate),
        purchaseRate: parseFloat(formData.rate),
        gstPercentage: parseInt(formData.gstPercentage, 10),
        unit: formData.unit,
        openingStockQty: parseInt(formData.openingStockQty, 10) || 0
      };

      let savedProduct;
      if (product && product._id) {
        const res = await productService.updateProduct(product._id, payload);
        savedProduct = res.product || res.data || { ...product, ...payload };
        showToast('Product updated successfully', 'success');
      } else {
        const res = await productService.createProduct(payload);
        savedProduct = res.product || res.data || res;
        showToast('Product created successfully', 'success');
      }

      invalidateCachePattern('products');
      onClose();

      if (onSuccess) {
        requestAnimationFrame(() => {
          onSuccess(savedProduct);
        });
      }
    } catch (err) {
      console.error('Error saving product:', err);
      const resData = err.response?.data;
      if (resData?.errors && resData.errors.length > 0) {
        const errorMessages = resData.errors.map(e => e.message).join(', ');
        showToast(`Validation failed: ${errorMessages}`, 'error');
      } else {
        showToast(resData?.message || err.message || 'Failed to save product', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add New Product'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Product Name */}
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-400" />
              <span>Product Name <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleInputChange}
              className="input w-full text-xs sm:text-sm"
              placeholder="Enter product name"
              required
              autoFocus
            />
          </div>

          {/* HSN Code */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-slate-400" />
              <span>HSN Code <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              name="hsnCode"
              value={formData.hsnCode}
              onChange={handleInputChange}
              className="input w-full text-xs sm:text-sm"
              placeholder="e.g. 3004"
              required
            />
          </div>

          {/* Unit */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-slate-400" />
              <span>Unit <span className="text-rose-400">*</span></span>
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              className="select w-full text-xs sm:text-sm"
              required
            >
              {UNIT_OPTIONS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {/* MRP */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span>MRP (₹) <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="number"
              name="newMRP"
              value={formData.newMRP}
              onChange={handleInputChange}
              className="input w-full text-xs sm:text-sm font-mono"
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          {/* Rate (Purchase/Cost Rate) */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span>Rate / Cost Price (₹) <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="number"
              name="rate"
              value={formData.rate}
              onChange={handleInputChange}
              className="input w-full text-xs sm:text-sm font-mono"
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          {/* GST % */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-slate-400" />
              <span>GST % <span className="text-rose-400">*</span></span>
            </label>
            <select
              name="gstPercentage"
              value={formData.gstPercentage}
              onChange={handleInputChange}
              className="select w-full text-xs sm:text-sm"
              required
            >
              {GST_RATES.map(rate => (
                <option key={rate} value={rate}>{rate}%</option>
              ))}
            </select>
          </div>

          {/* Manufacturer (Optional) */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>Manufacturer (Optional)</span>
            </label>
            <input
              type="text"
              name="manufacturer"
              value={formData.manufacturer}
              onChange={handleInputChange}
              className="input w-full text-xs sm:text-sm"
              placeholder="Manufacturer name"
            />
          </div>

          {/* Batch No (Optional) */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-400 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-slate-500" />
              <span>Batch No (Optional)</span>
            </label>
            <input
              type="text"
              name="batchNo"
              value={formData.batchNo}
              onChange={handleInputChange}
              className="input w-full text-xs sm:text-sm"
              placeholder="e.g. B-101"
            />
          </div>

          {/* Expiry Date (Optional) */}
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Expiry Date (Optional)</span>
            </label>
            <input
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleInputChange}
              className="input w-full text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary px-4 py-2 text-xs sm:text-sm"
            disabled={saving}
          >
            Cancel
          </button>
          <EnhancedButton
            type="submit"
            disabled={saving}
            icon={saving ? Loader2 : null}
            className="px-4 py-2 text-xs sm:text-sm"
          >
            {saving ? 'Saving...' : (product ? 'Update Product' : 'Add to Catalog')}
          </EnhancedButton>
        </div>
      </form>
    </Modal>
  );
}
