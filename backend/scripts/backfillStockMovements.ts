/**
 * Safe, Idempotent Backfill Script: Reconcile Historical Invoice Sales in StockMovement
 * 
 * PURPOSE:
 * For tenants where batch tracking was disabled (default), invoices previously created
 * deducted stock from Product.currentStockQty and wrote to Product.stockHistory, but
 * did not write to the StockMovement audit ledger collection.
 * 
 * SAFETY:
 * - ADDITIVE ONLY: Creates missing StockMovement records.
 * - NEVER modifies Product.currentStockQty (stock was already deducted at invoice creation).
 * - IDEMPOTENT: Checks whether a movement already exists for each invoice item before inserting.
 * - Supports --dry-run flag to inspect what would be inserted without writing.
 * 
 * Usage:
 *   npx tsx scripts/backfillStockMovements.ts           # Live run
 *   npx tsx scripts/backfillStockMovements.ts --dry-run # Dry run audit
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
const connectDB = require('../config/database');
const Invoice = require('../models/Invoice');
const CreditNote = require('../models/CreditNote');
import StockMovement from '../models/StockMovement';

async function runBackfill() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(70));
  console.log(`Inventory Ledger Sales & Returns Reconciliation Script ${isDryRun ? '[DRY RUN]' : '[LIVE]'}`);
  console.log('='.repeat(70));

  try {
    await connectDB();
    console.log('Connected to MongoDB database.');

    // -------------------------------------------------------------------------
    // Phase 1: Invoices (Sales Outflow) Reconciliation
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 1: Checking Historical Invoices (Sales Out) ---');
    const activeInvoices = await Invoice.find({
      status: { $ne: 'Cancelled' }
    }).sort({ invoiceDate: 1, createdAt: 1 }).lean();

    console.log(`Found ${activeInvoices.length} active invoices across all tenants.`);

    // Batch fetch existing Invoice movements for O(1) in-memory lookup (Zero N+1)
    console.log('Loading existing invoice stock movements for fast index check...');
    const existingMovements = await StockMovement.find({ referenceType: 'Invoice' })
      .select('referenceId productId')
      .lean();

    const existingSet = new Set<string>();
    for (const em of existingMovements) {
      if (em.referenceId && em.productId) {
        existingSet.add(`${String(em.referenceId)}_${String(em.productId)}`);
      }
    }
    console.log(`Loaded ${existingSet.size} pre-existing movement checkpoints.`);

    let totalItemsChecked = 0;
    let movementsCreated = 0;
    let movementsSkipped = 0;
    let errorsCount = 0;

    const BATCH_SIZE = 200;
    let pendingBatch: any[] = [];

    for (const inv of activeInvoices) {
      const items = inv.items || [];
      for (const item of items) {
        totalItemsChecked++;
        const totalQty = (item.quantitySold || 0) + (item.freeQuantity || 0);
        if (totalQty <= 0) continue;

        const prodId = item.product?._id || item.product;
        if (!prodId) {
          console.warn(`  [WARN] Invoice ${inv.invoiceNumber} item missing productId. Skipping.`);
          errorsCount++;
          continue;
        }

        const lookupKey = `${String(inv._id)}_${String(prodId)}`;
        if (existingSet.has(lookupKey)) {
          movementsSkipped++;
          continue;
        }

        const rate = item.ratePerUnit || 0;
        const totalValue = rate * totalQty;
        const movementDoc = {
          tenantId: inv.tenantId,
          productId: prodId,
          batchId: item.batchId || null,
          type: 'SALE' as const,
          quantity: totalQty,
          rate,
          totalValue,
          referenceType: 'Invoice',
          referenceId: String(inv._id),
          createdBy: inv.createdBy || { userModel: 'Admin' },
          createdAt: inv.createdAt || inv.invoiceDate || new Date()
        };

        pendingBatch.push(movementDoc);
        existingSet.add(lookupKey); // Prevent duplicate lines in same invoice from colliding

        if (pendingBatch.length >= BATCH_SIZE) {
          if (!isDryRun) {
            await StockMovement.insertMany(pendingBatch, { ordered: false });
          }
          movementsCreated += pendingBatch.length;
          console.log(`  Processed ${movementsCreated} invoice movements...`);
          pendingBatch = [];
        }
      }
    }

    // Flush remaining invoice batch
    if (pendingBatch.length > 0) {
      if (!isDryRun) {
        await StockMovement.insertMany(pendingBatch, { ordered: false });
      }
      movementsCreated += pendingBatch.length;
      console.log(`  Processed ${movementsCreated} invoice movements...`);
      pendingBatch = [];
    }

    // -------------------------------------------------------------------------
    // Phase 2: Credit Notes (Sales Returns Inflow) Reconciliation
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 2: Checking Historical Credit Notes (Sales Returns) ---');
    const creditNotes = await CreditNote.find({}).sort({ createdAt: 1 }).lean();
    console.log(`Found ${creditNotes.length} credit notes across all tenants.`);

    console.log('Loading existing credit note stock movements...');
    const existingCNMovements = await StockMovement.find({
      $or: [
        { referenceType: 'CreditNote' },
        { type: 'SALE_RETURN' }
      ]
    }).select('referenceId productId').lean();

    const existingCNSet = new Set<string>();
    for (const em of existingCNMovements) {
      if (em.referenceId && em.productId) {
        existingCNSet.add(`${String(em.referenceId)}_${String(em.productId)}`);
      }
    }
    console.log(`Loaded ${existingCNSet.size} pre-existing credit note movement checkpoints.`);

    let cnItemsChecked = 0;
    let cnMovementsCreated = 0;
    let cnMovementsSkipped = 0;

    for (const cn of creditNotes) {
      const items = cn.items || [];
      for (const item of items) {
        cnItemsChecked++;
        const qty = item.quantityReturned || 0;
        if (qty <= 0) continue;

        const prodId = item.productId?._id || item.productId;
        if (!prodId) {
          console.warn(`  [WARN] CreditNote ${cn.creditNoteNumber} item missing productId. Skipping.`);
          errorsCount++;
          continue;
        }

        const lookupKey = `${String(cn.creditNoteNumber)}_${String(prodId)}`;
        if (existingCNSet.has(lookupKey)) {
          cnMovementsSkipped++;
          continue;
        }

        const rate = item.rate || 0;
        const totalValue = rate * qty;
        const movementDoc = {
          tenantId: cn.tenantId,
          productId: prodId,
          batchId: item.batchId || null,
          type: 'SALE_RETURN' as const,
          quantity: qty,
          rate,
          totalValue,
          referenceType: 'CreditNote',
          referenceId: cn.creditNoteNumber,
          createdBy: cn.createdBy || { userModel: 'Admin' },
          createdAt: cn.createdAt || new Date()
        };

        pendingBatch.push(movementDoc);
        existingCNSet.add(lookupKey);

        if (pendingBatch.length >= BATCH_SIZE) {
          if (!isDryRun) {
            await StockMovement.insertMany(pendingBatch, { ordered: false });
          }
          cnMovementsCreated += pendingBatch.length;
          console.log(`  Processed ${cnMovementsCreated} credit note movements...`);
          pendingBatch = [];
        }
      }
    }

    // Flush remaining credit note batch
    if (pendingBatch.length > 0) {
      if (!isDryRun) {
        await StockMovement.insertMany(pendingBatch, { ordered: false });
      }
      cnMovementsCreated += pendingBatch.length;
      console.log(`  Processed ${cnMovementsCreated} credit note movements...`);
      pendingBatch = [];
    }

    console.log('\n' + '='.repeat(70));
    console.log('RECONCILIATION SUMMARY:');
    console.log(`- Invoices Checked:         ${activeInvoices.length}`);
    console.log(`- Invoice Items Scanned:    ${totalItemsChecked}`);
    console.log(`- Sales Movements Created:  ${movementsCreated} ${isDryRun ? '(simulated)' : ''}`);
    console.log(`- Sales Movements Skipped:  ${movementsSkipped} (already had audit records)`);
    console.log(`- Credit Notes Checked:     ${creditNotes.length}`);
    console.log(`- CN Items Scanned:         ${cnItemsChecked}`);
    console.log(`- Return Movements Created: ${cnMovementsCreated} ${isDryRun ? '(simulated)' : ''}`);
    console.log(`- Return Movements Skipped: ${cnMovementsSkipped} (already had audit records)`);
    console.log(`- Errors / Warnings:        ${errorsCount}`);
    console.log('='.repeat(70));

  } catch (fatalErr) {
    console.error('Fatal reconciliation error:', fatalErr);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

runBackfill();
