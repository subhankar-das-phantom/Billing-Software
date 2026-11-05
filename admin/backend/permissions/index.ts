/**
 * Bharat Enterprise Billing System — Platform Control Plane RBAC
 * Centralized Role-Permission mapping, privilege ceiling, and evaluation logic.
 */

import { PlatformRole, PlatformPermission } from '../types';

export { PlatformRole, PlatformPermission };

// ─── Canonical Role Permission Mappings ──────────────────────────
export const ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  [PlatformRole.PLATFORM_OWNER]: Object.values(PlatformPermission),

  [PlatformRole.PLATFORM_ADMIN]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.TENANTS_MANAGE,
    PlatformPermission.TENANTS_SUSPEND,
    PlatformPermission.TENANTS_REACTIVATE,
    PlatformPermission.TENANT_DATA_VIEW,
    PlatformPermission.SUBSCRIPTIONS_VIEW,
    PlatformPermission.SUBSCRIPTIONS_MANAGE,
    PlatformPermission.FEATURE_OVERRIDES_VIEW,
    PlatformPermission.FEATURE_OVERRIDES_MANAGE,
    PlatformPermission.SUPPORT_START,
    PlatformPermission.SUPPORT_OPERATE,
    PlatformPermission.SUPPORT_END,
    PlatformPermission.AUDIT_VIEW,
    PlatformPermission.USERS_VIEW,
    PlatformPermission.USERS_MANAGE,
    // Note: EMERGENCY_BYPASS_MANAGE is intentionally OWNER-only by default
  ],

  [PlatformRole.SUPPORT_ADMIN]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.TENANT_DATA_VIEW,
    PlatformPermission.SUBSCRIPTIONS_VIEW,
    PlatformPermission.SUBSCRIPTIONS_MANAGE, // Max 14 days adjustment
    PlatformPermission.FEATURE_OVERRIDES_VIEW,
    PlatformPermission.FEATURE_OVERRIDES_MANAGE, // Max 7 days override
    PlatformPermission.SUPPORT_START,
    PlatformPermission.SUPPORT_OPERATE, // Diagnostics only
    PlatformPermission.SUPPORT_END,
    PlatformPermission.AUDIT_VIEW,
  ],

  [PlatformRole.SUPPORT_AGENT]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.TENANT_DATA_VIEW,
    PlatformPermission.SUPPORT_START,
    PlatformPermission.SUPPORT_END,
  ],

  [PlatformRole.TELESUPPORT]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW, // Contact & firm overview only
  ],

  [PlatformRole.READ_ONLY]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.SUBSCRIPTIONS_VIEW,
    PlatformPermission.AUDIT_VIEW,
  ],
};

// ─── Permission Evaluation Engine ────────────────────────────────
export function hasPermission(
  role: PlatformRole,
  customPermissions: string[] | undefined,
  requiredPermission: PlatformPermission,
): boolean {
  // 1. Platform Owner has absolute authority over all permissions
  if (role === PlatformRole.PLATFORM_OWNER) {
    return true;
  }

  // 2. Check base role permissions
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  if (rolePerms.includes(requiredPermission)) {
    return true;
  }

  // 3. Check custom permissions grant
  if (customPermissions && Array.isArray(customPermissions)) {
    if (customPermissions.includes(requiredPermission)) {
      return true;
    }
  }

  return false;
}

// ─── Privilege Ceiling & Role Hierarchy Invariants ───────────────
const ROLE_HIERARCHY_LEVEL: Record<PlatformRole, number> = {
  [PlatformRole.PLATFORM_OWNER]: 100,
  [PlatformRole.PLATFORM_ADMIN]: 80,
  [PlatformRole.SUPPORT_ADMIN]: 60,
  [PlatformRole.SUPPORT_AGENT]: 40,
  [PlatformRole.TELESUPPORT]: 20,
  [PlatformRole.READ_ONLY]: 10,
};

/**
 * Validates that an operator cannot create or mutate an account with a role
 * equal to or higher than their own (except OWNER managing other OWNERs).
 */
export function canManageRole(
  actingRole: PlatformRole,
  targetRole: PlatformRole,
): boolean {
  if (actingRole === PlatformRole.PLATFORM_OWNER) {
    return true;
  }

  const actingLevel = ROLE_HIERARCHY_LEVEL[actingRole] ?? 0;
  const targetLevel = ROLE_HIERARCHY_LEVEL[targetRole] ?? 0;

  // Strict inequality: must be strictly lower than acting operator's level
  return actingLevel > targetLevel;
}

