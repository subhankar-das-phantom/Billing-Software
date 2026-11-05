/**
 * Bharat Enterprise Billing System — Platform Authentication Middleware
 * Enforces Super Admin Control Plane session isolation and strictly purges tenant context.
 */

import { Response, NextFunction, CookieOptions } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPlatformJwtSecret } from '../auth/platformAuthService';
import PlatformSession from '../models/PlatformSession';
import PlatformUser from '../models/PlatformUser';
import { PlatformRequest } from '../types';

/**
 * Returns standardized cookie options for platform authentication tokens.
 */
export function getPlatformCookieOptions(isProduction: boolean = process.env.NODE_ENV === 'production'): CookieOptions {
  return {
    path: '/api/platform',
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
}

/**
 * Middleware: Authenticates platform requests using cookies or Bearer token header.
 */
export async function requirePlatformAuth(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined = req.cookies?.platform_token;

    // Bearer token fallback for API clients or tools
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. No platform token provided.',
      });
      return;
    }

    const jwtSecret = getPlatformJwtSecret();
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired platform token.',
      });
      return;
    }

    if (!decoded.sessionId || !decoded.platformUserId) {
      res.status(401).json({
        success: false,
        error: 'Malformed platform token.',
      });
      return;
    }

    // 1. Verify active session in DB
    const session = await PlatformSession.findById(decoded.sessionId);
    if (!session || session.isRevoked || session.expiresAt <= new Date()) {
      res.status(401).json({
        success: false,
        error: 'Platform session has expired or been revoked.',
      });
      return;
    }

    // 2. Verify sessionToken integrity if present in JWT payload
    if (decoded.sessionToken) {
      const computedHash = crypto.createHash('sha256').update(decoded.sessionToken).digest('hex');
      if (computedHash !== session.tokenHash) {
        res.status(401).json({
          success: false,
          error: 'Session integrity verification failed.',
        });
        return;
      }
    }

    // 3. Verify platform user is active
    const user = await PlatformUser.findById(decoded.platformUserId);
    if (!user || !user.isActive) {
      res.status(403).json({
        success: false,
        error: 'Platform account is inactive or disabled.',
      });
      return;
    }

    // 4. Populate typed platform request context
    req.platformUser = user;
    req.platformSession = session;

    // 5. Strictly purge tenant auth context to avoid cross-plane privilege leakage
    delete (req as any).user;
    delete (req as any).userRole;
    delete (req as any).userModel;
    delete (req as any).admin;

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Platform authentication middleware encountered an unexpected error',
    });
  }
}

/**
 * Standardized alias for authenticatePlatform
 */
export const authenticatePlatform = requirePlatformAuth;

/**
 * Blocks requests if the platform operator must change their temporary password.
 * Only permits access to /auth/change-password, /auth/logout, and /auth/me.
 */
export function requirePasswordChanged(req: PlatformRequest, res: Response, next: NextFunction): void {
  if (req.platformUser?.mustChangePassword) {
    const path = req.originalUrl || req.url;
    if (path.includes('/auth/change-password') || path.includes('/auth/logout') || path.includes('/auth/me')) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      error: 'You must change your temporary platform password before accessing control plane resources.',
    });
    return;
  }
  next();
}

