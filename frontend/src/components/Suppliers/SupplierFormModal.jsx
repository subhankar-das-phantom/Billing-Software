import { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, FileText, X, Loader2 } from 'lucide-react';
import Modal from '../Common/Modals/Modal';
import EnhancedButton from '../Common/Buttons/EnhancedButton';
import { supplierService } from '../../services/suppliers/supplierService';
import { useToast } from '../../contexts/ToastContext';

const initialSupplierState = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  state: '',
  paymentTerms: '',
  openingBalance: 0,
  notes: '',
  isActive: true
};

export default function SupplierFormModal({ isOpen, onClose, supplier, onSuccess }) {
  const [formData, setFormData] = useState(initialSupplierState);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (supplier) {
      setFormData({
        ...initialSupplierState,
        ...supplier
      });
    } else {
      setFormData(initialSupplierState);
    }
  }, [supplier, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      showToast('Supplier Name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      if (supplier && supplier._id) {
        await supplierService.updateSupplier(supplier._id, formData);
        showToast('Supplier updated successfully', 'success');
      } else {
        await supplierService.createSupplier(formData);
        showToast('Supplier created successfully', 'success');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving supplier:', error);
      showToast(error.response?.data?.message || 'Error saving supplier', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={supplier ? 'Edit Supplier' : 'Add Supplier'} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Enter supplier name"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              Contact Person
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Contact person name"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Phone number"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Email address"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              GSTIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                name="gstin"
                value={formData.gstin}
                onChange={handleChange}
                className="input pl-10 uppercase"
                placeholder="GSTIN"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              State
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="input pl-10"
                placeholder="State (e.g. Maharashtra)"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-400 block mb-1">
            Address
          </label>
          <div className="relative">
            <div className="absolute top-3 left-3 flex items-start pointer-events-none">
              <MapPin className="h-5 w-5 text-slate-500" />
            </div>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="input pl-10 py-2 min-h-[80px]"
              placeholder="Full address"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              Opening Balance (₹)
            </label>
            <input
              type="number"
              name="openingBalance"
              value={formData.openingBalance}
              onChange={handleChange}
              className="input"
              placeholder="0.00"
              step="0.01"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 block mb-1">
              Payment Terms
            </label>
            <input
              type="text"
              name="paymentTerms"
              value={formData.paymentTerms}
              onChange={handleChange}
              className="input"
              placeholder="e.g. Net 30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-400 block mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="input py-2 min-h-[80px]"
            placeholder="Any additional notes"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800/50 text-blue-500 focus:ring-blue-500/20"
          />
          <label htmlFor="isActive" className="text-sm text-slate-300">
            Active Supplier
          </label>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-700/50">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <EnhancedButton
            type="submit"
            variant="primary"
            isLoading={loading}
          >
            {supplier ? 'Save Changes' : 'Create Supplier'}
          </EnhancedButton>
        </div>
      </form>
    </Modal>
  );
}
