import { useState, useEffect, useCallback } from 'react';
import { History, ArrowRightLeft, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';
import { purchaseReportService } from '../../services/reports/purchaseReportService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';

export default function InventoryMovementReportPage() {
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState({ inflow: [], outflow: [], summary: [] });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { showToast } = useToast();

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await purchaseReportService.getInventoryFlowSummary({ dateFrom, dateTo });
      setFlow(data || { inflow: [], outflow: [], summary: [] });
    } catch (error) {
      showToast('Failed to load inventory flow reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, showToast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const getMovementLabel = (type) => {
    const labels = {
      'PURCHASE': 'Purchase',
      'PURCHASE_RETURN': 'Purchase Return',
      'SALE': 'Sale',
      'SALE_REVERSAL': 'Sale Reversal',
      'SALE_RETURN': 'Sale Return',
      'OPENING_STOCK': 'Opening Stock',
      'MANUAL_ADJUSTMENT_IN': 'Adjustment In',
      'MANUAL_ADJUSTMENT_OUT': 'Adjustment Out'
    };
    return labels[type] || type;
  };

  const calcTotalQty = (arr) => arr.reduce((sum, item) => sum + Math.abs(item.quantity), 0);
  const calcTotalCount = (arr) => arr.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ArrowRightLeft className="text-emerald-600" />
          Inventory Flow Report
        </h1>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">From Date</label>
          <input
            type="date"
            className="border rounded px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">To Date</label>
          <input
            type="date"
            className="border rounded px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded text-blue-800 text-sm flex gap-3">
        <RefreshCcw className="flex-shrink-0" />
        <p>This report categorizes operational physical stock movements into <strong>Inflow</strong> and <strong>Outflow</strong> based on recorded system events. It does not calculate Financial Value, COGS, or Inventory Valuation.</p>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-500">Loading reports...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inflow */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-emerald-50 flex items-center gap-2">
              <ArrowDownRight size={18} className="text-emerald-600" />
              <h2 className="font-semibold text-emerald-800">Inventory Inflow</h2>
            </div>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-gray-600 border-b bg-gray-50">
                  <th className="p-3">Movement Type</th>
                  <th className="p-3 text-right">Transactions</th>
                  <th className="p-3 text-right">Total Quantity</th>
                </tr>
              </thead>
              <tbody>
                {flow.inflow.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{getMovementLabel(row.type)}</td>
                    <td className="p-3 text-right text-gray-600">{row.count}</td>
                    <td className="p-3 text-right font-semibold text-emerald-600">+{row.quantity}</td>
                  </tr>
                ))}
                {flow.inflow.length === 0 && (
                  <tr><td colSpan="3" className="p-4 text-center text-gray-500">No inflow data</td></tr>
                )}
                {flow.inflow.length > 0 && (
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-3 text-right">Total Recorded Inflow</td>
                    <td className="p-3 text-right">{calcTotalCount(flow.inflow)}</td>
                    <td className="p-3 text-right text-emerald-600">+{calcTotalQty(flow.inflow)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Outflow */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-rose-50 flex items-center gap-2">
              <ArrowUpRight size={18} className="text-rose-600" />
              <h2 className="font-semibold text-rose-800">Inventory Outflow</h2>
            </div>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-gray-600 border-b bg-gray-50">
                  <th className="p-3">Movement Type</th>
                  <th className="p-3 text-right">Transactions</th>
                  <th className="p-3 text-right">Total Quantity</th>
                </tr>
              </thead>
              <tbody>
                {flow.outflow.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{getMovementLabel(row.type)}</td>
                    <td className="p-3 text-right text-gray-600">{row.count}</td>
                    <td className="p-3 text-right font-semibold text-rose-600">{row.quantity}</td>
                  </tr>
                ))}
                {flow.outflow.length === 0 && (
                  <tr><td colSpan="3" className="p-4 text-center text-gray-500">No outflow data</td></tr>
                )}
                {flow.outflow.length > 0 && (
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-3 text-right">Total Recorded Outflow</td>
                    <td className="p-3 text-right">{calcTotalCount(flow.outflow)}</td>
                    <td className="p-3 text-right text-rose-600">-{calcTotalQty(flow.outflow)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Overall Summary Table */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
              <History size={18} className="text-gray-600" />
              <h2 className="font-semibold text-gray-800">Complete Movement Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-gray-600 border-b">
                    <th className="p-3">Movement Type</th>
                    <th className="p-3 text-right">Movements</th>
                    <th className="p-3 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {flow.summary.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{getMovementLabel(row.type)}</td>
                      <td className="p-3 text-right">{row.count}</td>
                      <td className={`p-3 text-right font-medium ${row.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.quantity > 0 ? '+' : ''}{row.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
