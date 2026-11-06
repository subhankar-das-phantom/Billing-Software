/**
 * Bharat Enterprise Billing System — Platform Support Controller
 * HTTP endpoints for initiating, ending, querying active, and listing support sessions.
 */

import { Response } from 'express';
import { PlatformRequest, SupportSessionStatus } from '../types';
import {
  startSupportSession,
  endSupportSession,
  revokeSupportSession,
  getActiveSupportSession,
  listSupportSessions,
} from '../services/supportSessionService';

/**
 * Initiates a new diagnostic support session.
 * POST /api/platform/support/sessions
 */
export async function startSession(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const operator = req.platformUser;
    if (!operator) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Platform operator not resolved.',
      });
      return;
    }

    const { targetTenantId, reason, durationHours } = req.body;

    if (!targetTenantId) {
      res.status(400).json({
        success: false,
        error: 'targetTenantId is required.',
      });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: 'Reason is required and must be at least 10 characters long.',
      });
      return;
    }

    const duration = typeof durationHours === 'number' ? durationHours : 2;

    const session = await startSupportSession(
      operator,
      targetTenantId,
      reason,
      duration
    );

    res.status(201).json({
      success: true,
      message: 'Support session started successfully',
      data: session,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to start support session',
    });
  }
}

/**
 * Concludes an active diagnostic support session.
 * POST /api/platform/support/sessions/:id/end
 */
export async function endSession(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const operator = req.platformUser;
    if (!operator) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Platform operator not resolved.',
      });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Session ID or session code is required.',
      });
      return;
    }

    const sessionId = Array.isArray(id) ? id[0]! : id;
    const session = await endSupportSession(sessionId, operator._id, reason);

    res.status(200).json({
      success: true,
      message: 'Support session ended successfully',
      data: session,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to end support session',
    });
  }
}

/**
 * Revokes an active diagnostic support session with zero-window tolerance.
 * POST /api/platform/support/sessions/:id/revoke
 */
export async function revokeSession(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const operator = req.platformUser;
    if (!operator) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Platform operator not resolved.',
      });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body || {};

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Session ID or session code is required.',
      });
      return;
    }

    const sessionId = Array.isArray(id) ? id[0]! : id;
    const session = await revokeSupportSession(sessionId, operator._id, reason);

    res.status(200).json({
      success: true,
      message: 'Support session revoked successfully',
      data: session,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to revoke support session',
    });
  }
}

/**
 * Retrieves the currently active support session for the calling operator.
 * GET /api/platform/support/sessions/active
 */
export async function getActiveSession(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const operator = req.platformUser;
    if (!operator) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Platform operator not resolved.',
      });
      return;
    }

    const session = await getActiveSupportSession(operator._id);

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch active support session',
    });
  }
}

/**
 * Lists historical diagnostic support sessions with optional filtering & pagination.
 * GET /api/platform/support/sessions
 */
export async function listSessions(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const { page, limit, operatorId, targetTenantId, status } = req.query;

    const filter: {
      operatorId?: string;
      targetTenantId?: string;
      status?: SupportSessionStatus;
    } = {};

    if (operatorId && typeof operatorId === 'string') {
      filter.operatorId = operatorId;
    }
    if (targetTenantId && typeof targetTenantId === 'string') {
      filter.targetTenantId = targetTenantId;
    }
    if (status && typeof status === 'string' && Object.values(SupportSessionStatus).includes(status as SupportSessionStatus)) {
      filter.status = status as SupportSessionStatus;
    }

    const pagination = {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    };

    const result = await listSupportSessions(filter, pagination);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list support sessions',
    });
  }
}
