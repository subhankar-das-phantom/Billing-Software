/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Tenant Administration Controller
 *
 * Keyset-paginated tenant listing, tenant DTO reads, suspension, and activation.
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Admin from '../../../backend/models/Admin';
import { PlatformRequest } from '../types';
import { listTenantsQuery } from '../queries/tenantQueries';
import {
  getTenantOverview,
  getTenantUsage,
  getTenantInvoices,
  getTenantCustomers,
  getTenantProducts,
  getTenantInventory,
  getTenantFinancialSummary,
} from '../queries/tenantDataQueries';
import { logPlatformAudit } from '../services/platformAuditService';

/**
 * GET /api/platform/tenants
 * Keyset-paginated list of all platform tenants.
 */
export async function listTenants(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { cursor, limit, sortField, sortDirection, search, status, isActive } = req.query;

    const parsedLimit = limit ? parseInt(String(limit), 10) : 25;
    const parsedSortField = sortField === 'normalizedFirmName' ? 'normalizedFirmName' : 'createdAt';
    const parsedSortDirection = sortDirection === 'asc' ? 'asc' : 'desc';

    // Status parameter can be 'all' | 'active' | 'inactive' | 'suspended' OR specific subscription statuses
    let parsedIsActive = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    if (parsedIsActive === undefined && typeof status === 'string') {
      const lowerStatus = status.trim().toLowerCase();
      if (lowerStatus === 'active') parsedIsActive = true;
      else if (lowerStatus === 'inactive' || lowerStatus === 'suspended') parsedIsActive = false;
    }

    const subStatus =
      typeof status === 'string' &&
      !['all', 'active', 'inactive', 'suspended'].includes(status.trim().toLowerCase())
        ? status.trim()
        : undefined;

    const result = await listTenantsQuery({
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: isNaN(parsedLimit) ? 25 : parsedLimit,
      sortField: parsedSortField,
      sortDirection: parsedSortDirection,
      search: typeof search === 'string' ? search : undefined,
      status: subStatus,
      isActive: parsedIsActive,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/platform/tenants/:id
 * Retrieve tenant profile overview and subscription snapshot.
 */
export async function getTenantById(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    const overview = await getTenantOverview(id);
    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    if (error.message === 'Tenant not found') {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }
    next(error);
  }
}

/**
 * GET /api/platform/tenants/:id/usage
 * Retrieve live feature and entity counts against quota limits.
 */
export async function getTenantUsageStats(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    const usage = await getTenantUsage(id);
    res.status(200).json({
      success: true,
      data: usage,
    });
  } catch (error: any) {
    if (error.message === 'Tenant not found') {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }
    next(error);
  }
}

/**
 * GET /api/platform/tenants/:id/invoices
 * Keyset-paginated scoped read of tenant invoices.
 */
export async function getTenantInvoicesList(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    const { cursor, limit, sortDirection, search, status, startDate, endDate } = req.query;
    const parsedLimit = limit ? parseInt(String(limit), 10) : 25;

    const invoices = await getTenantInvoices(id, {
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: isNaN(parsedLimit) ? 25 : parsedLimit,
      sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    res.status(200).json({
      success: true,
      data: invoices.data,
      pagination: invoices.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/platform/tenants/:id/customers
 * Keyset-paginated scoped read of tenant customers.
 */
export async function getTenantCustomersList(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    const { cursor, limit, sortDirection, search } = req.query;
    const parsedLimit = limit ? parseInt(String(limit), 10) : 25;

    const customers = await getTenantCustomers(id, {
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: isNaN(parsedLimit) ? 25 : parsedLimit,
      sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      search: typeof search === 'string' ? search : undefined,
    });

    res.status(200).json({
      success: true,
      data: customers.data,
      pagination: customers.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/platform/tenants/:id/products
 * Keyset-paginated scoped read of tenant products.
 */
export async function getTenantProductsList(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    const { cursor, limit, sortDirection, search } = req.query;
    const parsedLimit = limit ? parseInt(String(limit), 10) : 25;

    const products = await getTenantProducts(id, {
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: isNaN(parsedLimit) ? 25 : parsedLimit,
      sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      search: typeof search === 'string' ? search : undefined,
    });

    res.status(200).json({
      success: true,
      data: products.data,
      pagination: products.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/platform/tenants/:id/inventory
 * Keyset-paginated scoped read of tenant inventory batches.
 */
export async function getTenantInventoryList(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    const { cursor, limit, sortDirection, search } = req.query;
    const parsedLimit = limit ? parseInt(String(limit), 10) : 25;

    const inventory = await getTenantInventory(id, {
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: isNaN(parsedLimit) ? 25 : parsedLimit,
      sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      search: typeof search === 'string' ? search : undefined,
    });

    res.status(200).json({
      success: true,
      data: inventory.data,
      pagination: inventory.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/platform/tenants/:id/financials
 * Aggregated financial totals strictly scoped to target tenant.
 */
export async function getTenantFinancials(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    const { startDate, endDate } = req.query;

    const summary = await getTenantFinancialSummary(id, {
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/tenants/:id/suspend
 * Suspends tenant access across the entire platform.
 */
export async function suspendTenant(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    const { reason } = req.body;
    const operator = req.platformUser;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A detailed operational reason (minimum 10 characters) is required to suspend a tenant',
      });
      return;
    }

    const tenant = await Admin.findById(id);
    if (!tenant) {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }

    if (tenant.isActive === false) {
      res.status(400).json({ success: false, message: 'Tenant is already suspended' });
      return;
    }

    tenant.isActive = false;
    await tenant.save();

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'TENANT.SUSPEND',
      targetType: 'Tenant',
      targetId: id,
      targetTenantId: id,
      reason: reason.trim(),
      before: { isActive: true },
      after: { isActive: false },
      severity: 'CRITICAL',
    });

    res.status(200).json({
      success: true,
      message: 'Tenant has been suspended successfully',
      data: { tenantId: id, isActive: false },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/tenants/:id/unsuspend
 * Restores suspended tenant access.
 */
export async function unsuspendTenant(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    const { reason } = req.body;
    const operator = req.platformUser;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid tenant ID' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A detailed operational reason (minimum 10 characters) is required to reactivate a tenant',
      });
      return;
    }

    const tenant = await Admin.findById(id);
    if (!tenant) {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }

    if (tenant.isActive === true) {
      res.status(400).json({ success: false, message: 'Tenant is already active' });
      return;
    }

    tenant.isActive = true;
    await tenant.save();

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'TENANT.ACTIVATE',
      targetType: 'Tenant',
      targetId: id,
      targetTenantId: id,
      reason: reason.trim(),
      before: { isActive: false },
      after: { isActive: true },
      severity: 'WARNING',
    });

    res.status(200).json({
      success: true,
      message: 'Tenant has been reactivated successfully',
      data: { tenantId: id, isActive: true },
    });
  } catch (error) {
    next(error);
  }
}

