import express from 'express';
import { createSupplier, getSuppliers, getSupplier, getSupplierLedger, updateSupplier, deleteSupplier } from '../controllers/supplierController';
import { protect, requirePermission } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(requirePermission('suppliers', 'create'), createSupplier)
  .get(requirePermission('suppliers', 'view'), getSuppliers);

router.get('/:id/ledger', requirePermission('suppliers', 'view'), getSupplierLedger);

router.route('/:id')
  .get(requirePermission('suppliers', 'view'), getSupplier)
  .put(requirePermission('suppliers', 'edit'), updateSupplier)
  .delete(requirePermission('suppliers', 'delete'), deleteSupplier);

export = router;
