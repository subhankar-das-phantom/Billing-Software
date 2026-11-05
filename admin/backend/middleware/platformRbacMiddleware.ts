/**
 * Bharat Enterprise Billing System — Platform Control Plane RBAC Middleware
 * Enforces granular permission evaluation and operational reason requirements.
 */

import type { Request, Response, NextFunction } from 'express';
import { PlatformPermission, PlatformRequest } from '../types';
import { hasPermission } from '../permissions';

/**
 * Enforces one or more platform permissions against the authenticated platform user.
 * Fails closed with HTTP 403 Forbidden if permissions are insufficient or user is inactive.
 */
export function requirePlatformPermission(...requiredPermissions: PlatformPermission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const platformReq = req as PlatformRequest;
    const user = platformReq.platformUser;

    if (!user || user.isActive === false) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient platform permissions',
        required: requiredPermissions,
      });
      return;
    }

    const missingPermissions = requiredPermissions.filter(
      (perm) => !hasPermission(user.role, user.customPermissions, perm),
    );

    if (missingPermissions.length > 0) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient platform permissions',
        required: requiredPermissions,
      });
      return;
    }

    next();
  };
}

/**
 * Enforces that a non-empty, detailed operational reason is provided in the request body.
 * Essential for SOC2 / ISO-27001 auditability on destructive or privileged actions.
 */
export function requireReason(minLength = 10) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const reason = req.body?.reason;

    if (!reason || typeof reason !== 'string' || reason.trim().length < minLength) {
      res.status(400).json({
        success: false,
        message: `A valid operational reason (minimum ${minLength} characters) is required for this action.`,
      });
      return;
    }

    req.body.reason = reason.trim();
    next();
  };
}
