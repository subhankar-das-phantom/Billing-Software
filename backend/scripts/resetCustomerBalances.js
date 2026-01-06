/**
 * Reset Customer Balances Script
 * Run this after deleting stale collections (invoices, payments, manualentries)
 * to reset all customer outstandingBalance and totalPurchases to 0
 * 
 * Usage: node scripts/resetCustomerBalances.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const resetBalances = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get count of customers
    const count = await Customer.countDocuments();
    console.log(`📊 Found ${count} customers`);

    // Reset all customer balances
    const result = await Customer.updateMany(
      {}, // Match all customers
      {
        $set: {
          outstandingBalance: 0,
          totalPurchases: 0,
          invoiceCount: 0,
          lastInvoiceDate: null
        }
      }
    );

    console.log(`✅ Reset ${result.modifiedCount} customers`);
    console.log('');
    console.log('All customer balances have been reset to 0!');
    console.log('You can now start fresh with new invoices and payments.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

resetBalances();
