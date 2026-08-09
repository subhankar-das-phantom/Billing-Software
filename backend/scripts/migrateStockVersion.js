require('dotenv').config();
const mongoose = require('mongoose');

async function migrateStockVersion() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const Product = mongoose.connection.collection('products');

    // Set stockVersion to 0 for all products that don't have it
    const result = await Product.updateMany(
      { stockVersion: { $exists: false } },
      { $set: { stockVersion: 0 } }
    );

    console.log(`Migration complete: ${result.modifiedCount} products updated with stockVersion: 0`);

    // Verify
    const withoutVersion = await Product.countDocuments({ stockVersion: { $exists: false } });
    console.log(`Products still missing stockVersion: ${withoutVersion}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrateStockVersion();
