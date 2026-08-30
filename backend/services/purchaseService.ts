import mongoose, { ClientSession } from 'mongoose';
import Purchase, { IPurchase } from '../models/Purchase';

export const purchaseService = {
  /**
   * Creates a DRAFT purchase.
   * Phase 3 Boundary: Does NOT affect inventory or Batch.
   */
  async createDraftPurchase(
    tenantId: string,
    purchaseData: Partial<IPurchase>,
    session: ClientSession
  ): Promise<IPurchase> {
    // Generate purchase number
    const lastPurchase = await Purchase.findOne({ tenantId })
      .sort({ createdAt: -1 })
      .select('purchaseNumber')
      .session(session);

    let purchaseNumber: string;
    if (lastPurchase) {
      const lastNum = parseInt(String(lastPurchase.purchaseNumber || '').split('-').pop() || '0', 10);
      const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
      purchaseNumber = `PUR-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;
    } else {
      purchaseNumber = `PUR-${new Date().getFullYear()}-0001`;
    }

    const purchase = new Purchase({
      ...purchaseData,
      tenantId,
      purchaseNumber,
      status: 'DRAFT', // Always force to DRAFT in Phase 3
    });

    await purchase.save({ session });
    return purchase;
  },

  async getPurchases(
    tenantId: string,
    filters: any,
    page: number = 1,
    limit: number = 10
  ): Promise<{ purchases: IPurchase[]; total: number; pages: number }> {
    const query = { tenantId, ...filters };
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      Purchase.find(query)
        .populate('supplierId', 'name gstin')
        .sort({ purchaseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Purchase.countDocuments(query),
    ]);

    return {
      purchases: purchases as unknown as IPurchase[],
      total,
      pages: Math.ceil(total / limit),
    };
  },

  async getPurchaseById(tenantId: string, purchaseId: string): Promise<IPurchase | null> {
    return Purchase.findOne({ _id: purchaseId, tenantId })
      .populate('supplierId', 'name gstin address phone email state')
      .populate('items.productId', 'productName hsnCode pack')
      .lean() as unknown as IPurchase | null;
  },

  async updateDraftPurchase(
    tenantId: string,
    purchaseId: string,
    updateData: Partial<IPurchase>,
    session: ClientSession
  ): Promise<IPurchase | null> {
    const purchase = await Purchase.findOne({ _id: purchaseId, tenantId }).session(session);
    if (!purchase) {
      throw new Error('Purchase not found');
    }
    if (purchase.status !== 'DRAFT') {
      throw new Error('Only DRAFT purchases can be updated');
    }

    // Force status to remain DRAFT in this phase
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.status; 
    delete safeUpdateData.purchaseNumber;

    Object.assign(purchase, safeUpdateData);
    await purchase.save({ session });
    return purchase;
  },

  async deleteDraftPurchase(
    tenantId: string,
    purchaseId: string,
    session: ClientSession
  ): Promise<boolean> {
    const purchase = await Purchase.findOne({ _id: purchaseId, tenantId }).session(session);
    if (!purchase) {
      throw new Error('Purchase not found');
    }
    if (purchase.status !== 'DRAFT') {
      throw new Error('Only DRAFT purchases can be deleted. Completed purchases must be cancelled.');
    }
    
    await Purchase.deleteOne({ _id: purchaseId, tenantId }).session(session);
    return true;
  }
};
