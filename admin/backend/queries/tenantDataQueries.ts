/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Scoped Tenant Data Read Queries
 *
 * Strictly scoped data read operations with Stage 1 $match: { tenantId } isolation.
 */

import mongoose, { Types } from 'mongoose';
import Admin from '../../../backend/models/Admin';
import Subscription from '../../../backend/saas/models/Subscription';
import Batch from '../../../backend/models/Batch';
import Supplier from '../../../backend/models/Supplier';
import { encodeKeysetCursor, decodeAndVerifyKeysetCursor, computeFilterSignature } from '../utils/cursorCrypto';
import type {
  TenantOverviewDTO,
  TenantUsageDTO,
  IKeysetCursor,
} from '../types';

// Dynamic model loaders to ensure compatibility across CommonJS / ES modules
const Invoice: mongoose.Model<any> = require('../../../backend/models/Invoice');
const Customer: mongoose.Model<any> = require('../../../backend/models/Customer');
const Product: mongoose.Model<any> = require('../../../backend/models/Product');
const Employee: mongoose.Model<any> = require('../../../backend/models/Employee');
const Payment: mongoose.Model<any> = require('../../../backend/models/Payment');

export interface TenantInvoiceListItemDTO {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerId: string;
  totalAmount: number;
  taxableAmount: number;
  gstAmount: number;
  itemsCount: number;
  status: string;
}

export interface TenantCustomerListItemDTO {
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  creditLimit: number;
  totalPurchases: number;
  invoiceCount: number;
  createdAt: string;
}

export interface TenantProductListItemDTO {
  productId: string;
  productName: string;
  hsnCode: string;
  mrp: number;
  rate: number;
  gstPercentage: number;
  currentStockQty: number;
  hasBatches: boolean;
  createdAt: string;
}

export interface TenantInventoryListItemDTO {
  batchId: string;
  productId: string;
  productName: string;
  batchNo: string;
  expiryDate: string | null;
  rate: number;
  mrp: number;
  remainingQty: number;
  initialQty: number;
}

export interface TenantFinancialSummaryDTO {
  tenantId: string;
  totalSalesVolume: number;
  totalTaxable: number;
  totalGST: number;
  totalInvoicesCount: number;
  totalPaymentsCollected: number;
  averageInvoiceValue: number;
}

export interface ScopedQueryParams {
  cursor?: string;
  limit?: number;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' ? new Types.ObjectId(id) : id;
}

/**
 * 1. Get complete tenant overview with preferences, subscription snapshot, and computed access.
 */
export async function getTenantOverview(tenantIdInput: string | Types.ObjectId): Promise<TenantOverviewDTO> {
  const targetTenantId = toObjectId(tenantIdInput);

  const tenant = await Admin.findById(targetTenantId).select('-password').lean();
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const subscription = await Subscription.findOne({ tenantId: targetTenantId })
    .sort({ createdAt: -1 })
    .populate('planId')
    .lean();

  const now = Date.now();
  const subExpiresAt = (subscription?.expiresAt && !isNaN(new Date(subscription.expiresAt).getTime()))
    ? new Date(subscription.expiresAt).getTime()
    : 0;
  const daysRemaining = subExpiresAt > 0
    ? Math.max(0, Math.ceil((subExpiresAt - now) / (1000 * 60 * 60 * 24)))
    : 0;

  const subStatus = subscription?.status || 'none';
  const canWrite = ['active', 'trial', 'grace'].includes(subStatus);

  return {
    tenantId: tenant._id.toString(),
    firmName: tenant.firmName || '',
    firmAddress: tenant.firmAddress || '',
    firmPhone: tenant.firmPhone || '',
    firmGSTIN: tenant.firmGSTIN || '',
    firmDL: tenant.firmDL || '',
    email: tenant.email,
    isActive: tenant.isActive !== false,
    createdAt: (tenant.createdAt && !isNaN(new Date(tenant.createdAt).getTime())) ? new Date(tenant.createdAt).toISOString() : new Date().toISOString(),
    lastLogin: (tenant.lastLogin && !isNaN(new Date(tenant.lastLogin).getTime())) ? new Date(tenant.lastLogin).toISOString() : null,
    preferences: {
      themeMode: tenant.preferences?.themeMode || 'dark',
      enableBatchTracking: tenant.preferences?.enableBatchTracking === true,
      documentPrintFormats: tenant.preferences?.documentPrintFormats || {},
    },
    subscription: subscription
      ? {
          status: subscription.status || 'unknown',
          planName: subscription.currentPricingSnapshot?.planName || 'N/A',
          planCode: subscription.currentPricingSnapshot?.planCode || '',
          baseMonthlyPrice: subscription.currentPricingSnapshot?.baseMonthlyPrice || 0,
          finalAmount: subscription.currentPricingSnapshot?.finalAmount || 0,
          startedAt: (subscription.startedAt && !isNaN(new Date(subscription.startedAt).getTime())) ? new Date(subscription.startedAt).toISOString() : '',
          expiresAt: (subscription.expiresAt && !isNaN(new Date(subscription.expiresAt).getTime())) ? new Date(subscription.expiresAt).toISOString() : '',
          graceUntil: (subscription.graceUntil && !isNaN(new Date(subscription.graceUntil).getTime())) ? new Date(subscription.graceUntil).toISOString() : '',
          autoRenew: subscription.autoRenew === true,
          billingMode: subscription.billingMode || 'manual',
          daysRemaining,
        }
      : null,
    effectiveAccess: {
      canWrite,
      status: subStatus,
      features: (subscription?.currentPricingSnapshot?.features as string[]) || [],
      emergencyBypassActive: false,
      emergencyBypassExpiresAt: null,
    },
  };
}

/**
 * 2. Get aggregated tenant entity counts and sales volume.
 * Strictly anchored to { tenantId: targetTenantId } across all collections.
 */
export async function getTenantUsage(tenantIdInput: string | Types.ObjectId): Promise<TenantUsageDTO> {
  const targetTenantId = toObjectId(tenantIdInput);

  const [
    productsCount,
    customersCount,
    invoicesCount,
    employeesCount,
    suppliersCount,
    batchesCount,
    invoiceTotals,
  ] = await Promise.all([
    Product.countDocuments({ tenantId: targetTenantId }),
    Customer.countDocuments({ tenantId: targetTenantId }),
    Invoice.countDocuments({ tenantId: targetTenantId, status: { $ne: 'Cancelled' } }),
    Employee.countDocuments({ tenantId: targetTenantId }),
    Supplier.countDocuments({ tenantId: targetTenantId }),
    Batch.countDocuments({ tenantId: targetTenantId }),
    Invoice.aggregate([
      { $match: { tenantId: targetTenantId, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          totalSalesVolume: { $sum: '$totals.netTotal' },
          totalInvoicesCount: { $sum: 1 },
        },
      },
    ]).exec(),
  ]);

  const salesVolume = invoiceTotals[0]?.totalSalesVolume || 0;
  const countFromAgg = invoiceTotals[0]?.totalInvoicesCount || invoicesCount;

  return {
    tenantId: targetTenantId.toString(),
    counts: {
      products: productsCount,
      customers: customersCount,
      invoices: invoicesCount,
      employees: employeesCount,
      suppliers: suppliersCount,
      batches: batchesCount,
    },
    financials: {
      totalSalesVolume: Math.round((salesVolume + Number.EPSILON) * 100) / 100,
      totalInvoicesCount: countFromAgg,
    },
  };
}

/**
 * 3. Keyset paginated query for tenant invoices anchored at Stage 1 $match.
 */
export async function getTenantInvoices(
  tenantIdInput: string | Types.ObjectId,
  params: ScopedQueryParams = {}
): Promise<{ data: TenantInvoiceListItemDTO[]; pagination: { hasNextPage: boolean; nextCursor: string | null; limit: number } }> {
  const targetTenantId = toObjectId(tenantIdInput);
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';
  const sortDir = sortDirection === 'asc' ? 1 : -1;

  const filterSig = computeFilterSignature({
    resource: 'invoices',
    search: params.search || '',
    status: params.status || '',
    startDate: params.startDate || '',
    endDate: params.endDate || '',
  });

  let decodedCursor: IKeysetCursor | null = null;
  if (params.cursor) {
    decodedCursor = decodeAndVerifyKeysetCursor(params.cursor, {
      expectedSortField: 'invoiceDate',
      expectedSortDirection: sortDirection,
      expectedTenantScope: targetTenantId.toString(),
      currentFilterSig: filterSig,
    });
  }

  // Stage 1 $match strictly anchored to targetTenantId
  const match: Record<string, any> = { tenantId: targetTenantId };

  if (params.status && params.status.trim()) {
    match.status = params.status.trim();
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = [
      { invoiceNumber: { $regex: term, $options: 'i' } },
      { 'customer.customerName': { $regex: term, $options: 'i' } },
    ];
  }

  if (params.startDate || params.endDate) {
    match.invoiceDate = {};
    if (params.startDate) match.invoiceDate.$gte = new Date(params.startDate);
    if (params.endDate) match.invoiceDate.$lte = new Date(params.endDate);
  }

  if (decodedCursor) {
    const cursorDate = new Date(Number(decodedCursor.val));
    const cursorId = new Types.ObjectId(decodedCursor.id);
    const cursorCondition = sortDirection === 'desc'
      ? [
          { invoiceDate: { $lt: cursorDate } },
          { invoiceDate: cursorDate, _id: { $lt: cursorId } },
        ]
      : [
          { invoiceDate: { $gt: cursorDate } },
          { invoiceDate: cursorDate, _id: { $gt: cursorId } },
        ];

    if (match.$or) {
      match.$and = [{ $or: match.$or }, { $or: cursorCondition }];
      delete match.$or;
    } else {
      match.$or = cursorCondition;
    }
  }

  const items = await Invoice.find(match)
    .sort({ invoiceDate: sortDir, _id: sortDir })
    .limit(limit + 1)
    .lean();

  const hasNextPage = items.length > limit;
  const pageItems = hasNextPage ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  const lastItem = pageItems[pageItems.length - 1];
  if (hasNextPage && lastItem) {
    nextCursor = encodeKeysetCursor({
      sortField: 'invoiceDate',
      sortDirection,
      val: new Date(lastItem.invoiceDate).getTime(),
      id: lastItem._id.toString(),
      tenantScope: targetTenantId.toString(),
      filterSig,
    });
  }

  const data: TenantInvoiceListItemDTO[] = pageItems.map((inv: any) => ({
    invoiceId: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString() : new Date().toISOString(),
    customerName: inv.customer?.customerName || 'Walk-in Customer',
    customerId: inv.customer?._id ? inv.customer._id.toString() : '',
    totalAmount: inv.totals?.netTotal || 0,
    taxableAmount: inv.totals?.totalTaxable || 0,
    gstAmount: inv.totals?.totalGST || 0,
    itemsCount: Array.isArray(inv.items) ? inv.items.length : 0,
    status: inv.status || 'PAID',
  }));

  return { data, pagination: { hasNextPage, nextCursor, limit } };
}

/**
 * 4. Keyset paginated query for tenant customers anchored at Stage 1 $match.
 */
export async function getTenantCustomers(
  tenantIdInput: string | Types.ObjectId,
  params: ScopedQueryParams = {}
): Promise<{ data: TenantCustomerListItemDTO[]; pagination: { hasNextPage: boolean; nextCursor: string | null; limit: number } }> {
  const targetTenantId = toObjectId(tenantIdInput);
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';
  const sortDir = sortDirection === 'asc' ? 1 : -1;

  const filterSig = computeFilterSignature({
    resource: 'customers',
    search: params.search || '',
  });

  let decodedCursor: IKeysetCursor | null = null;
  if (params.cursor) {
    decodedCursor = decodeAndVerifyKeysetCursor(params.cursor, {
      expectedSortField: 'createdAt',
      expectedSortDirection: sortDirection,
      expectedTenantScope: targetTenantId.toString(),
      currentFilterSig: filterSig,
    });
  }

  const match: Record<string, any> = { tenantId: targetTenantId };

  if (params.search && params.search.trim()) {
    const term = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = [
      { customerName: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
      { gstin: { $regex: term, $options: 'i' } },
    ];
  }

  if (decodedCursor) {
    const cursorDate = new Date(Number(decodedCursor.val));
    const cursorId = new Types.ObjectId(decodedCursor.id);
    const cursorCondition = sortDirection === 'desc'
      ? [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ]
      : [
          { createdAt: { $gt: cursorDate } },
          { createdAt: cursorDate, _id: { $gt: cursorId } },
        ];

    if (match.$or) {
      match.$and = [{ $or: match.$or }, { $or: cursorCondition }];
      delete match.$or;
    } else {
      match.$or = cursorCondition;
    }
  }

  const items = await Customer.find(match)
    .sort({ createdAt: sortDir, _id: sortDir })
    .limit(limit + 1)
    .lean();

  const hasNextPage = items.length > limit;
  const pageItems = hasNextPage ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  const lastItem = pageItems[pageItems.length - 1];
  if (hasNextPage && lastItem) {
    nextCursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection,
      val: new Date(lastItem.createdAt).getTime(),
      id: lastItem._id.toString(),
      tenantScope: targetTenantId.toString(),
      filterSig,
    });
  }

  const data: TenantCustomerListItemDTO[] = pageItems.map((c: any) => ({
    customerId: c._id.toString(),
    customerName: c.customerName,
    phone: c.phone || '',
    email: c.email || '',
    gstin: c.gstin || '',
    address: c.address || '',
    creditLimit: c.creditLimit || 0,
    totalPurchases: c.totalPurchases || 0,
    invoiceCount: c.invoiceCount || 0,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  }));

  return { data, pagination: { hasNextPage, nextCursor, limit } };
}

/**
 * 5. Keyset paginated query for tenant products anchored at Stage 1 $match.
 */
export async function getTenantProducts(
  tenantIdInput: string | Types.ObjectId,
  params: ScopedQueryParams = {}
): Promise<{ data: TenantProductListItemDTO[]; pagination: { hasNextPage: boolean; nextCursor: string | null; limit: number } }> {
  const targetTenantId = toObjectId(tenantIdInput);
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';
  const sortDir = sortDirection === 'asc' ? 1 : -1;

  const filterSig = computeFilterSignature({
    resource: 'products',
    search: params.search || '',
  });

  let decodedCursor: IKeysetCursor | null = null;
  if (params.cursor) {
    decodedCursor = decodeAndVerifyKeysetCursor(params.cursor, {
      expectedSortField: 'createdAt',
      expectedSortDirection: sortDirection,
      expectedTenantScope: targetTenantId.toString(),
      currentFilterSig: filterSig,
    });
  }

  const match: Record<string, any> = { tenantId: targetTenantId };

  if (params.search && params.search.trim()) {
    const term = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = [
      { productName: { $regex: term, $options: 'i' } },
      { hsnCode: { $regex: term, $options: 'i' } },
    ];
  }

  if (decodedCursor) {
    const cursorDate = new Date(Number(decodedCursor.val));
    const cursorId = new Types.ObjectId(decodedCursor.id);
    const cursorCondition = sortDirection === 'desc'
      ? [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ]
      : [
          { createdAt: { $gt: cursorDate } },
          { createdAt: cursorDate, _id: { $gt: cursorId } },
        ];

    if (match.$or) {
      match.$and = [{ $or: match.$or }, { $or: cursorCondition }];
      delete match.$or;
    } else {
      match.$or = cursorCondition;
    }
  }

  const items = await Product.find(match)
    .sort({ createdAt: sortDir, _id: sortDir })
    .limit(limit + 1)
    .lean();

  const hasNextPage = items.length > limit;
  const pageItems = hasNextPage ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  const lastItem = pageItems[pageItems.length - 1];
  if (hasNextPage && lastItem) {
    nextCursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection,
      val: new Date(lastItem.createdAt).getTime(),
      id: lastItem._id.toString(),
      tenantScope: targetTenantId.toString(),
      filterSig,
    });
  }

  const data: TenantProductListItemDTO[] = pageItems.map((p: any) => ({
    productId: p._id.toString(),
    productName: p.productName,
    hsnCode: p.hsnCode || '',
    mrp: p.mrp || 0,
    rate: p.rate || 0,
    gstPercentage: p.gstPercentage || 0,
    currentStockQty: p.currentStockQty || 0,
    hasBatches: p.hasBatches === true,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
  }));

  return { data, pagination: { hasNextPage, nextCursor, limit } };
}

/**
 * 6. Query tenant active inventory batches anchored at Stage 1 $match.
 */
export async function getTenantInventory(
  tenantIdInput: string | Types.ObjectId,
  params: ScopedQueryParams = {}
): Promise<{ data: TenantInventoryListItemDTO[]; pagination: { hasNextPage: boolean; nextCursor: string | null; limit: number } }> {
  const targetTenantId = toObjectId(tenantIdInput);
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';
  const sortDir = sortDirection === 'asc' ? 1 : -1;

  const filterSig = computeFilterSignature({
    resource: 'customers',
    search: params.search || '',
  });

  let decodedCursor: IKeysetCursor | null = null;
  if (params.cursor) {
    decodedCursor = decodeAndVerifyKeysetCursor(params.cursor, {
      expectedSortField: 'createdAt',
      expectedSortDirection: sortDirection,
      expectedTenantScope: targetTenantId.toString(),
      currentFilterSig: filterSig,
    });
  }

  const match: Record<string, any> = {
    tenantId: targetTenantId,
    remainingQty: { $gt: 0 },
    isActive: true,
  };

  if (params.search && params.search.trim()) {
    const term = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.batchNo = { $regex: term, $options: 'i' };
  }

  if (decodedCursor) {
    const cursorDate = new Date(Number(decodedCursor.val));
    const cursorId = new Types.ObjectId(decodedCursor.id);
    const cursorCondition = sortDirection === 'desc'
      ? [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ]
      : [
          { createdAt: { $gt: cursorDate } },
          { createdAt: cursorDate, _id: { $gt: cursorId } },
        ];

    match.$or = cursorCondition;
  }

  const items = await Batch.find(match)
    .populate('productId', 'productName')
    .sort({ createdAt: sortDir, _id: sortDir })
    .limit(limit + 1)
    .lean();

  const hasNextPage = items.length > limit;
  const pageItems = hasNextPage ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  const lastItem = pageItems[pageItems.length - 1];
  if (hasNextPage && lastItem) {
    nextCursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection,
      val: new Date((lastItem as any).createdAt || Date.now()).getTime(),
      id: (lastItem as any)._id.toString(),
      tenantScope: targetTenantId.toString(),
      filterSig,
    });
  }

  const data: TenantInventoryListItemDTO[] = pageItems.map((b: any) => ({
    batchId: b._id.toString(),
    productId: b.productId?._id ? b.productId._id.toString() : (b.productId?.toString() || ''),
    productName: b.productId?.productName || 'Unknown Product',
    batchNo: b.batchNo || 'UNNAMED',
    expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : null,
    rate: b.rate || 0,
    mrp: b.mrp || 0,
    remainingQty: b.remainingQty || 0,
    initialQty: b.initialQty || 0,
  }));

  return { data, pagination: { hasNextPage, nextCursor, limit } };
}

/**
 * 7. Tenant financial summary aggregated strictly within target tenant boundary.
 */
export async function getTenantFinancialSummary(
  tenantIdInput: string | Types.ObjectId,
  params: { startDate?: string; endDate?: string } = {}
): Promise<TenantFinancialSummaryDTO> {
  const targetTenantId = toObjectId(tenantIdInput);

  const invoiceMatch: Record<string, any> = { tenantId: targetTenantId, status: { $ne: 'Cancelled' } };
  const paymentMatch: Record<string, any> = { tenantId: targetTenantId };

  if (params.startDate || params.endDate) {
    invoiceMatch.invoiceDate = {};
    paymentMatch.paymentDate = {};
    if (params.startDate) {
      invoiceMatch.invoiceDate.$gte = new Date(params.startDate);
      paymentMatch.paymentDate.$gte = new Date(params.startDate);
    }
    if (params.endDate) {
      invoiceMatch.invoiceDate.$lte = new Date(params.endDate);
      paymentMatch.paymentDate.$lte = new Date(params.endDate);
    }
  }

  const [invoiceAgg, paymentAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: invoiceMatch },
      {
        $group: {
          _id: null,
          totalSalesVolume: { $sum: '$totals.netTotal' },
          totalTaxable: { $sum: '$totals.totalTaxable' },
          totalGST: { $sum: '$totals.totalGST' },
          totalInvoicesCount: { $sum: 1 },
        },
      },
    ]).exec(),
    Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          totalPaymentsCollected: { $sum: '$amount' },
        },
      },
    ]).exec(),
  ]);

  const salesVolume = invoiceAgg[0]?.totalSalesVolume || 0;
  const taxable = invoiceAgg[0]?.totalTaxable || 0;
  const gst = invoiceAgg[0]?.totalGST || 0;
  const count = invoiceAgg[0]?.totalInvoicesCount || 0;
  const collected = paymentAgg[0]?.totalPaymentsCollected || 0;
  const averageValue = count > 0 ? salesVolume / count : 0;

  return {
    tenantId: targetTenantId.toString(),
    totalSalesVolume: Math.round((salesVolume + Number.EPSILON) * 100) / 100,
    totalTaxable: Math.round((taxable + Number.EPSILON) * 100) / 100,
    totalGST: Math.round((gst + Number.EPSILON) * 100) / 100,
    totalInvoicesCount: count,
    totalPaymentsCollected: Math.round((collected + Number.EPSILON) * 100) / 100,
    averageInvoiceValue: Math.round((averageValue + Number.EPSILON) * 100) / 100,
  };
}
