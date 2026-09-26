import mongoose from 'mongoose';
import Share, { IShare } from '../models/Share';
import { generateRawToken, hashToken, encryptToken, decryptToken } from '../utils/shareCrypto';
import { serializePublicInvoice, IPublicInvoiceDTO } from '../utils/serializers/publicInvoiceSerializer';

const Invoice = require('../models/Invoice');
const { getDistributorByTenantId } = require('../controllers/invoice/invoiceExportController');

export interface CreateShareParams {
  tenantId: mongoose.Types.ObjectId | string;
  resourceType: 'invoice' | 'receipt' | 'quotation' | 'credit_note' | 'payment_receipt';
  resourceId: mongoose.Types.ObjectId | string;
  user: { _id: mongoose.Types.ObjectId | string };
  userModel: 'Admin' | 'Employee';
}

export interface ShareResult {
  share: IShare;
  rawToken: string;
  isNew: boolean;
}

export interface ResolvedPublicResource {
  share: IShare;
  resourceType: string;
  publicData: IPublicInvoiceDTO;
  invoice: any;
  distributor: any;
}

export const shareService = {
  /**
   * Get an existing active share link or atomically create a new one.
   * Enforces race-condition protection via MongoDB partial unique index.
   */
  getOrCreateShare: async ({
    tenantId,
    resourceType,
    resourceId,
    user,
    userModel
  }: CreateShareParams): Promise<ShareResult> => {
    // 1. Verify existence and tenant ownership of target resource
    if (resourceType === 'invoice') {
      const invoice = await Invoice.findOne({ _id: resourceId, tenantId }).lean();
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }
    } else {
      throw new Error(`Unsupported resource type for sharing: ${resourceType}`);
    }

    const tenantObjectId = new mongoose.Types.ObjectId(String(tenantId));
    const resourceObjectId = new mongoose.Types.ObjectId(String(resourceId));

    // 2. Query for existing active share
    const now = new Date();
    let existingShare = await Share.findOne({
      tenantId: tenantObjectId,
      resourceType,
      resourceId: resourceObjectId,
      revokedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    });

    if (existingShare) {
      const decrypted = decryptToken(existingShare.encryptedToken);
      if (decrypted) {
        return {
          share: existingShare,
          rawToken: decrypted,
          isNew: false
        };
      }

      // Safe key-rotation fallback: If decryption fails, mark old share as revoked and proceed to create fresh share
      console.warn(`[ShareService] Stale/unreadable share token encountered for ${resourceType} ${resourceId}. Revoking and renewing.`);
      await Share.updateOne({ _id: existingShare._id }, { revokedAt: new Date() });
    }

    // 3. Generate fresh token pair
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const encryptedToken = encryptToken(rawToken);

    try {
      const newShare = await Share.create({
        tenantId: tenantObjectId,
        resourceType,
        resourceId: resourceObjectId,
        tokenHash,
        encryptedToken,
        createdBy: user._id,
        createdByType: userModel || 'Admin'
      });

      return {
        share: newShare,
        rawToken,
        isNew: true
      };
    } catch (err: any) {
      // 4. Handle concurrent creation race (MongoDB E11000 duplicate key error on partial unique index)
      if (err.code === 11000) {
        const winningShare = await Share.findOne({
          tenantId: tenantObjectId,
          resourceType,
          resourceId: resourceObjectId,
          revokedAt: null
        });

        if (winningShare) {
          const decrypted = decryptToken(winningShare.encryptedToken);
          if (decrypted) {
            return {
              share: winningShare,
              rawToken: decrypted,
              isNew: false
            };
          }
        }
      }
      throw err;
    }
  },

  /**
   * Revoke an active share link
   */
  revokeShare: async (tenantId: string | mongoose.Types.ObjectId, shareId: string | mongoose.Types.ObjectId) => {
    return Share.findOneAndUpdate(
      {
        _id: shareId,
        tenantId,
        revokedAt: null
      },
      {
        revokedAt: new Date()
      },
      { new: true }
    );
  },

  /**
   * Resolve a public raw token to its underlying resource with complete data sanitization.
   */
  resolvePublicResource: async (rawToken: string): Promise<ResolvedPublicResource | null> => {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const share = await Share.findOne({
      tokenHash,
      revokedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    });

    if (!share) {
      return null;
    }

    // Non-blocking fire-and-forget access audit
    Share.updateOne(
      { _id: share._id },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessedAt: new Date() }
      }
    ).exec().catch((e) => console.warn('[ShareService] Non-blocking accessCount update failed:', e));

    if (share.resourceType === 'invoice') {
      const invoice = await Invoice.findOne({
        _id: share.resourceId,
        tenantId: share.tenantId
      }).lean();

      if (!invoice) {
        return null;
      }

      const distributor = await getDistributorByTenantId(invoice, share.tenantId);
      const publicData = serializePublicInvoice(invoice, distributor, rawToken);

      return {
        share,
        resourceType: 'invoice',
        publicData,
        invoice,
        distributor
      };
    }

    return null;
  }
};

export default shareService;
module.exports = { shareService };
