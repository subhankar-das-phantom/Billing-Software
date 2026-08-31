import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier';
import Purchase from '../models/Purchase';
import getTenantId from '../utils/getTenantId';
import { getSearchPattern } from '../utils/searchUtils';

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const user = (req as any).user;
    const admin = (req as any).admin;
    const createdBy = {
      user: admin ? admin._id : user._id,
      userModel: (admin ? 'Admin' : 'Employee') as 'Admin' | 'Employee'
    };

    const supplier = await Supplier.create({
      ...req.body,
      tenantId,
      createdBy
    });

    res.status(201).json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
};

export const getSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const query: any = { tenantId, isActive: true };

    if (search) {
      const usePrefix = req.query.prefix === 'true';
      const pattern = getSearchPattern(search, usePrefix);
      query.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
        { gstin: { $regex: pattern, $options: 'i' } }
      ];
    }

    const suppliers = await Supplier.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Supplier.countDocuments(query);

    res.status(200).json({
      success: true,
      count: suppliers.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      suppliers
    });
  } catch (error) {
    next(error);
  }
};

export const getSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const supplier = await Supplier.findOne({ _id: req.params.id, tenantId });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const [purchaseCount, spendResult] = await Promise.all([
      Purchase.countDocuments({ tenantId, supplierId: supplier._id }),
      Purchase.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId.toString()), supplierId: supplier._id, status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, totalSpend: { $sum: '$totals.grandTotal' } } }
      ])
    ]);

    const totalPurchases = spendResult[0]?.totalSpend || 0;
    const openingBalance = supplier.openingBalance || 0;
    const balance = openingBalance + totalPurchases;

    res.status(200).json({
      success: true,
      supplier,
      summary: {
        purchaseCount,
        totalPurchases,
        openingBalance,
        balance
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    let supplier = await Supplier.findOne({ _id: req.params.id, tenantId });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const supplier = await Supplier.findOne({ _id: req.params.id, tenantId });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Soft delete
    supplier.isActive = false;
    await supplier.save();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const getSupplierLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const supplierId = String(req.params.id);
    const { startDate, endDate, sortOrder = 'asc' } = req.query;

    const supplierObjectId = new mongoose.Types.ObjectId(supplierId);
    const tenantObjectId = new mongoose.Types.ObjectId(String(tenantId));

    const supplier = await Supplier.findOne({ _id: supplierObjectId, tenantId: tenantObjectId }).lean();
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const start = startDate ? new Date(startDate as string) : null;
    const end = endDate ? new Date(endDate as string) : new Date();
    if (endDate) {
      end.setHours(23, 59, 59, 999);
    }

    // 1. Calculate opening balance: supplier.openingBalance + all completed purchases before start date
    let openingBalance = supplier.openingBalance || 0;
    if (start) {
      const priorPurchases = await Purchase.aggregate([
        {
          $match: {
            tenantId: tenantObjectId,
            supplierId: supplierObjectId,
            purchaseDate: { $lt: start },
            status: { $ne: 'CANCELLED' }
          }
        },
        {
          $group: {
            _id: null,
            totalPrior: { $sum: '$totals.grandTotal' }
          }
        }
      ]);
      const priorPurchasesTotal = priorPurchases[0]?.totalPrior || 0;
      openingBalance += priorPurchasesTotal;
    }

    // 2. Fetch purchases in range
    const dateMatch: any = {};
    if (start) {
      dateMatch.$gte = start;
    }
    dateMatch.$lte = end;

    const purchases = await Purchase.find({
      tenantId: tenantObjectId,
      supplierId: supplierObjectId,
      status: { $ne: 'CANCELLED' },
      purchaseDate: dateMatch
    })
      .populate('items.productId', 'name productCode')
      .sort({ purchaseDate: 1, createdAt: 1 })
      .lean();

    // 3. Build chronological ledger entries
    const ledgerEntries: any[] = [];
    let runningBalance = openingBalance;

    for (const p of purchases) {
      const amount = p.totals?.grandTotal || 0;
      runningBalance += amount;
      
      const itemNames = (p.items || [])
        .map((it: any) => {
          const name = it.productId?.name || 'Item';
          return `${name} (x${it.quantity})`;
        })
        .slice(0, 3)
        .join(', ');
      
      const extraItems = (p.items || []).length > 3 ? ` +${(p.items || []).length - 3} more` : '';
      const description = (p.notes ? `${p.notes} - ` : '') + (itemNames ? `${itemNames}${extraItems}` : `${p.items?.length || 0} items`);

      ledgerEntries.push({
        date: p.purchaseDate,
        type: 'Purchase',
        ref: p.purchaseNumber,
        supplierInvoiceNumber: p.supplierInvoiceNumber || '-',
        description,
        debit: 0,
        credit: amount,
        balance: runningBalance,
        linkId: p._id,
        linkType: 'purchase',
        itemCount: p.items?.length || 0,
        paymentType: (p as any).paymentType || 'Credit'
      });
    }

    // If descending requested
    let finalLedger = ledgerEntries;
    if (sortOrder === 'desc') {
      finalLedger = [...ledgerEntries].reverse();
    }

    const totalDebit = 0;
    const totalCredit = purchases.reduce((sum, p) => sum + (p.totals?.grandTotal || 0), 0);
    const closingBalance = runningBalance;

    res.status(200).json({
      success: true,
      supplier,
      ledger: finalLedger,
      summary: {
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        totalPurchasesCount: purchases.length
      },
      totalCount: finalLedger.length
    });
  } catch (error) {
    next(error);
  }
};
