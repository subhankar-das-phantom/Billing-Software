/**
 * Bharat Enterprise Billing System — Platform Auth Controller
 * Endpoints for Super Admin Control Plane authentication and credential management.
 */

import { Response } from 'express';
import * as platformAuthService from '../auth/platformAuthService';
import * as mfaService from '../auth/mfaService';
import { getPlatformCookieOptions, requirePlatformAuth } from '../middleware/platformAuthMiddleware';
import PlatformUser from '../models/PlatformUser';
import { PlatformRequest } from '../types';
import { extractClientIp } from '../utils/clientIp';

/**
 * POST /api/platform/auth/login
 */
export async function login(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const { email, password } = req.body || {};
    const ipAddress = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await platformAuthService.login(email, password, ipAddress, userAgent);

    if (result.mfaRequired) {
      res.status(200).json({
        success: true,
        mfaRequired: true,
        mfaPendingToken: result.mfaPendingToken,
      });
      return;
    }

    if (result.token) {
      res.cookie('platform_token', result.token, getPlatformCookieOptions());
    }

    res.status(200).json({
      success: true,
      mfaRequired: false,
      user: result.user,
      session: result.session,
      token: result.token,
    });
  } catch (error: any) {
    const status = error.statusCode || 401;
    res.status(status).json({
      success: false,
      error: error.message || 'Login failed',
      code: error.code,
      isLocked: Boolean(error.isLocked || status === 423),
    });
  }
}

/**
 * POST /api/platform/auth/mfa/verify
 */
export async function verifyMfa(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const { mfaPendingToken, code, isBackupCode } = req.body || {};
    const ipAddress = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    // 1. If mfaPendingToken is provided, complete 2FA login challenge
    if (mfaPendingToken) {
      const result = await platformAuthService.verifyMfaAndLogin(
        mfaPendingToken,
        code,
        Boolean(isBackupCode),
        ipAddress,
        userAgent
      );

      res.cookie('platform_token', result.token, getPlatformCookieOptions());

      res.status(200).json({
        success: true,
        user: result.user,
        session: result.session,
        token: result.token,
      });
      return;
    }

    // 2. If mfaPendingToken is not provided, check if an authenticated operator is confirming MFA setup
    if (!req.platformUser && (req.cookies?.platform_token || req.headers.authorization)) {
      await new Promise<void>((resolve, reject) => {
        requirePlatformAuth(req, res, (err?: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      if (res.headersSent) return;
    }

    if (req.platformUser) {
      return await enableMfa(req, res);
    }

    res.status(400).json({
      success: false,
      error: 'MFA token and verification code are required',
    });
  } catch (error: any) {
    const status = error.statusCode || 401;
    res.status(status).json({
      success: false,
      error: error.message || 'MFA verification failed',
      code: error.code,
      isLocked: Boolean(error.isLocked || status === 423),
    });
  }
}

/**
 * POST /api/platform/auth/mfa/setup (Protected)
 * Initiates MFA enrollment by generating a fresh secret and single-use recovery codes.
 */
export async function setupMfa(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const user = req.platformUser;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const setup = await mfaService.generateMfaSetup(user.email);

    // Save pending secret and hashed backup codes (MFA remains disabled until confirmed with code)
    await PlatformUser.findByIdAndUpdate(user._id, {
      mfaSecret: setup.encryptedSecret,
      mfaBackupCodes: setup.backupCodeHashes,
      mfaEnabled: false,
    });

    res.status(200).json({
      success: true,
      secret: setup.secret,
      otpAuthUri: setup.otpAuthUri,
      backupCodes: setup.backupCodes,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate MFA setup',
    });
  }
}

/**
 * POST /api/platform/auth/mfa/enable (Protected)
 * Confirms and activates MFA after verifying user's first TOTP code.
 */
export async function enableMfa(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const user = req.platformUser;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      res.status(400).json({ success: false, error: 'Verification code is required' });
      return;
    }

    // Retrieve user with stored encrypted MFA secret
    const dbUser = await PlatformUser.findById(user._id).select('+mfaSecret');
    if (!dbUser || !dbUser.mfaSecret) {
      res.status(400).json({
        success: false,
        error: 'MFA setup has not been initiated. Call /mfa/setup first.',
      });
      return;
    }

    const plainSecret = mfaService.decryptSecret(dbUser.mfaSecret);
    const isValid = mfaService.verifyTotp(plainSecret, code);

    if (!isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please check your authenticator application.',
      });
      return;
    }

    dbUser.mfaEnabled = true;
    await dbUser.save();

    res.status(200).json({
      success: true,
      message: 'Multi-factor authentication successfully enabled.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enable MFA',
    });
  }
}

/**
 * POST /api/platform/auth/logout
 */
export async function logout(req: PlatformRequest, res: Response): Promise<void> {
  try {
    if (req.platformSession?._id) {
      await platformAuthService.logout(req.platformSession._id, 'USER_LOGOUT');
    }

    const { maxAge, ...clearOptions } = getPlatformCookieOptions();
    res.clearCookie('platform_token', clearOptions);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to log out',
    });
  }
}

/**
 * POST /api/platform/auth/change-password (Protected)
 */
export async function changePassword(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const user = req.platformUser;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Both current password and new password are required.',
      });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 12) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 12 characters long.',
      });
      return;
    }

    const dbUser = await PlatformUser.findById(user._id).select('+password');
    if (!dbUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const isMatch = await dbUser.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        error: 'Current password does not match.',
      });
      return;
    }

    dbUser.password = newPassword;
    dbUser.mustChangePassword = false;
    await dbUser.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to change password',
    });
  }
}

/**
 * POST /api/platform/auth/refresh
 */
export async function refresh(req: PlatformRequest, res: Response): Promise<void> {
  try {
    if (!req.platformSession?._id) {
      res.status(401).json({ success: false, error: 'No active platform session' });
      return;
    }

    const refreshedSession = await platformAuthService.refreshSession(req.platformSession._id);

    res.status(200).json({
      success: true,
      session: refreshedSession,
    });
  } catch (error: any) {
    const status = error.statusCode || 401;
    res.status(status).json({
      success: false,
      error: error.message || 'Session refresh failed',
    });
  }
}

/**
 * GET /api/platform/auth/me (Protected)
 */
export async function getMe(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const user = req.platformUser;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    res.status(200).json({
      success: true,
      user: platformAuthService.sanitizePlatformUser(user),
      session: req.platformSession,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve user profile',
    });
  }
}
