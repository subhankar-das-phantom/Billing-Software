import express from 'express';
import { createSupplier, getSuppliers, getSupplier, getSupplierLedger, updateSupplier, deleteSupplier } from '../controllers/supplierController';
import { protect, requirePermission } from '../middleware/auth';

const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

const router = express.Router();

router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.SUPPLIERS));

router.route('/')
  .post(checkWriteAccess, requirePermission('suppliers', 'create'), createSupplier)
  .get(requirePermission('suppliers', 'view'), getSuppliers);

router.get('/:id/ledger', requirePermission('suppliers', 'view'), getSupplierLedger);

router.route('/:id')
  .get(requirePermission('suppliers', 'view'), getSupplier)
  .put(checkWriteAccess, requirePermission('suppliers', 'edit'), updateSupplier)
  .delete(checkWriteAccess, requirePermission('suppliers', 'delete'), deleteSupplier);

export = router;
