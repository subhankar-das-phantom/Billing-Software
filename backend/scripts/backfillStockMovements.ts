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
import StockMovement from '../models/StockMovement';

async function runBackfill() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(70));
  console.log(`Inventory Ledger Sales Reconciliation Script ${isDryRun ? '[DRY RUN]' : '[LIVE]'}`);
  console.log('='.repeat(70));

  try {
    await connectDB();
    console.log('Connected to MongoDB database.');

    const activeInvoices = await Invoice.find({
      status: { $ne: 'Cancelled' }
    }).sort({ invoiceDate: 1, createdAt: 1 }).lean();

    console.log(`Found ${activeInvoices.length} active invoices across all tenants.`);

    let totalItemsChecked = 0;
    let movementsCreated = 0;
    let movementsSkipped = 0;
    let errorsCount = 0;

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

        try {
          // Check if StockMovement already exists for this invoice line
          const existing = await StockMovement.findOne({
            tenantId: inv.tenantId,
            referenceType: 'Invoice',
            referenceId: String(inv._id),
            productId: prodId
          }).lean();

          if (existing) {
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

          if (isDryRun) {
            console.log(`  [DRY RUN] Would create SALE movement: Invoice ${inv.invoiceNumber} -> Product ${prodId} (Qty: ${totalQty}, Val: ₹${totalValue})`);
          } else {
            await StockMovement.create(movementDoc);
            console.log(`  [OK] Created SALE movement: Invoice ${inv.invoiceNumber} -> Product ${prodId} (Qty: ${totalQty})`);
          }

          movementsCreated++;
        } catch (err: any) {
          console.error(`  [ERROR] Failed to reconcile item for invoice ${inv.invoiceNumber}: ${err.message}`);
          errorsCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('RECONCILIATION SUMMARY:');
    console.log(`- Invoices Checked:     ${activeInvoices.length}`);
    console.log(`- Total Items Scanned:  ${totalItemsChecked}`);
    console.log(`- Movements Created:    ${movementsCreated} ${isDryRun ? '(simulated)' : ''}`);
    console.log(`- Movements Skipped:    ${movementsSkipped} (already had audit records)`);
    console.log(`- Errors / Warnings:    ${errorsCount}`);
    console.log('='.repeat(70));

  } catch (fatalErr) {
    console.error('Fatal reconciliation error:', fatalErr);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

runBackfill();
