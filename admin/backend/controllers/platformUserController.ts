/**
 * Bharat Enterprise Billing System — Platform User Controller
 * Full user lifecycle management with RBAC privilege ceilings and audit logging.
 */

import { Response } from 'express';
import { PlatformUser } from '../models/PlatformUser';
import PlatformSupportSession from '../models/PlatformSupportSession';
import { PlatformRole, PlatformPermission, canManageRole, hasPermission } from '../permissions';
import { logPlatformAudit } from '../services/platformAuditService';
import type { PlatformRequest } from '../types';
import { SupportSessionStatus } from '../types';

/**
 * GET /api/platform/users
 * Lists operators and platform users with optional search and role filtering.
 */
export async function getUsers(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const { search, role, isActive, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { fullName: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
      ];
    }

    if (role && typeof role === 'string' && Object.values(PlatformRole).includes(role as PlatformRole)) {
      filter.role = role;
    }

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    const [users, totalCount] = await Promise.all([
      PlatformUser.find(filter)
        .select('-password -mfaSecret -mfaBackupCodes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PlatformUser.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve platform users',
    });
  }
}

/**
 * GET /api/platform/users/:id
 * Retrieves a single platform user by ID.
 */
export async function getUserById(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = await PlatformUser.findById(id).select('-password -mfaSecret -mfaBackupCodes').lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Platform user not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve platform user',
    });
  }
}

/**
 * POST /api/platform/users
 * Creates a new platform user adhering to strict privilege and custom permission ceilings.
 */
export async function createUser(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const actingUser = req.platformUser;
    if (!actingUser) {
      res.status(403).json({ success: false, message: 'Platform user context required' });
      return;
    }

    const { email, password, fullName, role, customPermissions = [], reason } = req.body || {};

    if (!email || !password || !fullName || !role) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, fullName, and role are required',
      });
      return;
    }

    const targetRole = role as PlatformRole;
    if (!Object.values(PlatformRole).includes(targetRole)) {
      res.status(400).json({ success: false, message: `Invalid platform role: ${role}` });
      return;
    }

    // 1. Enforce Privilege Ceiling: acting operator cannot create an operator of equal or higher role
    if (!canManageRole(actingUser.role, targetRole)) {
      res.status(403).json({
        success: false,
        message: 'Privilege ceiling: Cannot create an operator with equal or higher role privileges than your own.',
      });
      return;
    }

    // 2. Enforce Custom Permission Ceiling: operator cannot grant permissions they do not possess
    if (Array.isArray(customPermissions) && customPermissions.length > 0) {
      for (const perm of customPermissions) {
        if (!hasPermission(actingUser.role, actingUser.customPermissions, perm)) {
          res.status(403).json({
            success: false,
            message: `Privilege ceiling: Cannot grant custom permission "${perm}" which acting operator does not possess.`,
          });
          return;
        }
      }
    }

    // 3. Uniqueness check
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await PlatformUser.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({
        success: false,
        message: 'A platform user with this email address already exists',
      });
      return;
    }

    // 4. Create user (password hashed via pre-save hook in PlatformUser)
    const newUser = new PlatformUser({
      email: normalizedEmail,
      password,
      fullName: fullName.trim(),
      role: targetRole,
      customPermissions: Array.isArray(customPermissions) ? customPermissions : [],
      createdBy: actingUser._id,
      mustChangePassword: true,
    });

    await newUser.save();

    // 5. Append-only tamper-evident audit logging
    await logPlatformAudit({
      actorId: actingUser._id,
      actorEmail: actingUser.email,
      actorRole: actingUser.role,
      action: 'platform.user.create',
      targetType: 'PlatformUser',
      targetId: newUser._id.toString(),
      reason: reason || 'Platform user account created',
      after: {
        _id: newUser._id.toString(),
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        customPermissions: newUser.customPermissions,
        isActive: newUser.isActive,
      },
      ipAddress: (req.headers && (req.headers['x-forwarded-for'] as string)) || req.socket?.remoteAddress || '',
      userAgent: (req.headers && (req.headers['user-agent'] as string)) || '',
      severity: 'INFO',
    });

    const sanitized = newUser.toObject();
    delete (sanitized as any).password;
    delete (sanitized as any).mfaSecret;
    delete (sanitized as any).mfaBackupCodes;

    res.status(201).json({
      success: true,
      data: sanitized,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create platform user',
    });
  }
}

/**
 * PUT /api/platform/users/:id
 * Updates an existing platform user enforcing anti-self-lockout, anti-self-demotion,
 * last owner protection, privilege ceiling, and permission ceilings.
 */
export async function updateUser(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const actingUser = req.platformUser;
    if (!actingUser) {
      res.status(403).json({ success: false, message: 'Platform user context required' });
      return;
    }

    const { id } = req.params;
    const targetUser = await PlatformUser.findById(id);

    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Platform user not found' });
      return;
    }

    const isSelf = targetUser._id.toString() === actingUser._id.toString();
    const { fullName, role, customPermissions, isActive, mustChangePassword, password, reason } =
      req.body || {};

    // 1. Anti-Self-Lockout: operator cannot toggle isActive = false on their own account
    if (isSelf && isActive === false) {
      res.status(400).json({
        success: false,
        message: 'Anti-self-lockout: Operators cannot deactivate their own platform account.',
      });
      return;
    }

    // 2. Anti-Self-Demotion: operator cannot change their own role
    if (isSelf && role !== undefined && role !== actingUser.role) {
      res.status(400).json({
        success: false,
        message: 'Anti-self-demotion: Operators cannot modify their own platform role.',
      });
      return;
    }

    // 3. Privilege Ceiling:
    // Acting user must be able to manage target user's current role (unless modifying self non-role fields)
    if (!isSelf && !canManageRole(actingUser.role, targetUser.role)) {
      res.status(403).json({
        success: false,
        message: 'Privilege ceiling: Cannot modify an operator with equal or higher role privileges than your own.',
      });
      return;
    }

    // If changing role, acting user must be able to manage the new target role
    if (role !== undefined && role !== targetUser.role) {
      const newRole = role as PlatformRole;
      if (!Object.values(PlatformRole).includes(newRole)) {
        res.status(400).json({ success: false, message: `Invalid platform role: ${role}` });
        return;
      }
      if (!canManageRole(actingUser.role, newRole)) {
        res.status(403).json({
          success: false,
          message: 'Privilege ceiling: Cannot assign a role equal to or higher than your own privileges.',
        });
        return;
      }
    }

    // 4. Last Owner Protection: Cannot deactivate or demote a PLATFORM_OWNER if they are the last active owner
    if (targetUser.role === PlatformRole.PLATFORM_OWNER) {
      const willDemote = role !== undefined && role !== PlatformRole.PLATFORM_OWNER;
      const willDeactivate = isActive === false;

      if (willDemote || willDeactivate) {
        const remainingOwnersCount = await PlatformUser.countDocuments({
          role: PlatformRole.PLATFORM_OWNER,
          isActive: true,
          _id: { $ne: targetUser._id },
        });

        if (remainingOwnersCount === 0) {
          res.status(400).json({
            success: false,
            message: 'Last owner protection: Cannot deactivate or demote the last remaining active Platform Owner.',
          });
          return;
        }
      }
    }

    // 5. Custom Permission Ceiling: operator cannot grant permissions they do not possess
    if (customPermissions !== undefined && Array.isArray(customPermissions)) {
      for (const perm of customPermissions) {
        if (!hasPermission(actingUser.role, actingUser.customPermissions, perm)) {
          res.status(403).json({
            success: false,
            message: `Privilege ceiling: Cannot grant custom permission "${perm}" which acting operator does not possess.`,
          });
          return;
        }
      }
    }

    // Capture before snapshot
    const beforeSnapshot = {
      _id: targetUser._id.toString(),
      email: targetUser.email,
      fullName: targetUser.fullName,
      role: targetUser.role,
      customPermissions: [...targetUser.customPermissions],
      isActive: targetUser.isActive,
      mustChangePassword: targetUser.mustChangePassword,
    };

    // Apply updates
    if (fullName !== undefined && typeof fullName === 'string' && fullName.trim()) {
      targetUser.fullName = fullName.trim();
    }
    if (role !== undefined && Object.values(PlatformRole).includes(role as PlatformRole)) {
      targetUser.role = role as PlatformRole;
    }
    if (customPermissions !== undefined && Array.isArray(customPermissions)) {
      targetUser.customPermissions = customPermissions;
    }
    if (isActive !== undefined && typeof isActive === 'boolean') {
      targetUser.isActive = isActive;
      // Cascading Invalidation: if operator is suspended (isActive === false), immediately invalidate all active support sessions
      if (isActive === false) {
        await PlatformSupportSession.updateMany(
          {
            $or: [{ operatorId: targetUser._id }, { endedBy: targetUser._id }],
            status: SupportSessionStatus.ACTIVE,
          },
          {
            $set: {
              status: SupportSessionStatus.REVOKED,
              isRevoked: true,
              endedAt: new Date(),
            },
          }
        );
      }
    }
    if (mustChangePassword !== undefined && typeof mustChangePassword === 'boolean') {
      targetUser.mustChangePassword = mustChangePassword;
    }
    if (password && typeof password === 'string' && password.length >= 8) {
      targetUser.password = password; // Trigger pre-save bcrypt hash
    }

    await targetUser.save();

    // Capture after snapshot
    const afterSnapshot = {
      _id: targetUser._id.toString(),
      email: targetUser.email,
      fullName: targetUser.fullName,
      role: targetUser.role,
      customPermissions: [...targetUser.customPermissions],
      isActive: targetUser.isActive,
      mustChangePassword: targetUser.mustChangePassword,
    };

    // Severity escalation: role or active status changes are WARNING
    const isSecuritySensitiveChange =
      beforeSnapshot.role !== afterSnapshot.role ||
      beforeSnapshot.isActive !== afterSnapshot.isActive;

    // Log to tamper-evident audit ledger
    await logPlatformAudit({
      actorId: actingUser._id,
      actorEmail: actingUser.email,
      actorRole: actingUser.role,
      action: 'platform.user.update',
      targetType: 'PlatformUser',
      targetId: targetUser._id.toString(),
      reason: reason || 'Platform user account updated',
      before: beforeSnapshot,
      after: afterSnapshot,
      ipAddress: (req.headers && (req.headers['x-forwarded-for'] as string)) || req.socket?.remoteAddress || '',
      userAgent: (req.headers && (req.headers['user-agent'] as string)) || '',
      severity: isSecuritySensitiveChange ? 'WARNING' : 'INFO',
    });

    const sanitized = targetUser.toObject();
    delete (sanitized as any).password;
    delete (sanitized as any).mfaSecret;
    delete (sanitized as any).mfaBackupCodes;

    res.status(200).json({
      success: true,
      data: sanitized,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update platform user',
    });
  }
}
