import { Request, Response, NextFunction } from 'express';
import Supplier from '../models/Supplier';
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

    res.status(200).json({ success: true, supplier });
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
