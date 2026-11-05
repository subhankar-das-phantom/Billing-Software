/**
 * Bharat Enterprise Billing System — Platform Owner Bootstrap CLI
 * Securely provisions the root PLATFORM_OWNER account upon initial deployment.
 *
 * Usage:
 *   npx tsx admin/backend/scripts/bootstrapPlatformOwner.ts
 */

import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import PlatformUser from '../models/PlatformUser';
import { PlatformRole } from '../types';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return 'mongodb://localhost:27017/billing_dev';
  }
  return uri;
}

export async function bootstrapPlatformOwner(): Promise<void> {
  const mongoUri = getMongoUri();
  console.log(`[BOOTSTRAP] Connecting to MongoDB...`);

  await mongoose.connect(mongoUri);

  try {
    const hasExplicitPassword = Boolean(
      process.env.PLATFORM_BOOTSTRAP_PASSWORD &&
      process.env.PLATFORM_BOOTSTRAP_PASSWORD.trim().length > 0
    );

    const isForce =
      process.argv.includes('--force') ||
      process.argv.includes('--reset') ||
      process.argv.includes('--reset-password') ||
      process.env.PLATFORM_BOOTSTRAP_FORCE === 'true' ||
      process.env.npm_config_force === 'true' ||
      hasExplicitPassword;

    // 1. Check for existing PLATFORM_OWNER
    const existingOwner = await PlatformUser.findOne({ role: PlatformRole.PLATFORM_OWNER });

    const email = (process.env.PLATFORM_BOOTSTRAP_EMAIL || (existingOwner ? existingOwner.email : 'owner@bharatplatform.com')).toLowerCase().trim();
    const fullName = (process.env.PLATFORM_BOOTSTRAP_NAME || (existingOwner ? existingOwner.fullName : 'Platform Owner')).trim();
    const rawPassword =
      hasExplicitPassword
        ? process.env.PLATFORM_BOOTSTRAP_PASSWORD!.trim()
        : crypto.randomBytes(18).toString('base64url'); // 18 bytes base64url = 24 chars

    if (existingOwner && !isForce) {
      console.log(`[BOOTSTRAP] Platform Owner account already exists in the system (${existingOwner.email}).`);
      console.log(`[BOOTSTRAP] To set a new password, configure PLATFORM_BOOTSTRAP_PASSWORD in backend/.env and re-run:`);
      console.log(`[BOOTSTRAP]   npm run bootstrap:owner\n`);
      await mongoose.disconnect();
      return;
    }

    if (existingOwner && isForce) {
      existingOwner.password = rawPassword;
      existingOwner.failedLoginAttempts = 0;
      existingOwner.lockUntil = null;
      existingOwner.isActive = true;
      existingOwner.mustChangePassword = false;
      await existingOwner.save();

      console.log(`\n================================================================================`);
      console.log(`🚀 BHARAT ENTERPRISE PLATFORM CONTROL PLANE — OWNER CREDENTIALS RESET`);
      console.log(`================================================================================`);
      console.log(`Platform Owner credentials updated successfully:`);
      console.log(``);
      console.log(`  • ID:                  ${existingOwner._id}`);
      console.log(`  • Full Name:           ${existingOwner.fullName}`);
      console.log(`  • Email:               ${existingOwner.email}`);
      console.log(`  • Password:            ${rawPassword}`);
      console.log(`  • Role:                ${existingOwner.role}`);
      console.log(`  • Must Change Password: false`);
      console.log(`\nReady to login at http://localhost:5174/login`);
      console.log(`================================================================================\n`);
      await mongoose.disconnect();
      return;
    }

    // 2. Create the root PLATFORM_OWNER with mustChangePassword = true
    const owner = await PlatformUser.create({
      email,
      password: rawPassword,
      fullName,
      role: PlatformRole.PLATFORM_OWNER,
      customPermissions: [],
      isActive: true,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      mfaEnabled: false,
    });

    // 4. Output credentials box once to stdout
    console.log(`\n================================================================================`);
    console.log(`🚀 BHARAT ENTERPRISE PLATFORM CONTROL PLANE — INITIAL OWNER BOOTSTRAP`);
    console.log(`================================================================================`);
    console.log(`Platform Owner account successfully provisioned:`);
    console.log(``);
    console.log(`  • ID:                  ${owner._id}`);
    console.log(`  • Full Name:           ${owner.fullName}`);
    console.log(`  • Email:               ${owner.email}`);
    console.log(`  • Password:            ${rawPassword}`);
    console.log(`  • Role:                ${owner.role}`);
    console.log(`  • Must Change Password: true`);
    console.log(``);
    console.log(`⚠️  CRITICAL SECURITY NOTICE:`);
    console.log(`1. Store these credentials securely. The plaintext password will NEVER be shown again.`);
    console.log(`2. Log into the Control Plane and change this temporary password immediately.`);
    console.log(`3. MFA enrollment is mandatory for PLATFORM_OWNER before administrative operations.`);
    console.log(`================================================================================\n`);
  } finally {
    await mongoose.disconnect();
  }
}

// Execute immediately when run as a standalone CLI script
if (require.main === module) {
  bootstrapPlatformOwner()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[BOOTSTRAP FATAL ERROR]:`, err);
      process.exit(1);
    });
}
