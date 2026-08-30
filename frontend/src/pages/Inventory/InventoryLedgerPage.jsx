import { useState, useEffect, useCallback, useRef } from 'react';
import stockMovementService from '../../services/stockMovementService';
import { productService } from '../../services/products/productService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce } from '../../hooks';
import { Package, Search, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InventoryLedgerPage() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filters
  const [searchProductId, setSearchProductId] = useState('');
  const [searchBatchId, setSearchBatchId] = useState('');
  
  // Product Search Dropdown State
  const [productSearchText, setProductSearchText] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [isProductSearchLoading, setIsProductSearchLoading] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [debouncedProductSearchText] = useDebounce(productSearchText, 300);
  const latestProductSearchRequest = useRef(0);
  const [movementType, setMovementType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { showToast } = useToast();
  
  // Debounce batch search
  const [debouncedBatchId] = useDebounce(searchBatchId, 500);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.product-search-container')) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch products for search dropdown
  useEffect(() => {
    const query = debouncedProductSearchText.trim();
    const abortController = new AbortController();

    if (!showProductDropdown) return;

    if (query.length < 1) {
      setProductResults([]);
      setIsProductSearchLoading(false);
      return;
    }

    const requestId = latestProductSearchRequest.current + 1;
    latestProductSearchRequest.current = requestId;
    setIsProductSearchLoading(true);

    (async () => {
      try {
        const data = await productService.getProducts(
          { search: query, limit: 10, page: 1 },
          { signal: abortController.signal }
        );

        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults(data.products || []);
      } catch (err) {
        if (err.name === 'CanceledError' || err.message === 'canceled') return;
        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults([]);
      } finally {
        if (latestProductSearchRequest.current === requestId) {
          setIsProductSearchLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [debouncedProductSearchText, showProductDropdown]);

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await stockMovementService.getStockMovements({
        productId: searchProductId, // Use exact ID when fetched
        batchId: debouncedBatchId,
        type: movementType,
        dateFrom,
        dateTo,
        page,
        limit
      });
      setMovements(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      showToast('Failed to load inventory ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchProductId, debouncedBatchId, movementType, dateFrom, dateTo, page, showToast]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

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

  const getMovementColor = (qty) => {
    return qty > 0 ? 'text-green-600 font-medium' : qty < 0 ? 'text-red-600 font-medium' : 'text-gray-600';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">Inventory Ledger</h1>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 sm:p-6 mb-6 flex flex-wrap gap-4 relative z-40">
        <div className="relative product-search-container">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Product</label>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              className="input pl-9 pr-8 w-full"
              placeholder="Search product..."
              value={productSearchText}
              onChange={(e) => {
                setProductSearchText(e.target.value);
                setSearchProductId(''); // Clear actual ID if they change the text
                setShowProductDropdown(true);
                setPage(1);
              }}
              onFocus={() => setShowProductDropdown(true)}
            />
            {productSearchText && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                onClick={() => {
                  setProductSearchText('');
                  setSearchProductId('');
                  setShowProductDropdown(false);
                  setPage(1);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <AnimatePresence>
              {showProductDropdown && productSearchText && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 z-50 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
                >
                  {isProductSearchLoading && (
                    <div className="px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </div>
                  )}

                  {!isProductSearchLoading && productSearchText.trim().length >= 1 && productResults.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      No products found
                    </div>
                  )}

                  {!isProductSearchLoading && productResults.map((product) => (
                    <button
                      key={product._id}
                      onClick={() => {
                        setSearchProductId(product._id);
                        setProductSearchText(product.productName);
                        setShowProductDropdown(false);
                        setPage(1);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                    >
                      <p className="font-medium text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-accent-400" />
                        {product.productName}
                      </p>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Batch ID</label>
          <input
            type="text"
            className="input w-48"
            placeholder="Search Batch ID..."
            value={searchBatchId}
            onChange={(e) => { setSearchBatchId(e.target.value); setPage(1); }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Type</label>
          <select 
            className="input w-40"
            value={movementType}
            onChange={(e) => { setMovementType(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            <option value="PURCHASE">Purchase</option>
            <option value="SALE">Sale</option>
            <option value="MANUAL_ADJUSTMENT_IN">Adjustment In</option>
            <option value="MANUAL_ADJUSTMENT_OUT">Adjustment Out</option>
            <option value="PURCHASE_RETURN">Purchase Return</option>
            <option value="SALE_REVERSAL">Sale Reversal</option>
            <option value="OPENING_STOCK">Opening Stock</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">From Date</label>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">To Date</label>
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading ledger...</div>
        ) : movements.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No inventory movements found matching the criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800/50 border-b border-white/5">
                <tr>
                  <th className="p-4 font-semibold text-slate-300">Date/Time</th>
                  <th className="p-4 font-semibold text-slate-300">Type</th>
                  <th className="p-4 font-semibold text-slate-300">Product</th>
                  <th className="p-4 font-semibold text-slate-300">Batch</th>
                  <th className="p-4 font-semibold text-slate-300 text-right">Qty Change</th>
                  <th className="p-4 font-semibold text-slate-300 text-right">Value (Rate)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {movements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  return (
                    <tr key={mov._id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-slate-300">
                        {formatDate(mov.createdAt)} <span className="text-xs text-slate-500">({new Date(mov.createdAt).toLocaleTimeString()})</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-slate-300 bg-slate-800 px-2 py-1 rounded">
                          {mov.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">{mov.product?.productName || mov.productName || '-'}</td>
                      <td className="p-4 text-slate-400 text-sm">
                        {(() => {
                          const bNo = mov.batch?.batchNo || mov.batch?.batchNumber || mov.batchNumber;
                          const bDisplay = bNo && bNo !== 'UNNAMED' ? bNo : (mov.batch || mov.batchId ? 'No Batch #' : '-');
                          const bExp = mov.batch?.expiryDate || mov.expiryDate;
                          return `${bDisplay}${bExp ? ` (Exp: ${formatDate(bExp)})` : ''}`;
                        })()}
                      </td>
                      <td className={`p-4 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{mov.quantity}
                      </td>
                      <td className="p-4 text-right text-slate-300">
                        {formatCurrency(mov.totalValue)}
                        <div className="text-xs text-slate-500">@{formatCurrency(mov.unitValue)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > limit && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg border border-white/10 text-slate-300 disabled:opacity-50 hover:bg-white/5 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg border border-white/10 text-slate-300 disabled:opacity-50 hover:bg-white/5 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
