require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const connectDB = require('../config/database');

const seedAdmin = async () => {
  try {
    await connectDB();

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL || 'admin@bharat.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin
    const admin = await Admin.create({
      email: process.env.ADMIN_EMAIL || 'admin@bharat.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      firmName: process.env.FIRM_NAME || 'Bharat Enterprise',
      firmAddress: '',
      firmPhone: '',
      firmGSTIN: ''
    });

    console.log('Admin user created successfully!');
    console.log('Email:', admin.email);
    console.log('Password: admin123 (change this immediately!)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
