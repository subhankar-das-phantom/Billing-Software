import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { shareService } from '../services/shareService';

const getTenantId = require('../utils/getTenantId');

/**
 * Authenticated Share Controller
 * Handles creating, reusing, and revoking share links for tenant resources.
 */
export const shareController = {
  createOrGetShare: async (req: any, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(req);
      const { resourceType = 'invoice', resourceId } = req.body;

      if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid resourceId is required'
        });
      }

      const validTypes = ['invoice', 'receipt', 'quotation', 'credit_note', 'payment_receipt'];
      if (!validTypes.includes(resourceType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid resourceType. Supported: ${validTypes.join(', ')}`
        });
      }

      const result = await shareService.getOrCreateShare({
        tenantId,
        resourceType,
        resourceId,
        user: req.user,
        userModel: req.userModel
      });

      return res.status(result.isNew ? 201 : 200).json({
        success: true,
        rawToken: result.rawToken,
        shareUrl: `/share/${result.rawToken}`,
        isNew: result.isNew,
        expiresAt: result.share.expiresAt || null
      });
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: err.message
        });
      }
      return next(err);
    }
  },

  revokeShare: async (req: any, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(req);
      const { id } = req.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Valid share ID is required'
        });
      }

      const revoked = await shareService.revokeShare(tenantId, id);
      if (!revoked) {
        return res.status(404).json({
          success: false,
          message: 'Active share not found or already revoked'
        });
      }

      return res.json({
        success: true,
        message: 'Share link revoked successfully'
      });
    } catch (err) {
      return next(err);
    }
  }
};

export default shareController;
