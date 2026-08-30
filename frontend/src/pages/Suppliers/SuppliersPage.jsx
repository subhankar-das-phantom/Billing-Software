import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit2, Trash2, Phone, Mail, MapPin, Truck, AlertCircle } from 'lucide-react';
import { supplierService } from '../../services/suppliers/supplierService';
import { formatCurrency, formatPhone } from '../../utils/formatters';
import SupplierFormModal from '../../components/Suppliers/SupplierFormModal';
import ConfirmDialog from '../../components/Common/Dialogs/ConfirmDialog';
import EnhancedButton from '../../components/Common/Buttons/EnhancedButton';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce } from '../../hooks';
import { Link } from 'react-router-dom';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, supplier: null });
  const [total, setTotal] = useState(0);

  const { showToast } = useToast();
  const [debouncedSearch] = useDebounce(searchQuery, 500);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supplierService.getSuppliers({ search: debouncedSearch, limit: 100 });
      setSuppliers(data.suppliers || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      showToast('Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, showToast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleDelete = async () => {
    try {
      if (deleteDialog.supplier) {
        await supplierService.deleteSupplier(deleteDialog.supplier._id);
        showToast('Supplier deleted successfully', 'success');
        fetchSuppliers();
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      showToast('Failed to delete supplier', 'error');
    } finally {
      setDeleteDialog({ open: false, supplier: null });
    }
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" />
            Suppliers
          </h1>
          <p className="text-slate-400 mt-1">Manage your vendors and suppliers</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
            />
          </div>
          <EnhancedButton onClick={openAddModal} variant="primary" icon={Plus}>
            Add Supplier
          </EnhancedButton>
        </div>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Truck className="w-12 h-12 mb-4 text-slate-600" />
            <p className="text-lg font-medium">No suppliers found</p>
            <p className="text-sm mt-1">Add a new supplier to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {suppliers.map((supplier) => (
              <div key={supplier._id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800 transition-colors group relative">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-white truncate max-w-[200px]">
                      {supplier.name}
                    </h3>
                    {!supplier.isActive && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                    <button
                      onClick={() => openEditModal(supplier)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteDialog({ open: true, supplier })}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {supplier.contactPerson && (
                    <p className="text-slate-300 flex items-center gap-2">
                      <span className="text-slate-500 text-xs">By:</span> {supplier.contactPerson}
                    </p>
                  )}
                  {supplier.phone && (
                    <p className="text-slate-400 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" /> {formatPhone(supplier.phone)}
                    </p>
                  )}
                  {supplier.email && (
                    <p className="text-slate-400 flex items-center gap-2 truncate">
                      <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" /> {supplier.email}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500">Opening Balance</p>
                    <p className="font-medium text-white">{formatCurrency(supplier.openingBalance)}</p>
                  </div>
                  <Link 
                    to={`/suppliers/${supplier._id}`}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        supplier={editingSupplier}
        onSuccess={fetchSuppliers}
      />

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, supplier: null })}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete ${deleteDialog.supplier?.name}? This action cannot be undone.`}
        confirmText="Delete Supplier"
        isDestructive
      />
    </div>
  );
}
