import { Request, Response, NextFunction } from 'express';
import { shareService } from '../services/shareService';

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

      const resolved = await shareService.resolvePublicResource(token);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'This document link is invalid, expired, or has been revoked'
        });
      }

      if (resolved.resourceType === 'invoice') {
        const { invoice, distributor } = resolved;
        const invNum = invoice.invoiceNumber ? invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Invoice';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invNum}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: false });
        doc.on('error', next);
        doc.pipe(res);
        drawSingleInvoicePDF(doc, invoice, distributor);
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
