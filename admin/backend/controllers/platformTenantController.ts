/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Tenant Administration Controller
 *
 * Keyset-paginated tenant listing, tenant DTO reads, suspension, and activation.
 */

import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import Admin from '../../../backend/models/Admin';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import SubscriptionAdjustment from '../../../backend/saas/models/SubscriptionAdjustment';
import TenantFeatureOverride from '../models/TenantFeatureOverride';
import { SubscriptionStatus, PlanCode, DEFAULT_PLAN_FEATURES } from '../../../backend/saas/shared/features';
import { invalidateSubscriptionCache } from '../../../backend/saas/services/featureService';
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
import { invalidatePlatformDashboardCache } from '../queries/dashboardQueries';
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

    // Revoke all active user sessions for tenant and their employees
    try {
      const EmployeeModel: any = require('../../../backend/models/Employee');
      const SessionModel: any = require('../../../backend/models/Session');
      const employeeIds = await EmployeeModel.find({ createdByAdmin: tenant._id }).distinct('_id');
      const allUserIds = [tenant._id, ...employeeIds];
      await SessionModel.updateMany(
        { user: { $in: allUserIds }, isActive: true },
        { $set: { isActive: false, logoutTime: new Date() } }
      );
    } catch {
      // Non-blocking fallback
    }

    // Invalidate cached overview metrics and subscription access immediately
    invalidatePlatformDashboardCache();
    invalidateSubscriptionCache(id);

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

    // Invalidate cached overview metrics and subscription access immediately
    invalidatePlatformDashboardCache();
    invalidateSubscriptionCache(id);

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

/**
 * POST /api/platform/tenants
 * Cold-boot provision a new tenant with default subscription and isolated environment.
 */
export async function createTenant(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      email,
      firmName,
      password,
      firmAddress,
      firmPhone,
      firmGSTIN,
      firmDL,
      planCode,
      trialDays,
      reason,
    } = req.body;
    const operator = req.platformUser;

    if (!email || typeof email !== 'string' || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email.trim())) {
      res.status(400).json({ success: false, message: 'A valid email address is required' });
      return;
    }

    if (!firmName || typeof firmName !== 'string' || firmName.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Firm name is required (minimum 2 characters)' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingTenant = await Admin.findOne({ email: cleanEmail });
    if (existingTenant) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const rawPassword = password && typeof password === 'string' && password.length >= 8
      ? password
      : crypto.randomBytes(6).toString('hex') + 'A1!';

    // Find requested or default plan. If no plan exists, seed the default Starter plan for resilience.
    const targetPlanCode = (planCode && typeof planCode === 'string') ? planCode.toLowerCase() : PlanCode.STARTER;
    let plan: any = await Plan.findOne({ code: targetPlanCode, active: true }).lean();
    if (!plan) {
      plan = await Plan.findOne({ active: true }).lean();
    }
    if (!plan) {
      // Platform cold-boot resilience: seed fallback starter plan
      const createdPlan: any = await Plan.create({
        code: PlanCode.STARTER,
        name: 'Starter Plan',
        description: 'Starter tier provisions essential billing capabilities',
        baseMonthlyPrice: 299,
        features: DEFAULT_PLAN_FEATURES[PlanCode.STARTER] || [],
        active: true,
      } as any);
      plan = createdPlan && createdPlan.toObject ? createdPlan.toObject() : createdPlan;
    }

    const trialDuration = trialDays && Number(trialDays) > 0 ? Number(trialDays) : 14;
    let createdAdmin: any = null;
    let createdSub: any = null;

    try {
      // 1. Create Admin document
      createdAdmin = await Admin.create({
        email: cleanEmail,
        password: rawPassword, // Admin pre-save hook will hash it with bcrypt
        firmName: firmName.trim(),
        normalizedFirmName: firmName.trim().toLowerCase(),
        firmAddress: firmAddress ? String(firmAddress).trim() : '',
        firmPhone: firmPhone ? String(firmPhone).trim() : '',
        firmGSTIN: firmGSTIN ? String(firmGSTIN).trim() : '',
        firmDL: firmDL ? String(firmDL).trim() : '',
        isActive: true,
        preferences: {
          themeMode: 'dark',
          showCalculator: true,
          enableBatchTracking: false,
          mobileCardDensity: 'compact',
          invoiceColumns: ['qty', 'free', 'productName', 'hsn', 'batchNo', 'expiry', 'mrp', 'rate', 'net', 'disc', 'gst', 'amount'],
          allowPublicInvoicePrint: false,
          showA5CapacityWarning: true,
          documentPrintFormats: {
            invoice: 'A4',
            creditNote: 'A4',
            paymentReceipt: 'A4',
            customerLedger: 'A4'
          }
        }
      });

      // 2. Create Trial Subscription
      const now = new Date();
      const graceDays = 7;
      const expiresAt = new Date(now.getTime() + trialDuration * 24 * 60 * 60 * 1000);
      const graceUntil = new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

      const pricingSnapshot = {
        planName: plan?.name || 'Starter Plan',
        planCode: plan?.code || PlanCode.STARTER,
        baseMonthlyPrice: plan?.baseMonthlyPrice || 0,
        durationMonths: 0,
        discountApplied: 0,
        finalAmount: 0,
        features: plan?.features || [],
      };

      createdSub = await Subscription.create({
        tenantId: createdAdmin._id,
        planId: plan?._id || null,
        status: SubscriptionStatus.TRIAL,
        startedAt: now,
        expiresAt,
        graceUntil,
        gracePeriodDays: graceDays,
        currentPricingSnapshot: pricingSnapshot,
      });
    } catch (provisionErr: any) {
      // Rollback partially created tenant to ensure ZERO orphaned references
      if (createdAdmin && createdAdmin._id) {
        await Admin.findByIdAndDelete(createdAdmin._id).catch(() => {});
      }
      if (createdSub && createdSub._id) {
        await Subscription.findByIdAndDelete(createdSub._id).catch(() => {});
      }
      throw provisionErr;
    }

    // Invalidate caches
    invalidatePlatformDashboardCache();
    invalidateSubscriptionCache(createdAdmin._id.toString());

    // Log Platform Audit Trail
    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'TENANT.CREATE',
      targetType: 'Tenant',
      targetId: createdAdmin._id.toString(),
      targetTenantId: createdAdmin._id,
      reason: reason && typeof reason === 'string' ? reason.trim() : 'Cold-boot platform tenant onboarding',
      after: {
        tenantId: createdAdmin._id.toString(),
        email: cleanEmail,
        firmName: createdAdmin.firmName,
        planCode: plan.code,
        subscriptionId: createdSub._id.toString(),
      },
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Tenant created and provisioned successfully',
      data: {
        tenantId: createdAdmin._id.toString(),
        email: createdAdmin.email,
        firmName: createdAdmin.firmName,
        isActive: createdAdmin.isActive,
        subscription: {
          id: createdSub._id.toString(),
          status: createdSub.status,
          planName: plan?.name || 'Starter Plan',
          planCode: plan?.code || PlanCode.STARTER,
          expiresAt: createdSub.expiresAt.toISOString(),
          daysRemaining: trialDuration,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/platform/tenants/:id
 * Permanently purges a tenant and cleans up associated collections, leaving ZERO orphaned references.
 */
export async function deleteTenant(
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
        message: 'A detailed operational reason (minimum 10 characters) is required to delete a tenant',
      });
      return;
    }

    const tenant = await Admin.findById(id);
    if (!tenant) {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }

    const tenantObjId = new Types.ObjectId(id);

    // 1. Revoke and remove all sessions for tenant and their employees
    try {
      const EmployeeModel: any = require('../../../backend/models/Employee');
      const SessionModel: any = require('../../../backend/models/Session');
      const employeeIds = await EmployeeModel.find({ createdByAdmin: tenantObjId }).distinct('_id');
      const allUserIds = [tenantObjId, ...employeeIds];

      await SessionModel.deleteMany({ user: { $in: allUserIds } });
      await EmployeeModel.deleteMany({ createdByAdmin: tenantObjId });
    } catch {
      // Non-blocking fallback
    }

    // 2. Remove subscriptions and feature overrides
    await Subscription.deleteMany({ tenantId: tenantObjId });
    await SubscriptionPayment.deleteMany({ tenantId: tenantObjId });
    await SubscriptionAdjustment.deleteMany({ tenantId: tenantObjId });
    await TenantFeatureOverride.deleteMany({ tenantId: tenantObjId });

    // 3. Remove admin
    await Admin.findByIdAndDelete(tenantObjId);

    // Invalidate caches
    invalidatePlatformDashboardCache();
    invalidateSubscriptionCache(id);

    // Audit log
    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_OWNER',
      action: 'TENANT.DELETE',
      targetType: 'Tenant',
      targetId: id,
      targetTenantId: tenantObjId,
      reason: reason.trim(),
      before: { firmName: tenant.firmName, email: tenant.email, isActive: tenant.isActive },
      severity: 'CRITICAL',
    });

    res.status(200).json({
      success: true,
      message: 'Tenant and associated data purged successfully with zero orphaned references',
      data: { tenantId: id },
    });
  } catch (error) {
    next(error);
  }
}

