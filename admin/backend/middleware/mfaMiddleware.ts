/**
 * Bharat Enterprise Billing System — Platform MFA Enforcement Middleware
 * Mandates multi-factor authentication enrollment for elevated administrative roles.
 */

import { Response, NextFunction } from 'express';
import { PlatformRole, PlatformRequest } from '../types';

/**
 * Middleware: Enforces that elevated platform roles (PLATFORM_OWNER, PLATFORM_ADMIN)
 * have completed MFA enrollment before proceeding.
 */
export function requireMfaVerified(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.platformUser;

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Platform authentication required.',
    });
    return;
  }

  // Elevated roles must have MFA enabled
  if (user.role === PlatformRole.PLATFORM_OWNER || user.role === PlatformRole.PLATFORM_ADMIN) {
    if (!user.mfaEnabled) {
      res.status(403).json({
        success: false,
        error: 'Multi-factor authentication (MFA) enrollment is mandatory for administrative roles.',
        code: 'MFA_ENROLLMENT_REQUIRED',
      });
      return;
    }
  }

  next();
}
