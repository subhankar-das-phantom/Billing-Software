/**
 * Bharat Enterprise Billing System — Platform Authentication Service
 * Authentication, brute-force mitigation, session lifecycle, and MFA integration.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import PlatformUser, { PlatformUserDocument } from '../models/PlatformUser';
import PlatformSession from '../models/PlatformSession';
import * as mfaService from './mfaService';
import { IPlatformUser, IPlatformSession } from '../types';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

let hasWarnedMissingJwtSecret = false;

/**
 * Returns the secret key for signing Super Admin Control Plane JWTs.
 */
export function getPlatformJwtSecret(): string {
  const secret = process.env.PLATFORM_JWT_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL SECURITY ERROR] PLATFORM_JWT_SECRET is mandatory in production environment.');
  }

  if (!hasWarnedMissingJwtSecret) {
    console.warn('[SECURITY WARNING] PLATFORM_JWT_SECRET not configured. Using development fallback secret.');
    hasWarnedMissingJwtSecret = true;
  }

  return 'dev-platform-jwt-secret-key-bharat-billing-super-admin';
}

/**
 * Sanitizes a PlatformUser document for client-facing exposure.
 * Strips password, MFA secret, and hashed recovery codes.
 */
export function sanitizePlatformUser(user: IPlatformUser | PlatformUserDocument): Record<string, unknown> {
  const raw = typeof (user as any).toObject === 'function' ? (user as any).toObject() : user;
  const {
    password: _p,
    mfaSecret: _m,
    mfaBackupCodes: _b,
    ...clean
  } = raw;
  return clean;
}

/**
 * Creates a PlatformSession in the database and returns a signed JWT.
 */
async function createPlatformSessionAndJwt(
  user: IPlatformUser,
  ipAddress: string = '',
  userAgent: string = ''
): Promise<{ session: IPlatformSession; token: string }> {
  const sessionIdentifier = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(sessionIdentifier).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await PlatformSession.create({
    platformUserId: user._id,
    tokenHash,
    ipAddress,
    userAgent,
    expiresAt,
    isRevoked: false,
    lastActiveAt: new Date(),
  });

  const jwtSecret = getPlatformJwtSecret();
  const token = jwt.sign(
    {
      platformUserId: user._id.toString(),
      sessionId: session._id.toString(),
      sessionToken: sessionIdentifier,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '24h' }
  );

  return { session, token };
}

export interface LoginResult {
  mfaRequired: boolean;
  mfaPendingToken?: string;
  user?: Record<string, unknown>;
  token?: string;
  session?: IPlatformSession;
}

/**
 * Authenticates a platform operator by email and password with brute-force protection.
 */
export async function login(
  email: string,
  password: string,
  ipAddress: string = '',
  userAgent: string = ''
): Promise<LoginResult> {
  if (!email || !password) {
    const error: any = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await PlatformUser.findOne({ email: normalizedEmail }).select('+password +mfaSecret');

  if (!user) {
    const error: any = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error: any = new Error('Platform account has been deactivated. Please contact platform owner.');
    error.statusCode = 403;
    throw error;
  }

  // Brute-force lockout check
  if (user.lockUntil && user.lockUntil > new Date()) {
    const remainingMinutes = Math.max(1, Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000)));
    const error: any = new Error(`Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minute(s).`);
    error.statusCode = 423;
    error.code = 'ACCOUNT_LOCKED';
    throw error;
  }

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
      user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await user.save();

    const error: any = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Reset lockout counters upon successful password verification
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  // If MFA is enabled, issue a short-lived pending token
  if (user.mfaEnabled) {
    const jwtSecret = getPlatformJwtSecret();
    const mfaPendingToken = jwt.sign(
      {
        platformUserId: user._id.toString(),
        type: 'mfa_pending',
      },
      jwtSecret,
      { expiresIn: '5m' }
    );

    return {
      mfaRequired: true,
      mfaPendingToken,
    };
  }

  // MFA not enabled: create session and issue full platform token
  const { session, token } = await createPlatformSessionAndJwt(user, ipAddress, userAgent);

  return {
    mfaRequired: false,
    user: sanitizePlatformUser(user),
    token,
    session,
  };
}

/**
 * Completes MFA verification and issues full session JWT.
 */
export async function verifyMfaAndLogin(
  mfaPendingToken: string,
  code: string,
  isBackupCode: boolean = false,
  ipAddress: string = '',
  userAgent: string = ''
): Promise<{ user: Record<string, unknown>; token: string; session: IPlatformSession }> {
  if (!mfaPendingToken || !code) {
    const error: any = new Error('MFA token and verification code are required');
    error.statusCode = 400;
    throw error;
  }

  const jwtSecret = getPlatformJwtSecret();
  let decoded: any;
  try {
    decoded = jwt.verify(mfaPendingToken, jwtSecret);
  } catch {
    const error: any = new Error('Invalid or expired MFA verification session');
    error.statusCode = 401;
    throw error;
  }

  if (decoded.type !== 'mfa_pending' || !decoded.platformUserId) {
    const error: any = new Error('Invalid MFA token payload');
    error.statusCode = 401;
    throw error;
  }

  const user = await PlatformUser.findById(decoded.platformUserId).select('+password +mfaSecret');
  if (!user || !user.isActive) {
    const error: any = new Error('Platform account is not active or no longer exists');
    error.statusCode = 403;
    throw error;
  }

  if (isBackupCode) {
    const valid = await mfaService.verifyAndConsumeBackupCode(user, code);
    if (!valid) {
      const error: any = new Error('Invalid or already used backup code');
      error.statusCode = 401;
      throw error;
    }
  } else {
    if (!user.mfaSecret) {
      const error: any = new Error('MFA is not configured for this user');
      error.statusCode = 400;
      throw error;
    }
    const plainSecret = mfaService.decryptSecret(user.mfaSecret);
    const valid = mfaService.verifyTotp(plainSecret, code);
    if (!valid) {
      const error: any = new Error('Invalid MFA verification code');
      error.statusCode = 401;
      throw error;
    }
  }

  const { session, token } = await createPlatformSessionAndJwt(user, ipAddress, userAgent);

  return {
    user: sanitizePlatformUser(user),
    token,
    session,
  };
}

/**
 * Revokes a platform session.
 */
export async function logout(sessionId: string | Types.ObjectId, reason: string = 'USER_LOGOUT'): Promise<void> {
  await PlatformSession.findByIdAndUpdate(sessionId, {
    isRevoked: true,
    revokedAt: new Date(),
    revokedReason: reason,
  });
}

/**
 * Refreshes session activity timestamp.
 */
export async function refreshSession(sessionId: string | Types.ObjectId): Promise<IPlatformSession> {
  const session = await PlatformSession.findById(sessionId);
  if (!session || session.isRevoked || session.expiresAt <= new Date()) {
    const error: any = new Error('Platform session is expired or revoked');
    error.statusCode = 401;
    throw error;
  }

  session.lastActiveAt = new Date();
  await session.save();
  return session;
}
