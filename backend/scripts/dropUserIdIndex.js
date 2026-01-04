/**
 * One-time migration script to drop the stale 'userId' index from employees collection.
 * Run this script once: node scripts/dropUserIdIndex.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function dropUserIdIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully.');

    const db = mongoose.connection.db;
    const collection = db.collection('employees');

    // List current indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Check if userId index exists and drop it
    const userIdIndex = indexes.find(i => i.key && i.key.userId !== undefined);
    
    if (userIdIndex) {
      console.log(`Dropping index: ${userIdIndex.name}...`);
      await collection.dropIndex(userIdIndex.name);
      console.log('✓ userId index dropped successfully!');
    } else {
      console.log('No userId index found. Nothing to drop.');
    }

    // Show updated indexes
    const updatedIndexes = await collection.indexes();
    console.log('Updated indexes:', updatedIndexes.map(i => i.name));

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

dropUserIdIndex();
