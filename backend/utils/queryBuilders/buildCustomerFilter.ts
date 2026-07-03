/**
 * Customer Query Builder
 *
 * Reusable, pure function that converts query parameters into a
 * MongoDB filter + sort object for the Customer collection.
 *
 * Architecture: This follows the official query-builder pattern.
 * Future modules (Products, Invoices, Payments) should create
 * their own builder in this same folder following this structure.
 *
 * Adding a new filter:
 *   1. Accept the query param
 *   2. Add 3-5 lines to this function
 *   3. Done — no controller changes required
 *
 * @module utils/queryBuilders/buildCustomerFilter
 */

const { getSearchPattern, buildFuzzyPattern } = require('../searchUtils');

// ── Types ───────────────────────────────────────────────────────

interface CustomerQuery {
  search?: string;
  prefix?: string;
  fuzzy?: string;
  status?: 'active' | 'inactive' | 'all';
  includeInactive?: string;
  hasGstin?: 'yes' | 'no';
  hasDlNo?: 'yes' | 'no';
  hasPhone?: 'yes';
  hasEmail?: 'yes';
  hasAddress?: 'yes';
  dateRange?: 'today' | '7d' | '30d' | 'custom' | 'all';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

interface CustomerFilterResult {
  filter: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
}

// ── Sort Field Enum ─────────────────────────────────────────────
// Whitelist of allowed sort fields. Add new ones here as needed.
// e.g. SORT_FIELDS.invoiceCount = 'invoiceCount'

const SORT_FIELDS: Record<string, string> = {
  customerName: 'customerName',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

// ── Filter Builder ──────────────────────────────────────────────

/**
 * Build a MongoDB filter + sort from incoming query parameters.
 *
 * @param tenantId - Tenant ID (always required, always first)
 * @param query    - Express req.query
 * @returns { filter, sort } ready for Customer.find(filter).sort(sort)
 */
function buildCustomerFilter(tenantId: unknown, query: CustomerQuery = {}): CustomerFilterResult {
  const filter: Record<string, unknown> = { tenantId };
  const sort: Record<string, 1 | -1> = {};

  // ── Status ──────────────────────────────────────────────────
  // Default: only active customers
  // status=all or includeInactive=true → no isActive filter
  // status=inactive → only inactive
  if (query.status === 'inactive') {
    filter.isActive = false;
  } else if (query.status === 'all' || query.includeInactive === 'true') {
    // No isActive filter — return both active and inactive
  } else {
    filter.isActive = true;
  }

  // ── Search ──────────────────────────────────────────────────
  // Reuses the existing search pattern infrastructure from searchUtils.
  if (query.search) {
    const rawSearch = String(query.search).trim();
    const usePrefix = query.prefix === 'true';
    const useFuzzy = query.fuzzy === 'true';
    const pattern = getSearchPattern(rawSearch, usePrefix);

    const conditions: Record<string, unknown>[] = [
      { customerName: { $regex: pattern, $options: 'i' } },
      { phone: { $regex: pattern, $options: 'i' } },
      { gstin: { $regex: pattern, $options: 'i' } },
    ];

    if (useFuzzy && rawSearch.length >= 2) {
      const fuzzyPattern = buildFuzzyPattern(rawSearch);
      if (fuzzyPattern && fuzzyPattern !== pattern) {
        conditions.push(
          { customerName: { $regex: fuzzyPattern, $options: 'i' } },
          { phone: { $regex: fuzzyPattern, $options: 'i' } },
          { gstin: { $regex: fuzzyPattern, $options: 'i' } }
        );
      }
    }

    filter.$or = conditions;
  }

  // ── Business Information Filters ────────────────────────────
  // Each "has" filter checks for non-empty, non-null values.

  // GSTIN
  if (query.hasGstin === 'yes') {
    filter.gstin = { $nin: ['', null], $exists: true };
  } else if (query.hasGstin === 'no') {
    filter.$and = ((filter.$and as Record<string, unknown>[]) || []).concat([
      { $or: [{ gstin: '' }, { gstin: null }, { gstin: { $exists: false } }] }
    ]);
  }

  // Drug License
  if (query.hasDlNo === 'yes') {
    filter.dlNo = { $nin: ['', null], $exists: true };
  } else if (query.hasDlNo === 'no') {
    filter.$and = ((filter.$and as Record<string, unknown>[]) || []).concat([
      { $or: [{ dlNo: '' }, { dlNo: null }, { dlNo: { $exists: false } }] }
    ]);
  }

  // Phone (non-empty)
  if (query.hasPhone === 'yes') {
    filter.phone = { $nin: ['', null], $exists: true };
  }

  // Email (non-empty)
  if (query.hasEmail === 'yes') {
    filter.email = { $nin: ['', null], $exists: true };
  }

  // Address (non-empty)
  if (query.hasAddress === 'yes') {
    filter.address = { $nin: ['', null], $exists: true };
  }

  // ── Date Range Filter (createdAt) ───────────────────────────
  if (query.dateRange && query.dateRange !== 'all') {
    const now = new Date();
    let dateFrom: Date | null = null;
    const dateTo = new Date(now);
    dateTo.setHours(23, 59, 59, 999);

    switch (query.dateRange) {
      case 'today': {
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        break;
      }
      case '7d': {
        dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 7);
        dateFrom.setHours(0, 0, 0, 0);
        break;
      }
      case '30d': {
        dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 30);
        dateFrom.setHours(0, 0, 0, 0);
        break;
      }
      case 'custom': {
        if (query.dateFrom) {
          dateFrom = new Date(query.dateFrom);
          dateFrom.setHours(0, 0, 0, 0);
        }
        if (query.dateTo) {
          const customTo = new Date(query.dateTo);
          customTo.setHours(23, 59, 59, 999);
          dateTo.setTime(customTo.getTime());
        }
        break;
      }
    }

    if (dateFrom) {
      filter.createdAt = { $gte: dateFrom, $lte: dateTo };
    }
  }

  // ── Sorting ─────────────────────────────────────────────────
  const sortField = SORT_FIELDS[query.sortBy ?? ''] || SORT_FIELDS.createdAt;
  sort[sortField] = query.sortOrder === 'asc' ? 1 : -1;

  return { filter, sort };
}

// ── CommonJS interop ────────────────────────────────────────────
module.exports = { buildCustomerFilter, SORT_FIELDS };
