require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');

console.log('--- DIAGNOSTIC START ---');

// 1. Check Env Vars
console.log('Checking Environment Variables...');
const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  console.error('❌ MISSING ENV VARS:', missingVars.join(', '));
} else {
  console.log('✅ Env vars present.');
  console.log('JWT_SECRET length:', process.env.JWT_SECRET.length);
}

// 2. Connect to DB
console.log('\nConnecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // 3. Check Admin User
    console.log('\nChecking Admin User...');
    const email = 'admin@bharat.com';
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin) {
      console.error('❌ Admin user not found!');
    } else {
      console.log('✅ Admin user found:', admin.email);
      
      // 4. Test Password Match
      console.log('\nTesting Password Match...');
      const isMatch = await admin.matchPassword('admin123');
      console.log(`Password match result: ${isMatch}`);

      if (isMatch) {
         // 5. Test Save (Middleware check)
         console.log('\nTesting Admin Save (Middleware check)...');
         try {
           admin.lastLogin = new Date();
           await admin.save();
           console.log('✅ Admin saved successfully (Middleware passed)');
         } catch (err) {
           console.error('❌ Admin save failed:', err);
         }

         // 6. Test Token Generation
         console.log('\nTesting Token Generation...');
         try {
            const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
                expiresIn: '7d'
            });
            console.log('✅ Token generated successfully');
         } catch (err) {
             console.error('❌ Token generation failed:', err);
         }

      } else {
          console.error('❌ Password does not match!');
      }
    }

    console.log('\n--- DIAGNOSTIC END ---');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Failed:', err);
    process.exit(1);
  });
