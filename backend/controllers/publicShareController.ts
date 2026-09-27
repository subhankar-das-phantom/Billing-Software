import { Request, Response, NextFunction } from 'express';
import { shareService } from '../services/shareService';
import { adaptPublicDTOToPDFInvoice } from '../utils/serializers/publicInvoiceSerializer';

const PDFDocument = require('pdfkit');
const { drawSingleInvoicePDF } = require('./invoice/invoiceExportController');

/**
 * Public Share Controller
 * Handles customer-facing unauthenticated views and PDF downloads.
 */
export const publicShareController = {
  /**
   * Get public customer-facing invoice data
   */
  getPublicShare: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawTokenParam = req.params.token;
      const token = Array.isArray(rawTokenParam) ? rawTokenParam[0] : rawTokenParam;
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Share token is required'
        });
      }

      // Security & Caching Headers: Bearer tokens are private credentials and must never be indexed or cached publicly
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Pragma', 'no-cache');

      const resolved = await shareService.resolvePublicResource(token);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'This document link is invalid, expired, or has been revoked'
        });
      }

      return res.json({
        success: true,
        resourceType: resolved.resourceType,
        data: resolved.publicData
      });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * Stream public invoice PDF directly to customer
   */
  getPublicSharePDF: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawTokenParam = req.params.token;
      const token = Array.isArray(rawTokenParam) ? rawTokenParam[0] : rawTokenParam;
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Share token is required'
        });
      }

      // Security & Caching Headers: Public invoice PDFs must never be indexed or cached publicly
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Pragma', 'no-cache');

      const resolved = await shareService.resolvePublicResource(token);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'This document link is invalid, expired, or has been revoked'
        });
      }

      if (resolved.resourceType === 'invoice') {
        // Enforce the public PDF data contract: pass only sanitized public DTO attributes
        const { invoice: sanitizedInvoice, distributor: sanitizedDistributor } = adaptPublicDTOToPDFInvoice(resolved.publicData);
        const invNum = sanitizedInvoice.invoiceNumber ? sanitizedInvoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Invoice';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invNum}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: false });
        doc.on('error', next);
        doc.pipe(res);
        drawSingleInvoicePDF(doc, sanitizedInvoice, sanitizedDistributor);
        return doc.end();
      }

      return res.status(400).json({
        success: false,
        message: `PDF generation not supported for resource type: ${resolved.resourceType}`
      });
    } catch (err) {
      return next(err);
    }
  }
};

export default publicShareController;
