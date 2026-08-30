import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Phone, Mail, MapPin, FileText, Calendar, Loader2, DollarSign } from 'lucide-react';
import { supplierService } from '../../services/suppliers/supplierService';
import EnhancedButton from '../../components/Common/Buttons/EnhancedButton';
import SupplierFormModal from '../../components/Suppliers/SupplierFormModal';
import { formatCurrency, formatPhone } from '../../utils/formatters';

export default function SupplierDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const data = await supplierService.getSupplier(id);
      setSupplier(data.supplier);
    } catch (error) {
      console.error('Error fetching supplier details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplier();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl text-white mb-4">Supplier not found</h2>
        <EnhancedButton onClick={() => navigate('/suppliers')} variant="ghost" icon={ArrowLeft}>
          Back to Suppliers
        </EnhancedButton>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/suppliers')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              {supplier.name}
              {!supplier.isActive && (
                <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20 uppercase tracking-wider font-semibold">
                  Inactive
                </span>
              )}
            </h1>
            {supplier.contactPerson && (
              <p className="text-slate-400 mt-1">Contact: {supplier.contactPerson}</p>
            )}
          </div>
        </div>
        <EnhancedButton onClick={() => setIsEditModalOpen(true)} variant="secondary" icon={Edit2}>
          Edit Supplier
        </EnhancedButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">Contact Information</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 text-slate-300">
                <Phone className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-200">Phone</p>
                  <p className="text-slate-400">{formatPhone(supplier.phone) || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-slate-300">
                <Mail className="w-4 h-4 text-slate-500 mt-0.5" />
                <div className="break-all">
                  <p className="font-medium text-slate-200">Email</p>
                  <p className="text-slate-400">{supplier.email || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-slate-300">
                <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-200">Address</p>
                  <p className="text-slate-400">{supplier.address || 'N/A'}</p>
                  {supplier.state && <p className="text-slate-400 mt-1">{supplier.state}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3 text-slate-300">
                <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-200">GSTIN</p>
                  <p className="text-slate-400 uppercase">{supplier.gstin || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">Account Details</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Opening Balance</span>
                <span className="text-white font-medium">{formatCurrency(supplier.openingBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Payment Terms</span>
                <span className="text-white">{supplier.paymentTerms || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Added On</span>
                <span className="text-white">{new Date(supplier.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions/Notes placeholder */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full flex flex-col">
            <h3 className="font-semibold text-white mb-4">Recent Activity (Phase 2 Placeholder)</h3>
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3">
              <DollarSign className="w-12 h-12 text-slate-700" />
              <p>Purchase entry and ledger functionality will be implemented in subsequent phases.</p>
            </div>
          </div>
        </div>
      </div>

      <SupplierFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        supplier={supplier}
        onSuccess={fetchSupplier}
      />
    </div>
  );
}
