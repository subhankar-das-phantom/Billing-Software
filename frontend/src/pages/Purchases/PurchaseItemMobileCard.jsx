import { motion } from 'framer-motion';
import { Package, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function PurchaseItemMobileCard({
  item,
  index,
  handleUpdateItem,
  handleRemoveItem
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
            <h3 className="font-semibold text-white text-base leading-tight flex items-center gap-2 flex-wrap">
              {item.productName}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Current Stock: <span className="text-emerald-400 font-medium">{item.currentStock}</span></p>
          </div>
          <div className="text-right shrink-0 space-y-1">
            <span className="inline-flex items-center justify-end gap-1 px-2 py-1 rounded-md text-xs font-bold text-emerald-400">
              Total: {formatCurrency(item.total)}
            </span>
            <div className="text-xs text-slate-400 px-1 mt-0.5">
              GST: {item.gstPercent}% (₹{Number(item.gstAmount || 0).toFixed(2)})
            </div>
          </div>
        </div>
      </div>

      {/* Body: Inputs */}
      <div className="p-4 space-y-4">
        {/* Row 1: Qty & Free */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Qty</label>
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
              className="input w-full py-2 text-center text-sm font-medium"
              min="1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Free Qty</label>
            <input
              type="number"
              value={item.freeQuantity}
              onChange={(e) => handleUpdateItem(index, 'freeQuantity', e.target.value)}
              className="input w-full py-2 text-center text-sm"
              min="0"
            />
          </div>
        </div>

        {/* Row 2: Batch & Expiry */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Batch (Opt)</label>
            <input
              type="text"
              value={item.batchNumber}
              onChange={(e) => handleUpdateItem(index, 'batchNumber', e.target.value)}
              className="input w-full py-2 text-center text-xs font-mono"
              placeholder="New Batch"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Expiry (Opt)</label>
            <input
              type="date"
              value={item.expiryDate}
              onChange={(e) => handleUpdateItem(index, 'expiryDate', e.target.value)}
              className="input w-full py-2 text-center text-xs"
            />
          </div>
        </div>

        {/* Row 3: Rates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-blue-400 mb-1.5">Pur. Rate</label>
            <input
              type="number"
              value={item.purchaseRate}
              onChange={(e) => handleUpdateItem(index, 'purchaseRate', e.target.value)}
              className="input w-full py-2 text-center text-sm text-blue-400 font-medium"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-accent-400 mb-1.5">Sell Rate</label>
            <input
              type="number"
              value={item.sellingRate}
              onChange={(e) => handleUpdateItem(index, 'sellingRate', e.target.value)}
              className="input w-full py-2 text-center text-sm text-accent-400 font-medium"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Row 4: MRP & Discount & GST */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">MRP</label>
            <input
              type="number"
              value={item.mrp}
              onChange={(e) => handleUpdateItem(index, 'mrp', e.target.value)}
              className="input w-full py-2 text-center text-xs"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Disc %</label>
            <input
              type="number"
              value={item.discount}
              onChange={(e) => handleUpdateItem(index, 'discount', e.target.value)}
              className="input w-full py-2 text-center text-xs"
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">GST %</label>
            <select
              value={item.gstPercent}
              onChange={(e) => handleUpdateItem(index, 'gstPercent', e.target.value)}
              className="select w-full py-2 text-center text-xs"
            >
              {[0, 5, 12, 18, 28].map(gst => (
                <option key={gst} value={gst}>{gst}%</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Footer: Actions */}
      <div className="p-3 border-t border-slate-700 bg-slate-900/30 flex justify-end">
        <button
          type="button"
          onClick={() => handleRemoveItem(index)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors w-full sm:w-auto"
        >
          <Trash2 className="w-4 h-4" />
          Remove Item
        </button>
      </div>
    </motion.div>
  );
}
