/**
 * Migration Script: Create Batch records from existing Product data
 * 
 * SAFETY:
 * - This script is ADDITIVE ONLY — it creates Batch documents but does NOT modify Products
 * - It checks for existing batches to avoid duplicates (safe to run multiple times)
 * - It runs outside a transaction so partial progress is preserved if interrupted
 * 
 * Usage: node scripts/migrateBatches.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Product = require('../models/Product');
const Batch = require('../models/Batch');

async function migrate() {
  try {
    await connectDB();
    console.log('Connected to database');

    const products = await Product.find({ isActive: true });
    console.log(`Found ${products.length} active products to migrate`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Check if a batch already exists for this product with the same batchNo
        const existingBatch = await Batch.findOne({
          productId: product._id,
          batchNo: product.batchNo
        });

        if (existingBatch) {
          console.log(`  SKIP: ${product.productName} (batch ${product.batchNo} already exists)`);
          skipped++;
          continue;
        }

        // Only create a batch if the product has batch info
        if (!product.batchNo) {
          console.log(`  SKIP: ${product.productName} (no batch number)`);
          skipped++;
          continue;
        }

        await Batch.create({
          productId: product._id,
          batchNo: product.batchNo,
          expiryDate: product.expiryDate,
          purchaseRate: product.rate || 0,
          mrp: product.newMRP || 0,
          gstPercent: product.gstPercentage || 12,
          stock: product.currentStockQty || 0,
          createdBy: product.createdBy
        });

        console.log(`  OK: ${product.productName} → Batch ${product.batchNo} (stock: ${product.currentStockQty})`);
        created++;
      } catch (err) {
        console.error(`  ERROR: ${product.productName} → ${err.message}`);
        errors++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('\nNOTE: Product documents were NOT modified. Existing code continues to work.');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
