/**
 * Recalculate Customer Balances Script
 * 
 * Audits and reconciles customer `outstandingBalance` and `totalPurchases`
 * against the immutable ground truth of active invoices, credit notes, and manual entries.
 * 
 * Usage:
 *   node scripts/recalculateCustomerBalances.js --dry-run
 *   node scripts/recalculateCustomerBalances.js --fix
 *   node scripts/recalculateCustomerBalances.js --customerId=<id> --dry-run
 *   node scripts/recalculateCustomerBalances.js --customerId=<id> --fix
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const ManualEntry = require('../models/ManualEntry');
const CreditNote = require('../models/CreditNote');

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

async function reconcile() {
  const args = process.argv.slice(2);
  const isFixMode = args.includes('--fix');
  const customerIdArg = args.find(a => a.startsWith('--customerId='))?.split('=')[1];

  console.log('='.repeat(70));
  console.log(` Customer Balance Reconciliation Engine [${isFixMode ? 'LIVE FIX' : 'DRY RUN'}]`);
  console.log('='.repeat(70));

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    const filter = {};
    if (customerIdArg) {
      filter._id = new mongoose.Types.ObjectId(customerIdArg);
      console.log(`🎯 Targeting single customer: ${customerIdArg}`);
    }

    const customers = await Customer.find(filter).lean();
    console.log(`📋 Auditing ${customers.length} customer(s)...\n`);

    let driftCount = 0;
    let fixedCount = 0;

    for (const customer of customers) {
      const tenantId = customer.tenantId;
      const cId = customer._id;

      // 1. Unpaid invoice balances
      const invoiceAgg = await Invoice.aggregate([
        { 
          $match: { 
            tenantId, 
            'customer._id': cId, 
            status: { $ne: 'Cancelled' },
            paymentType: 'Credit'
          } 
        },
        { 
          $project: { 
            remaining: { $subtract: ['$totals.netTotal', { $ifNull: ['$paidAmount', 0] }] } 
          } 
        },
        { $match: { remaining: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$remaining' } } }
      ]);

      // 2. Unpaid manual opening balances
      const manualAgg = await ManualEntry.aggregate([
        { 
          $match: { 
            tenantId, 
            customer: cId, 
            entryType: 'opening_balance', 
            paymentType: 'Credit' 
          } 
        },
        { 
          $project: { 
            remaining: { $subtract: ['$amount', { $ifNull: ['$paidAmount', 0] }] } 
          } 
        },
        { $match: { remaining: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$remaining' } } }
      ]);

      // 3. Credit note total
      const creditNoteAgg = await CreditNote.aggregate([
        { $match: { tenantId, 'customer._id': cId } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]);

      const liveInvoiceDue = round2(invoiceAgg[0]?.total || 0);
      const liveManualDue = round2(manualAgg[0]?.total || 0);
      const liveCreditTotal = round2(creditNoteAgg[0]?.total || 0);

      const expectedOutstanding = round2(Math.max(0, liveInvoiceDue + liveManualDue - liveCreditTotal));
      const currentOutstanding = round2(customer.outstandingBalance || 0);

      const diff = round2(expectedOutstanding - currentOutstanding);

      if (Math.abs(diff) > 0.01) {
        driftCount++;
        console.log(`⚠️  DRIFT DETECTED: [${customer.customerName}] (${cId})`);
        console.log(`   Phone: ${customer.phone || 'N/A'}`);
        console.log(`   Stored Outstanding:   ₹${currentOutstanding.toFixed(2)}`);
        console.log(`   Expected Outstanding: ₹${expectedOutstanding.toFixed(2)} (Invoices: ₹${liveInvoiceDue.toFixed(2)}, Manual: ₹${liveManualDue.toFixed(2)}, CreditNotes: -₹${liveCreditTotal.toFixed(2)})`);
        console.log(`   Discrepancy (Δ):      ${diff > 0 ? '+' : ''}₹${diff.toFixed(2)}`);

        if (isFixMode) {
          await Customer.updateOne(
            { _id: cId, tenantId },
            { $set: { outstandingBalance: expectedOutstanding } }
          );
          fixedCount++;
          console.log(`   ✅ Successfully updated stored outstandingBalance to ₹${expectedOutstanding.toFixed(2)}`);
        }
        console.log('');
      }
    }

    console.log('-'.repeat(70));
    console.log(`Audit Summary:`);
    console.log(`  Total Customers Audited: ${customers.length}`);
    console.log(`  Customers with Drift:    ${driftCount}`);
    if (isFixMode) {
      console.log(`  Customers Reconciled:    ${fixedCount}`);
    } else {
      console.log(`  Mode: DRY RUN (No changes made. Re-run with --fix to apply changes.)`);
    }
    console.log('-'.repeat(70));

  } catch (error) {
    console.error('❌ Error during reconciliation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

reconcile();
