import { motion } from 'framer-motion';
import { Package, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { round } from '../../utils/calculations';

export default function InvoiceItemMobileCard({
  item,
  index,
  updateItemQuantity,
  removeItem,
  availableStock,
  maxSoldQuantity,
  enableBatchTracking,
  allocationMode,
  openBatchModal
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden mb-4 shadow-sm"
    >
      {/* Header: Product Info */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h3 className="font-semibold text-white text-base leading-tight">
              {item.product.productName}
            </h3>
            {item.product.hsnCode && (
              <p className="text-xs text-slate-400 mt-1">HSN: {item.product.hsnCode}</p>
            )}
          </div>
          <div className="text-right shrink-0 space-y-1">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/50 text-xs font-medium text-slate-300">
              <Package className="w-3 h-3" />
              Available: {availableStock}
            </span>
            {item.product.newMRP != null && (
              <p className="text-xs text-slate-500 px-1">
                MRP: ₹{item.product.newMRP}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          GST: <span className="text-slate-300 font-medium">{item.product.gstPercentage}%</span> (₹{item.gstAmount.toFixed(2)})
        </div>
        
        {enableBatchTracking && allocationMode === 'MANUAL' && (
          <div className="mt-2">
            <button 
              onClick={() => openBatchModal(index, item)}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              {item.manualAllocations ? 'Edit Batch Allocation' : 'Select Batches'} 
              {item.manualAllocations && ` (${item.manualAllocations.reduce((s, a) => s + a.quantity, 0)}/${(Number(item.quantitySold) || 0) + (Number(item.freeQuantity) || 0)})`}
            </button>
          </div>
        )}
      </div>

      {/* Body: Inputs */}
      <div className="p-4 space-y-4">
        {/* Row 1: Qty & Free */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Qty</label>
            <input
              type="number"
              value={item.quantitySold}
              onChange={(e) => updateItemQuantity(index, 'quantitySold', e.target.value)}
              className="input w-full py-2 text-center text-sm"
              min="1"
              max={maxSoldQuantity}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Free Qty</label>
            <input
              type="number"
              value={item.freeQuantity}
              onChange={(e) => updateItemQuantity(index, 'freeQuantity', e.target.value)}
              className="input w-full py-2 text-center text-sm"
              min="0"
            />
          </div>
        </div>

        {/* Row 2: Base Rate & Net Rate */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Base Rate</label>
            <input
              type="number"
              value={item.baseRate}
              onChange={(e) => updateItemQuantity(index, 'baseRate', e.target.value)}
              className="input w-full py-2 text-center text-sm"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Net Rate</label>
            <input
              type="text"
              inputMode="decimal"
              value={item.netRate !== undefined ? item.netRate : round(item.baseRate * (1 + item.product.gstPercentage / 100), 2)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  updateItemQuantity(index, 'netRate', val);
                }
              }}
              onBlur={(e) => {
                const val = parseFloat(e.target.value) || 0;
                updateItemQuantity(index, 'netRate', val.toString());
              }}
              className="input w-full py-2 text-center text-sm text-blue-400 font-medium"
            />
          </div>
        </div>

        {/* Row 3: Discount & Line Total (Base Amount) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Discount %</label>
            <input
              type="number"
              value={item.schemeDiscount}
              onChange={(e) => updateItemQuantity(index, 'schemeDiscount', e.target.value)}
              className="input w-full py-2 text-center text-sm"
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Line Total (Base)</label>
            <input
              type="number"
              value={item.baseAmount}
              onChange={(e) => updateItemQuantity(index, 'baseAmount', e.target.value)}
              className="input w-full py-2 text-center text-sm text-emerald-400 font-medium"
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </div>

      {/* Footer: Actions */}
      <div className="p-3 border-t border-slate-700 bg-slate-900/30 flex justify-end">
        <button
          onClick={() => removeItem(index)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors w-full sm:w-auto"
        >
          <Trash2 className="w-4 h-4" />
          Remove Item
        </button>
      </div>
    </motion.div>
  );
}
