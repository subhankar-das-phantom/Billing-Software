require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Batch = require('../models/Batch');

async function fixStock() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const products = await Product.find({});
  let fixed = 0;
  
  for (const product of products) {
    const batches = await Batch.find({ productId: product._id, isActive: true });
    const totalBatchStock = batches.reduce((sum, b) => sum + b.stock, 0);
    
    if (product.currentStockQty !== totalBatchStock) {
      console.log(`Fixing ${product.productName}: ${product.currentStockQty} -> ${totalBatchStock}`);
      product.currentStockQty = totalBatchStock;
      await product.save({ validateBeforeSave: false });
      fixed++;
    }
  }
  
  console.log(`Fixed ${fixed} products.`);
  mongoose.disconnect();
}
fixStock();
