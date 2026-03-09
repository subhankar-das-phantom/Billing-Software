require('dotenv').config();
const mongoose = require('mongoose');
const fifoService = require('../services/fifoService');
const stockService = require('../services/stockService');
const Batch = require('../models/Batch');
const Product = require('../models/Product');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    try {
        // Create a dummy product
        const product = await Product.create({
            productName: 'Test Product FIFO',
            hsnCode: '1234',
            rate: 100,
            newMRP: 120,
            gstPercentage: 12,
            currentStockQty: 0
        });

        // Create batches for this product
        // Batch 1: Expiry date soonest
        const b1 = await Batch.create({
            productId: product._id,
            batchNo: 'B1',
            expiryDate: new Date('2024-01-01'),
            stock: 10,
            rate: 90,
            mrp: 120,
            gstPercent: 12
        });
        
        // Batch 2: null expiry date
        const b2 = await Batch.create({
            productId: product._id,
            batchNo: 'B2',
            expiryDate: null,
            stock: 15,
            rate: 90,
            mrp: 120,
            gstPercent: 12
        });

        // Batch 3: Expiry date later
        const b3 = await Batch.create({
            productId: product._id,
            batchNo: 'B3',
            expiryDate: new Date('2025-01-01'),
            stock: 5,
            rate: 90,
            mrp: 120,
            gstPercent: 12
        });

        product.currentStockQty = 30;
        await product.save();

        console.log('Testing AUTO FIFO Allocation');
        // Require 12 items. Should take 10 from B1, 2 from B3 (next earliest expiry), wait, what if B2 is null?
        // Let's see how our sorting works:
        const allocations = await fifoService.calculateAllocations(product._id, 12, 'AUTO');
        console.log('AUTO FIFO Allocations:');
        allocations.forEach(a => {
            console.log(`- Batch: ${a.batchNo}, Qty: ${a.allocatedQty}, Exp: ${a.expiryDate}`);
        });

        // Test manual allocation validation
        console.log('\nTesting MANUAL Allocation');
        try {
            await fifoService.calculateAllocations(product._id, 12, 'MANUAL', [
                { batchId: b3._id, quantity: 10 } // Insufficient stock in B3 (only 5 available)
            ]);
            console.log('Unexpected: Manual allocation should have failed validation');
        } catch(e) {
            console.log('Expected Error:', e.message);
        }

        try {
            const manualAlloc = await fifoService.calculateAllocations(product._id, 12, 'MANUAL', [
                { batchId: b2._id, quantity: 8 },
                { batchId: b3._id, quantity: 4 }
            ]);
            console.log('Successful MANUAL Allocation:', manualAlloc.map(a => `${a.batchNo}: ${a.allocatedQty}`).join(', '));
        } catch(e) {
            console.log('Unexpected Error:', e.message);
        }

        // Cleanup
        await Product.findByIdAndDelete(product._id);
        await Batch.deleteMany({ productId: product._id });
        console.log('Test cleanup complete.');
    } catch(e) {
        console.error('Test failed:', e);
    }

    mongoose.disconnect();
}

test();
