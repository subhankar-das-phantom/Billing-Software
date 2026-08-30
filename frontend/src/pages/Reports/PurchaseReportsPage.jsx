import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Calendar, ArrowUpRight, ArrowDownRight, Package, Users } from 'lucide-react';
import { purchaseReportService } from '../../services/reports/purchaseReportService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';

export default function PurchaseReportsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [supplierData, setSupplierData] = useState([]);
  const [productData, setProductData] = useState([]);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { showToast } = useToast();

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = { dateFrom, dateTo };
      
      const [sumData, supData, prodData] = await Promise.all([
        purchaseReportService.getPurchaseSummary(params),
        purchaseReportService.getSupplierWisePurchases(params),
        purchaseReportService.getProductWisePurchases(params)
      ]);
      
      setSummary(sumData.data);
      setSupplierData(supData.data);
      setProductData(prodData.data);
    } catch (error) {
      showToast('Failed to load purchase reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, showToast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="text-indigo-600" />
          Purchase Reports
        </h1>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">From Date (Purchase Date)</label>
          <input
            type="date"
            className="border rounded px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">To Date (Purchase Date)</label>
          <input
            type="date"
            className="border rounded px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-500">Loading reports...</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4 flex items-center shadow-sm border-l-4 border-l-blue-500">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Total Purchases</p>
                <h3 className="text-2xl font-bold text-gray-800">{summary?.totalPurchases || 0}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600"><ShoppingCart /></div>
            </div>
            
            <div className="bg-white rounded-lg border p-4 flex items-center shadow-sm border-l-4 border-l-green-500">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Completed Value</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(summary?.completed?.value || 0)}</h3>
                <p className="text-xs text-green-600 font-medium mt-1">{summary?.completed?.count || 0} transactions</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full text-green-600"><ArrowUpRight /></div>
            </div>
            
            <div className="bg-white rounded-lg border p-4 flex items-center shadow-sm border-l-4 border-l-red-500">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Cancelled Value</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(summary?.cancelled?.value || 0)}</h3>
                <p className="text-xs text-red-600 font-medium mt-1">{summary?.cancelled?.count || 0} transactions</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full text-red-600"><ArrowDownRight /></div>
            </div>

            <div className="bg-white rounded-lg border p-4 flex items-center shadow-sm border-l-4 border-l-yellow-500">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Draft Value</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(summary?.draft?.value || 0)}</h3>
                <p className="text-xs text-yellow-600 font-medium mt-1">{summary?.draft?.count || 0} pending</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-full text-yellow-600"><Calendar /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Supplier Wise */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                <Users size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-700">Supplier Wise Analysis</h2>
              </div>
              <div className="overflow-y-auto max-h-96">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-white sticky top-0">
                    <tr className="text-gray-600 border-b">
                      <th className="p-3">Supplier</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Count</th>
                      <th className="p-3 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierData.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{row.supplierName || 'Unknown'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            row.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            row.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">{row.count}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(row.totalValue)}</td>
                      </tr>
                    ))}
                    {supplierData.length === 0 && (
                      <tr><td colSpan="4" className="p-4 text-center text-gray-500">No data found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Wise */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                <Package size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-700">Product Wise Analysis</h2>
              </div>
              <div className="overflow-y-auto max-h-96">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-white sticky top-0">
                    <tr className="text-gray-600 border-b">
                      <th className="p-3">Product</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Free</th>
                      <th className="p-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productData.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-800">{row.productName || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{row.sku}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            row.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            row.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">{row.quantity}</td>
                        <td className="p-3 text-right text-gray-500">{row.freeQuantity}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(row.totalValue)}</td>
                      </tr>
                    ))}
                    {productData.length === 0 && (
                      <tr><td colSpan="5" className="p-4 text-center text-gray-500">No data found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
