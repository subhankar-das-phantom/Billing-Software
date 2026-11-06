/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Tenant Management Routes
 */

import { Router } from 'express';
import { authenticatePlatform } from '../middleware/platformAuthMiddleware';
import { requirePlatformPermission, requireReason } from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../types';
import {
  listTenants,
  getTenantById,
  getTenantUsageStats,
  getTenantInvoicesList,
  getTenantCustomersList,
  getTenantProductsList,
  getTenantInventoryList,
  getTenantFinancials,
  suspendTenant,
  unsuspendTenant,
  createTenant,
  deleteTenant,
} from '../controllers/platformTenantController';

const router = Router();

// Apply platform authentication to all tenant administration routes
router.use(authenticatePlatform);

// Read endpoints
router.get('/', requirePlatformPermission(PlatformPermission.TENANTS_VIEW), listTenants);
router.get('/:id', requirePlatformPermission(PlatformPermission.TENANTS_VIEW), getTenantById);
router.get('/:id/overview', requirePlatformPermission(PlatformPermission.TENANTS_VIEW), getTenantById);
router.get('/:id/usage', requirePlatformPermission(PlatformPermission.TENANTS_VIEW), getTenantUsageStats);

// Deep inspection / tenant data endpoints
router.get('/:id/invoices', requirePlatformPermission(PlatformPermission.TENANT_DATA_VIEW), getTenantInvoicesList);
router.get('/:id/customers', requirePlatformPermission(PlatformPermission.TENANT_DATA_VIEW), getTenantCustomersList);
router.get('/:id/products', requirePlatformPermission(PlatformPermission.TENANT_DATA_VIEW), getTenantProductsList);
router.get('/:id/inventory', requirePlatformPermission(PlatformPermission.TENANT_DATA_VIEW), getTenantInventoryList);
router.get('/:id/financials', requirePlatformPermission(PlatformPermission.TENANT_DATA_VIEW), getTenantFinancials);

// Mutation / lifecycle endpoints
router.post(
  '/',
  requirePlatformPermission(PlatformPermission.TENANTS_MANAGE),
  createTenant
);

router.post(
  '/:id/suspend',
  requirePlatformPermission(PlatformPermission.TENANTS_SUSPEND),
  requireReason(10),
  suspendTenant
);

router.post(
  '/:id/unsuspend',
  requirePlatformPermission(PlatformPermission.TENANTS_REACTIVATE),
  requireReason(10),
  unsuspendTenant
);

router.post(
  '/:id/reactivate',
  requirePlatformPermission(PlatformPermission.TENANTS_REACTIVATE),
  requireReason(10),
  unsuspendTenant
);

router.delete(
  '/:id',
  requirePlatformPermission(PlatformPermission.TENANTS_MANAGE),
  requireReason(10),
  deleteTenant
);

export default router;
