const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const getTenantId = require('../utils/getTenantId');

// ============================================================================
// IN-MEMORY CACHE — Date-range-aware invalidation
// ============================================================================

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map();

/**
 * Build a deterministic cache key from query parameters.
 */
const buildCacheKey = (tenantId, startDate, endDate, excludedProductIds) => {
  const sorted = [...excludedProductIds].sort().join(',');
  return `${tenantId}|${startDate}|${endDate}|${sorted}`;
};

/**
 * Invalidate GST report cache entries whose date range overlaps with
 * the given invoice date. If no date is provided, clears ALL entries.
 *
 * @param {Date|string|null} invoiceDate — the date of the mutated invoice
 */
const invalidateGstReportCache = (invoiceDate, tenantId = null) => {
  if (!invoiceDate) {
    // Fallback: brute-force clear when date is unavailable
    cache.clear();
    return;
  }

  const invTs = new Date(invoiceDate).getTime();
  if (Number.isNaN(invTs)) {
    cache.clear();
    return;
  }

  // Walk cache entries and delete only those whose range overlaps
  for (const [key, entry] of cache) {
    // key format: "tenantId|YYYY-MM-DD|YYYY-MM-DD|excludedIds"
    const [keyTenantId, startRaw, endRaw] = key.split('|');

    if (tenantId && keyTenantId !== String(tenantId)) {
      continue;
    }

    const start = parseISTDateBoundary(startRaw, false);
    const end = parseISTDateBoundary(endRaw, true);

    if (!start || !end) {
      // Malformed key — remove to be safe
      cache.delete(key);
      continue;
    }

    if (invTs >= start.getTime() && invTs <= end.getTime()) {
      cache.delete(key);
    }
  }
};

// ============================================================================
// DATE PARSING (IST-aware, same pattern as invoiceController)
// ============================================================================

const parseISTDateBoundary = (dateInput, endOfDay = false) => {
  const raw = String(dateInput || '').trim();
  if (!raw) return null;

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const timePart = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const parsed = new Date(`${year}-${month}-${day}T${timePart}+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// ============================================================================
// STANDARD GST SLABS (always guaranteed in output, even if zero)
// ============================================================================

const STANDARD_SLABS = [0, 5, 12, 18, 28];

// ============================================================================
// CONTROLLER: GET /api/reports/gst
// ============================================================================

// @desc    Get GST sales summary report
// @route   GET /api/reports/gst
// @access  Private
exports.getGstReport = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { startDate: startRaw, endDate: endRaw, excludedProductIds: excludedRaw } = req.query;

    // --- Validate dates ---
    if (!startRaw || !endRaw) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required query parameters'
      });
    }

    const startDate = parseISTDateBoundary(startRaw, false);
    const endDate = parseISTDateBoundary(endRaw, true);

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be before endDate'
      });
    }

    // --- Parse excluded product IDs ---
    let excludedProductIds = [];
    if (excludedRaw) {
      excludedProductIds = excludedRaw
        .split(',')
        .map(id => id.trim())
        .filter(id => mongoose.Types.ObjectId.isValid(id));
    }

    const excludedObjectIds = excludedProductIds.map(id => new mongoose.Types.ObjectId(id));

    // --- Check cache ---
    const cacheKey = buildCacheKey(tenantId, startRaw, endRaw, excludedProductIds);
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return res.status(200).json(cached.data);
    }

    // --- Build aggregation pipeline ---
    // Global $match + $project run ONCE, then $facet branches
    // over the already-filtered, lightweight doc set.
    const globalMatch = {
      $match: { tenantId, invoiceDate: { $gte: startDate, $lte: endDate } }
    };

    const globalProject = {
      $project: {
        items: 1,
        invoiceDate: 1,
        status: 1,
        invoiceNumber: 1
      }
    };

    const facetPipeline = {
      // Facet 1: Invoice stats (total + cancelled count) — all statuses
      stats: [
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            cancelledInvoices: {
              $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
            }
          }
        }
      ],

      // Facet 2: Invoice number range — all statuses
      range: [
        {
          $group: {
            _id: null,
            minInvoice: { $min: '$invoiceNumber' },
            maxInvoice: { $max: '$invoiceNumber' }
          }
        }
      ],

      // Facet 3: GST slab sales (excluding cancelled & excluded products)
      slabSales: [
        { $match: { status: { $ne: 'Cancelled' } } },
        { $unwind: '$items' },
        ...(excludedObjectIds.length > 0
          ? [{ $match: { 'items.product._id': { $nin: excludedObjectIds } } }]
          : []),
        {
          $group: {
            _id: '$items.product.gstPercentage',
            sales: { $sum: { $add: ['$items.taxableAmount', '$items.gstAmount'] } }
          }
        }
      ],

      // Facet 4: Excluded sales total (only when exclusions provided)
      ...(excludedObjectIds.length > 0
        ? {
            excludedSales: [
              { $match: { status: { $ne: 'Cancelled' } } },
              { $unwind: '$items' },
              { $match: { 'items.product._id': { $in: excludedObjectIds } } },
              {
                $group: {
                  _id: null,
                  total: { $sum: { $add: ['$items.taxableAmount', '$items.gstAmount'] } }
                }
              }
            ]
          }
        : {})
    };

    const [result] = await Invoice.aggregate([globalMatch, globalProject, { $facet: facetPipeline }]);

    // --- Process results ---

    // Stats
    const statsDoc = result.stats[0] || { totalInvoices: 0, cancelledInvoices: 0 };
    const stats = {
      totalInvoices: statsDoc.totalInvoices,
      cancelledInvoices: statsDoc.cancelledInvoices,
      activeInvoices: statsDoc.totalInvoices - statsDoc.cancelledInvoices
    };

    // Range
    const rangeDoc = result.range[0] || { minInvoice: null, maxInvoice: null };
    const range = {
      minInvoice: rangeDoc.minInvoice,
      maxInvoice: rangeDoc.maxInvoice
    };

    // Dynamic + fallback slab normalization:
    // Always include standard slabs, but also allow any unknown slabs
    // returned by the aggregation (future-proof).
    const slabs = {};
    for (const slab of STANDARD_SLABS) {
      slabs[slab] = { sales: 0 };
    }
    for (const doc of result.slabSales) {
      const pct = doc._id;
      if (pct !== null && pct !== undefined) {
        slabs[pct] = { sales: Math.round(doc.sales * 100) / 100 };
      }
    }

    // Total sales across all slabs
    const totalSales = Object.values(slabs).reduce((sum, s) => sum + s.sales, 0);

    // Excluded sales
    const excludedSales = excludedObjectIds.length > 0
      ? Math.round(((result.excludedSales?.[0]?.total) || 0) * 100) / 100
      : 0;

    // --- Build response ---
    const responseData = {
      success: true,
      stats,
      range,
      slabs,
      totalSales: Math.round(totalSales * 100) / 100,
      excludedSales
    };

    // Store in cache
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

// Export cache invalidation for use in invoiceController
exports.invalidateGstReportCache = invalidateGstReportCache;
