/**
 * Canonical Invoice Columns & Batch Grouping Definitions
 * Single Source of Truth for Screen Preview, Print Dialog & Browser Print
 * Bharat Enterprise Billing System
 */

import React from 'react';

/**
 * Groups batch allocations by unique `${displayName}|${expiryStr}`.
 * Combines quantities into a sum or '+' joined list.
 */
export const getBatchGroups = (allocations) => {
  if (!Array.isArray(allocations) || allocations.length === 0) return [];
  const groupsMap = allocations.reduce((acc, alloc) => {
    const displayName = alloc.batchNo && alloc.batchNo !== 'UNNAMED' ? alloc.batchNo : 'No Batch #';
    let expiryStr = '-';
    if (alloc.expiryDate) {
      if (typeof alloc.expiryDate === 'string' && /^\d{2}\/\d{2}$/.test(alloc.expiryDate.trim())) {
        expiryStr = alloc.expiryDate.trim();
      } else {
        const d = new Date(alloc.expiryDate);
        if (!Number.isNaN(d.getTime())) {
          expiryStr = d.toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' });
        }
      }
    }

    const key = `${displayName}|${expiryStr}`;
    if (!acc[key]) {
      acc[key] = { name: displayName, expiry: expiryStr, qtys: [] };
    }
    acc[key].qtys.push(Number(alloc.quantity) || 0);
    return acc;
  }, {});
  return Object.values(groupsMap);
};

export const DEFAULT_INVOICE_COLUMNS = [
  'qty', 'free', 'productName', 'hsn', 'batchNo',
  'expiry', 'mrp', 'rate', 'net', 'disc',
  'gst', 'amount'
];

/**
 * 12 Authoritative Invoice Columns Definition
 */
export const ALL_INVOICE_COLUMNS = [
  {
    key: 'qty',
    label: 'Qty',
    width: '4%',
    align: 'center',
    render: (item) => item.quantitySold ?? item.quantity ?? 0
  },
  {
    key: 'free',
    label: 'Fr',
    width: '3%',
    align: 'center',
    render: (item) => item.freeQuantity || 0
  },
  {
    key: 'productName',
    label: 'Product Name',
    width: '33%',
    align: 'left',
    render: (item) => {
      const name = item.product?.productName ?? item.productName ?? item.product?.name ?? item.name ?? '-';
      return item.pack ? (
        <span>
          {name} <span className="font-normal text-gray-600">({item.pack})</span>
        </span>
      ) : name;
    }
  },
  {
    key: 'hsn',
    label: 'HSN',
    width: '7%',
    align: 'center',
    render: (item) => item.product?.hsnCode ?? item.hsnCode ?? item.hsn ?? '-'
  },
  {
    key: 'batchNo',
    label: 'Batch',
    width: '10%',
    align: 'center',
    render: (item, { enableBatchTracking = false } = {}) => {
      if (enableBatchTracking && item.batchAllocations?.length > 0) {
        const groups = getBatchGroups(item.batchAllocations);
        if (groups.length > 0) {
          return (
            <div className="flex flex-col gap-0.5">
              {groups.map((g, idx) => {
                const displayQty = g.name === 'No Batch #' ? g.qtys.join('+') : g.qtys.reduce((sum, q) => sum + q, 0);
                return (
                  <span key={idx} className="whitespace-nowrap">
                    {g.name} ({displayQty})
                  </span>
                );
              })}
            </div>
          );
        }
      }
      const bNo = item.product?.batchNo ?? item.batchNumber ?? item.batchNo;
      return bNo && bNo !== 'UNNAMED' ? bNo : 'No Batch #';
    }
  },
  {
    key: 'expiry',
    label: 'Expiry',
    width: '7%',
    align: 'center',
    render: (item, { enableBatchTracking = false } = {}) => {
      if (enableBatchTracking && item.batchAllocations?.length > 0) {
        const groups = getBatchGroups(item.batchAllocations);
        if (groups.length > 0) {
          return (
            <div className="flex flex-col gap-0.5">
              {groups.map((g, idx) => (
                <span key={idx} className="whitespace-nowrap">{g.expiry}</span>
              ))}
            </div>
          );
        }
      }
      const expiryRaw = item.product?.expiryDate ?? item.expiryDate ?? null;
      if (!expiryRaw) return '-';
      if (typeof expiryRaw === 'string' && /^\d{2}\/\d{2}$/.test(expiryRaw.trim())) {
        return expiryRaw.trim();
      }
      const d = new Date(expiryRaw);
      return !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '-';
    }
  },
  {
    key: 'mrp',
    label: 'MRP',
    width: '8%',
    align: 'right',
    render: (item) => {
      const mrp = item.product?.newMRP ?? item.mrp ?? item.newMRP;
      return mrp != null && Number(mrp) > 0 ? Number(mrp).toFixed(2) : '-';
    }
  },
  {
    key: 'rate',
    label: 'Rate',
    width: '7%',
    align: 'right',
    render: (item) => ((item.ratePerUnit ?? item.rate) || 0).toFixed(2)
  },
  {
    key: 'net',
    label: 'Net',
    width: '7%',
    align: 'right',
    render: (item) => {
      const rate = Number(item.ratePerUnit ?? item.rate) || 0;
      const gst = Number(item.product?.gstPercentage ?? item.gstPercentage ?? item.gstRate) || 0;
      const net = item.netRate != null ? Number(item.netRate) : (rate * (1 + gst / 100));
      return net.toFixed(2);
    }
  },
  {
    key: 'disc',
    label: 'Disc%',
    width: '5%',
    align: 'center',
    render: (item) => `${item.schemeDiscount ?? item.discountPercentage ?? 0}%`
  },
  {
    key: 'gst',
    label: 'GST%',
    width: '4%',
    align: 'center',
    render: (item) => `${item.product?.gstPercentage ?? item.gstPercentage ?? item.gstRate ?? 0}%`
  },
  {
    key: 'amount',
    label: 'Amount',
    width: '9%',
    align: 'right',
    render: (item) => {
      const qty = item.quantitySold ?? item.quantity ?? 0;
      const rate = (item.ratePerUnit ?? item.rate) || 0;
      const amt = item.totalAmount != null ? item.totalAmount : (item.amount != null ? item.amount : qty * rate);
      return Number(amt || 0).toFixed(2);
    }
  }
];

/**
 * Resolves active column objects from either:
 * - An array of column objects
 * - An array of column key strings
 * - Undefined / null (defaults to all columns)
 */
export function resolveActiveColumns(columnsInput, { enableBatchTracking = false } = {}) {
  let resolved = ALL_INVOICE_COLUMNS;

  if (Array.isArray(columnsInput) && columnsInput.length > 0) {
    if (typeof columnsInput[0] === 'string') {
      const keySet = new Set(columnsInput);
      resolved = ALL_INVOICE_COLUMNS.filter(c => keySet.has(c.key));
    } else if (typeof columnsInput[0] === 'object' && columnsInput[0]?.key) {
      resolved = columnsInput;
    }
  }

  // Ensure options like enableBatchTracking are passed when rendering
  return resolved.map(col => ({
    ...col,
    renderCell: (item) => col.render(item, { enableBatchTracking })
  }));
}
