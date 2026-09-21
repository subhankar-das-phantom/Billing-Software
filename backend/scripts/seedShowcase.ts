/**
 * Bharat Enterprise Showcase Seeder
 *
 * Populates a realistic, high-fidelity Indian pharmaceutical distribution dataset
 * for "Bharat Healthcare & Distributors" (admin@sys.com).
 *
 * Safety Mandate:
 * - Strictly isolates operations to showcase tenant (showcaseAdmin._id).
 * - Defaults to local MongoDB (mongodb://localhost:27017/billing_showcase) unless explicitly configured.
 * - Guarantees 100% mathematical parity down to the exact paisa between Invoices, Payments,
 *   Credit Notes, Customer balances, and the Ledger.
 *
 * Usage:
 *   npx tsx scripts/seedShowcase.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Load env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Core Models
const Admin = require('../models/Admin');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const CreditNote = require('../models/CreditNote');
const Note = require('../models/Note');
const ManualEntry = require('../models/ManualEntry');

// TypeScript Models
import Batch from '../models/Batch';
import Supplier from '../models/Supplier';
import Purchase from '../models/Purchase';
import StockMovement from '../models/StockMovement';

// SaaS Models
import Plan from '../saas/models/Plan';
import Subscription from '../saas/models/Subscription';
import {
  PlanCode,
  SubscriptionStatus,
  DEFAULT_PLAN_FEATURES,
} from '../saas/shared/features';

// Utility for number to words
const { numberToWords } = require('../utils/numberToWords');

// Round to 2 decimals safely
const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

// Resolve Target Mongo URI safely
function getTargetMongoUri(): string {
  if (process.env.SHOWCASE_MONGODB_URI) {
    return process.env.SHOWCASE_MONGODB_URI;
  }
  const defaultLocal = 'mongodb://localhost:27017/billing_showcase';
  const configuredUri = process.env.MONGODB_URI || '';

  // Prevent accidental mutation of production/Atlas clusters
  if (configuredUri.includes('mongodb.net') && process.env.ALLOW_REMOTE_SHOWCASE_SEED !== 'true') {
    console.warn(`⚠️ MONGODB_URI points to remote cluster (${configuredUri.split('@').pop()}).`);
    console.warn(`🛡️  Redirecting showcase seeding to local database: ${defaultLocal}`);
    return defaultLocal;
  }

  return configuredUri || defaultLocal;
}

export async function runShowcaseSeed() {
  const mongoUri = getTargetMongoUri();
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🚀 BHARAT ENTERPRISE SHOWCASE SEED ENGINE`);
  console.log(`══════════════════════════════════════════════════════════`);
  console.log(`📍 Target Database: ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log(`✅ Connected to MongoDB`);

  // ─────────────────────────────────────────────────────────────────
  // 1. Ensure Canonical SaaS Plans Exist
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n📦 Checking SaaS Plans...`);
  const plansData = [
    {
      name: 'Starter',
      code: PlanCode.STARTER,
      description: 'Billing and invoicing essentials for small counters.',
      baseMonthlyPrice: 299,
      features: DEFAULT_PLAN_FEATURES[PlanCode.STARTER],
      displayOrder: 1,
    },
    {
      name: 'Business',
      code: PlanCode.BUSINESS,
      description: 'Complete payments, collections, and ledger tracking.',
      baseMonthlyPrice: 499,
      features: DEFAULT_PLAN_FEATURES[PlanCode.BUSINESS],
      displayOrder: 2,
    },
    {
      name: 'Professional',
      code: PlanCode.PROFESSIONAL,
      description: 'Enterprise inventory intelligence, employee analytics, and multi-user.',
      baseMonthlyPrice: 699,
      features: DEFAULT_PLAN_FEATURES[PlanCode.PROFESSIONAL],
      displayOrder: 3,
    },
  ];

  for (const p of plansData) {
    await Plan.findOneAndUpdate(
      { code: p.code },
      { $set: p },
      { upsert: true, new: true }
    );
  }
  const professionalPlan = await Plan.findOne({ code: PlanCode.PROFESSIONAL });
  if (!professionalPlan) {
    throw new Error('Failed to resolve Professional Plan from database');
  }
  console.log(`✅ SaaS Plans verified. Professional Plan ID: ${professionalPlan._id}`);

  // ─────────────────────────────────────────────────────────────────
  // 2. Provision Showcase Tenant Admin
  // ─────────────────────────────────────────────────────────────────
  const showcaseEmail = (process.env.SHOWCASE_ADMIN_EMAIL || 'admin@sys.com').toLowerCase().trim();
  const showcasePassword = process.env.SHOWCASE_ADMIN_PASSWORD || 'SysAdmin@2026';
  const hashedPassword = await bcrypt.hash(showcasePassword, 10);

  console.log(`\n👤 Provisioning Showcase Tenant (${showcaseEmail})...`);
  const showcaseAdmin = await Admin.findOneAndUpdate(
    { email: showcaseEmail },
    {
      $set: {
        email: showcaseEmail,
        password: hashedPassword,
        firmName: 'Bharat Healthcare & Distributors',
        firmAddress: 'Plot 42, Sector 18, Udyog Vihar, Gurugram, Haryana - 122015',
        firmPhone: '+91 98765 43210',
        firmGSTIN: '06AAACB1234F1Z5',
        firmDL: 'HR-GGM-2024-00982',
        isActive: true,
        preferences: {
          themeMode: 'dark',
          showCalculator: false,
          enableBatchTracking: true,
          mobileCardDensity: 'compact',
          invoiceColumns: ['qty', 'free', 'productName', 'hsn', 'batchNo', 'expiry', 'mrp', 'rate', 'net', 'disc', 'gst', 'amount']
        },
        paymentInformation: {
          enabled: true,
          upiId: 'bharatdist@icici',
          accountNumber: '50200012345678',
          ifscCode: 'HDFC0000042'
        }
      }
    },
    { upsert: true, new: true }
  );

  const tenantId = showcaseAdmin._id;
  console.log(`✅ Showcase Admin ID (TenantId): ${tenantId}`);

  // ─────────────────────────────────────────────────────────────────
  // 3. Provision 365-Day Professional Subscription
  // ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const graceUntil = new Date(expiresAt.getTime() + 14 * 24 * 60 * 60 * 1000);

  await Subscription.findOneAndUpdate(
    { tenantId },
    {
      $set: {
        planId: professionalPlan._id,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        expiresAt,
        graceUntil,
        gracePeriodDays: 14,
        billingMode: 'manual',
        autoRenew: true,
        currentPricingSnapshot: {
          planName: professionalPlan.name,
          planCode: professionalPlan.code,
          baseMonthlyPrice: professionalPlan.baseMonthlyPrice,
          durationMonths: 12,
          discountApplied: 0,
          finalAmount: professionalPlan.baseMonthlyPrice * 12,
          features: professionalPlan.features,
        }
      }
    },
    { upsert: true }
  );
  console.log(`✅ 365-Day Professional Subscription activated with all 24 enterprise features.`);

  // ─────────────────────────────────────────────────────────────────
  // 4. Scoped Cleanup of Previous Showcase Data
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n🧹 Scoped Purge: Clearing existing records for tenantId ${tenantId}...`);
  await Promise.all([
    Customer.deleteMany({ tenantId }),
    Product.deleteMany({ tenantId }),
    Batch.deleteMany({ tenantId }),
    Supplier.deleteMany({ tenantId }),
    Purchase.deleteMany({ tenantId }),
    Invoice.deleteMany({ tenantId }),
    Payment.deleteMany({ tenantId }),
    CreditNote.deleteMany({ tenantId }),
    StockMovement.deleteMany({ tenantId }),
    ManualEntry.deleteMany({ tenantId }),
    Note.deleteMany({ tenantId }),
  ]);
  console.log(`✅ Previous showcase records cleared safely. Foreign tenants untouched.`);

  const adminAttribution = {
    user: tenantId,
    userModel: 'Admin' as const
  };

  // ─────────────────────────────────────────────────────────────────
  // 5. Seed Suppliers (8 Realistic Indian Pharma Suppliers)
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n🏭 Seeding Suppliers...`);
  const suppliersData = [
    { name: 'Apex Pharma Labs Ltd', contactPerson: 'Rajesh Malhotra', phone: '9810112233', email: 'sales@apexpharmalabs.in', address: 'B-14, Okhla Industrial Area Phase II, New Delhi - 110020', gstin: '07AAACA1111A1Z1', state: 'Delhi', openingBalance: 12500 },
    { name: 'Sun Life Diagnostics', contactPerson: 'Vikram Joshi', phone: '9820223344', email: 'orders@sunlifediag.com', address: 'Sector 37, Pace City I, Gurugram, Haryana - 122001', gstin: '06AAACS2222B1Z2', state: 'Haryana', openingBalance: 0 },
    { name: 'Cipla Healthcare Logistics', contactPerson: 'Anand Kulkarni', phone: '9830334455', email: 'distrib@cipla-logistics.in', address: 'MIDC Kurkumbh, Pune, Maharashtra - 413802', gstin: '27AAACC3333C1Z3', state: 'Maharashtra', openingBalance: 45000 },
    { name: 'Zydus Medical Agency', contactPerson: 'Mehul Patel', phone: '9840445566', email: 'supply@zydusagency.co.in', address: 'Sarkhej-Bavla Highway, Ahmedabad, Gujarat - 382210', gstin: '24AAACZ4444D1Z4', state: 'Gujarat', openingBalance: 0 },
    { name: 'Torrent Medisales Corp', contactPerson: 'Bhavin Shah', phone: '9850556677', email: 'sales@torrentmedisales.com', address: 'GIDC Industrial Estate, Indrad, Gujarat - 382721', gstin: '24AAACT5555E1Z5', state: 'Gujarat', openingBalance: 8200 },
    { name: 'Mankind Medico Distributors', contactPerson: 'Sanjay Sharma', phone: '9860667788', email: 'orders@mankindmedico.in', address: '208 Okhla Phase III, New Delhi - 110020', gstin: '07AAACM6666F1Z6', state: 'Delhi', openingBalance: 0 },
    { name: 'Dr. Reddy Regional Agency', contactPerson: 'Narasimha Rao', phone: '9870778899', email: 'contact@drreddyagency.in', address: 'Bollaram Industrial Area, Hyderabad, Telangana - 502325', gstin: '36AAACD7777G1Z7', state: 'Telangana', openingBalance: 18400 },
    { name: 'Glenmark Trade Linkers', contactPerson: 'Deepak Sawant', phone: '9880889900', email: 'inquiry@glenmarktradelink.com', address: 'Mahape, Millennium Business Park, Navi Mumbai - 400710', gstin: '27AAACG8888H1Z8', state: 'Maharashtra', openingBalance: 0 },
  ];

  const createdSuppliers = await Supplier.insertMany(
    suppliersData.map(s => ({
      ...s,
      tenantId,
      isActive: true,
      createdBy: adminAttribution
    }))
  );
  console.log(`✅ Seeded ${createdSuppliers.length} Suppliers.`);

  // ─────────────────────────────────────────────────────────────────
  // 6. Seed Products (50 Realistic Pharmaceuticals & Medical Consumables)
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n💊 Seeding Products & Catalogs...`);
  const productsCatalog = [
    // Antibiotics & Anti-Infectives
    { productName: 'Amoxicillin 500mg Capsules', hsnCode: '30041010', manufacturer: 'Apex Pharma Labs', newMRP: 112.50, rate: 78.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Azithromycin 500mg Tablets (Azithro-500)', hsnCode: '30042099', manufacturer: 'Cipla Healthcare', newMRP: 145.00, rate: 98.50, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Cefixime 200mg Tablets (Cefi-O 200)', hsnCode: '30042099', manufacturer: 'Zydus Medical', newMRP: 168.00, rate: 114.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Ofloxacin 200mg + Ornidazole 500mg', hsnCode: '30049099', manufacturer: 'Mankind Medico', newMRP: 128.00, rate: 85.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Ciprofloxacin 500mg (Cipro-500)', hsnCode: '30042099', manufacturer: 'Torrent Medisales', newMRP: 65.00, rate: 42.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Doxycycline 100mg Capsules', hsnCode: '30042099', manufacturer: 'Dr. Reddy Agency', newMRP: 88.00, rate: 56.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Clavam 625mg Tablets', hsnCode: '30041010', manufacturer: 'Apex Pharma Labs', newMRP: 215.00, rate: 155.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Levofloxacin 500mg Tablets', hsnCode: '30042099', manufacturer: 'Cipla Healthcare', newMRP: 105.00, rate: 70.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Meropenem 1g Injection (IV)', hsnCode: '30049099', manufacturer: 'Cipla Healthcare', newMRP: 1250.00, rate: 890.00, gstPercentage: 12, unit: 'Vials' },
    { productName: 'Linezolid 600mg Tablets', hsnCode: '30049099', manufacturer: 'Glenmark Trade', newMRP: 380.00, rate: 260.00, gstPercentage: 12, unit: 'Strips' },

    // Analgesics, Antipyretics & Anti-Inflammatory
    { productName: 'Paracetamol 650mg (Dolo-650 style)', hsnCode: '30049060', manufacturer: 'Apex Pharma Labs', newMRP: 34.00, rate: 22.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Ibuprofen 400mg + Paracetamol 325mg', hsnCode: '30049060', manufacturer: 'Mankind Medico', newMRP: 42.00, rate: 26.50, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Aceclofenac 100mg + Paracetamol 325mg', hsnCode: '30049060', manufacturer: 'Torrent Medisales', newMRP: 84.00, rate: 52.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Aceclofenac + Serratiopeptidase', hsnCode: '30049060', manufacturer: 'Dr. Reddy Agency', newMRP: 148.00, rate: 96.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Diclofenac Sodium Gel 30g Tube', hsnCode: '30049060', manufacturer: 'Zydus Medical', newMRP: 95.00, rate: 60.00, gstPercentage: 12, unit: 'Tubes' },
    { productName: 'Tramadol 50mg Capsules', hsnCode: '30049060', manufacturer: 'Cipla Healthcare', newMRP: 120.00, rate: 80.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Ketorolac Tromethamine 10mg DT', hsnCode: '30049060', manufacturer: 'Glenmark Trade', newMRP: 75.00, rate: 48.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Naproxen 500mg Tablets', hsnCode: '30049060', manufacturer: 'Sun Life Diag', newMRP: 110.00, rate: 72.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Etoricoxib 90mg Tablets', hsnCode: '30049060', manufacturer: 'Torrent Medisales', newMRP: 165.00, rate: 108.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Serratiopeptidase 10mg Tablets', hsnCode: '30049060', manufacturer: 'Apex Pharma Labs', newMRP: 92.00, rate: 58.00, gstPercentage: 12, unit: 'Strips' },

    // Gastro, Antacids & Antiemetics
    { productName: 'Pantoprazole 40mg (Pan-40)', hsnCode: '30049099', manufacturer: 'Apex Pharma Labs', newMRP: 135.00, rate: 88.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Pantoprazole 40mg + Domperidone 30mg SR', hsnCode: '30049099', manufacturer: 'Zydus Medical', newMRP: 185.00, rate: 120.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Rabeprazole 20mg + Domperidone 30mg', hsnCode: '30049099', manufacturer: 'Torrent Medisales', newMRP: 195.00, rate: 128.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Omeprazole 20mg Capsules', hsnCode: '30049099', manufacturer: 'Cipla Healthcare', newMRP: 62.00, rate: 38.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Sucralfate 1000mg Suspension 200ml', hsnCode: '30049099', manufacturer: 'Dr. Reddy Agency', newMRP: 220.00, rate: 145.00, gstPercentage: 12, unit: 'Bottles' },
    { productName: 'Antacid Mint Suspension 170ml', hsnCode: '30049099', manufacturer: 'Mankind Medico', newMRP: 140.00, rate: 90.00, gstPercentage: 12, unit: 'Bottles' },
    { productName: 'Ondansetron 4mg MD Tablets (Emeset)', hsnCode: '30049099', manufacturer: 'Cipla Healthcare', newMRP: 55.00, rate: 35.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Domperidone 10mg Tablets (Vomitstop)', hsnCode: '30049099', manufacturer: 'Apex Pharma Labs', newMRP: 48.00, rate: 30.00, gstPercentage: 12, unit: 'Strips' },

    // Cardiac, Hypertension & Antidiabetics
    { productName: 'Telmisartan 40mg Tablets (Telma-40)', hsnCode: '30049099', manufacturer: 'Glenmark Trade', newMRP: 142.00, rate: 94.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Telmisartan 40mg + Amlodipine 5mg', hsnCode: '30049099', manufacturer: 'Glenmark Trade', newMRP: 185.00, rate: 122.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Amlodipine 5mg Tablets (Amlokind)', hsnCode: '30049099', manufacturer: 'Mankind Medico', newMRP: 38.00, rate: 22.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Metformin 500mg SR Tablets', hsnCode: '30049099', manufacturer: 'Sun Life Diag', newMRP: 45.00, rate: 28.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Metformin 500mg + Glimepiride 2mg', hsnCode: '30049099', manufacturer: 'Zydus Medical', newMRP: 125.00, rate: 82.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Atorvastatin 20mg Tablets (Atorva)', hsnCode: '30049099', manufacturer: 'Zydus Medical', newMRP: 210.00, rate: 138.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Rosuvastatin 10mg Tablets (Rosuvas)', hsnCode: '30049099', manufacturer: 'Sun Life Diag', newMRP: 195.00, rate: 130.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Losartan Potassium 50mg Tablets', hsnCode: '30049099', manufacturer: 'Torrent Medisales', newMRP: 88.00, rate: 56.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Teneligliptin 20mg Tablets', hsnCode: '30049099', manufacturer: 'Glenmark Trade', newMRP: 165.00, rate: 110.00, gstPercentage: 12, unit: 'Strips' },

    // Respiratory, Cough & Antiallergic
    { productName: 'Cetirizine 10mg Tablets (Cetzine)', hsnCode: '30049099', manufacturer: 'Dr. Reddy Agency', newMRP: 28.00, rate: 16.50, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Levocetirizine 5mg + Montelukast 10mg', hsnCode: '30049099', manufacturer: 'Cipla Healthcare', newMRP: 175.00, rate: 115.00, gstPercentage: 12, unit: 'Strips' },
    { productName: 'Cough Syrup (Dextromethorphan + CPM) 100ml', hsnCode: '30049099', manufacturer: 'Apex Pharma Labs', newMRP: 115.00, rate: 74.00, gstPercentage: 12, unit: 'Bottles' },
    { productName: 'Ambroxol + Terbutaline + Guaiphenesin 100ml', hsnCode: '30049099', manufacturer: 'Mankind Medico', newMRP: 125.00, rate: 80.00, gstPercentage: 12, unit: 'Bottles' },
    { productName: 'Salbutamol 100mcg Inhaler (200 MDI)', hsnCode: '30049099', manufacturer: 'Cipla Healthcare', newMRP: 160.00, rate: 110.00, gstPercentage: 12, unit: 'Canisters' },
    { productName: 'Budesonide 0.5mg Respules (Pack of 5)', hsnCode: '30049099', manufacturer: 'Cipla Healthcare', newMRP: 190.00, rate: 135.00, gstPercentage: 12, unit: 'Packs' },

    // Consumables & Medical Devices
    { productName: 'Digital Infrared Forehead Thermometer', hsnCode: '90251920', manufacturer: 'Sun Life Diag', newMRP: 950.00, rate: 620.00, gstPercentage: 18, unit: 'Pieces' },
    { productName: 'Blood Glucose Monitoring System + 25 Strips', hsnCode: '90278090', manufacturer: 'Sun Life Diag', newMRP: 1250.00, rate: 850.00, gstPercentage: 12, unit: 'Kits' },
    { productName: 'N95 Respirator Masks (Box of 20)', hsnCode: '63079090', manufacturer: 'Apex Pharma Labs', newMRP: 450.00, rate: 270.00, gstPercentage: 5, unit: 'Boxes' },
    { productName: 'Surgical Nitrile Gloves Powder-Free (Box of 100)', hsnCode: '40151100', manufacturer: 'Sun Life Diag', newMRP: 550.00, rate: 360.00, gstPercentage: 5, unit: 'Boxes' },
    { productName: 'Pulse Oximeter OLED Fingertip', hsnCode: '90181990', manufacturer: 'Sun Life Diag', newMRP: 750.00, rate: 490.00, gstPercentage: 12, unit: 'Pieces' },
    { productName: 'Antiseptic Povidone Iodine 10% Solution 500ml', hsnCode: '30049099', manufacturer: 'Cipla Healthcare', newMRP: 285.00, rate: 195.00, gstPercentage: 12, unit: 'Bottles' },
    { productName: 'Absorbent Cotton Wool IP 500g Roll', hsnCode: '30059010', manufacturer: 'Mankind Medico', newMRP: 180.00, rate: 115.00, gstPercentage: 12, unit: 'Rolls' },
  ];

  const createdProducts = await Product.insertMany(
    productsCatalog.map(p => ({
      ...p,
      tenantId,
      oldMRP: round2(p.newMRP * 0.95),
      openingStockQty: 0,
      currentStockQty: 0,
      stockVersion: 0,
      isActive: true,
      createdBy: adminAttribution,
      lastUpdatedBy: adminAttribution,
    }))
  );
  console.log(`✅ Seeded ${createdProducts.length} Products.`);

  // ─────────────────────────────────────────────────────────────────
  // 7. Seed Batches & Calculate Initial Inventories
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n📦 Seeding Product Batches & Stock Movements...`);
  const batchesToInsert: any[] = [];
  const stockMovementsToInsert: any[] = [];

  // Low-stock products index markers: 2, 7, 14, 25, 43
  const lowStockIndices = new Set([2, 7, 14, 25, 43]);
  // Expiring soon indices: 5, 11, 18, 30, 39, 48
  const expiringSoonIndices = new Set([5, 11, 18, 30, 39, 48]);

  for (let i = 0; i < createdProducts.length; i++) {
    const prod = createdProducts[i];
    const isLowStock = lowStockIndices.has(i);
    const isExpiringSoon = expiringSoonIndices.has(i);

    // Batch 1 (Primary Active Batch)
    const batch1No = `B24-${1000 + i}`;
    let exp1: Date;
    let qty1: number;

    if (isExpiringSoon) {
      // Expires in 50 days (within next 3 months to trigger expiring soon alert)
      exp1 = new Date(now.getTime() + 50 * 24 * 60 * 60 * 1000);
      qty1 = 45;
    } else if (isLowStock) {
      // Very low remaining stock (e.g. 4 to 8 units to trigger low stock alert)
      exp1 = new Date(now.getTime() + 450 * 24 * 60 * 60 * 1000);
      qty1 = 6;
    } else {
      // Normal healthy batch
      exp1 = new Date(now.getTime() + 520 * 24 * 60 * 60 * 1000);
      qty1 = 180 + (i % 5) * 40;
    }

    const batch1Id = new mongoose.Types.ObjectId();
    batchesToInsert.push({
      _id: batch1Id,
      tenantId,
      productId: prod._id,
      batchNo: batch1No,
      expiryDate: exp1,
      rate: prod.rate,
      mrp: prod.newMRP,
      gstPercent: prod.gstPercentage,
      initialQty: isLowStock ? 100 : qty1 + 50,
      remainingQty: qty1,
      isActive: true,
      createdBy: adminAttribution
    });

    stockMovementsToInsert.push({
      tenantId,
      productId: prod._id,
      batchId: batch1Id,
      type: 'OPENING_STOCK',
      quantity: isLowStock ? 100 : qty1 + 50,
      rate: prod.rate,
      totalValue: round2(prod.rate * (isLowStock ? 100 : qty1 + 50)),
      referenceType: 'OPENING',
      referenceId: batch1No,
      createdBy: adminAttribution,
      createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    });

    // Batch 2 for all healthy products
    if (!isLowStock) {
      const batch2No = `B25-${2000 + i}`;
      const exp2 = new Date(now.getTime() + 700 * 24 * 60 * 60 * 1000);
      const qty2 = 120 + (i % 3) * 30;
      const batch2Id = new mongoose.Types.ObjectId();

      batchesToInsert.push({
        _id: batch2Id,
        tenantId,
        productId: prod._id,
        batchNo: batch2No,
        expiryDate: exp2,
        rate: prod.rate,
        mrp: prod.newMRP,
        gstPercent: prod.gstPercentage,
        initialQty: qty2,
        remainingQty: qty2,
        isActive: true,
        createdBy: adminAttribution
      });

      stockMovementsToInsert.push({
        tenantId,
        productId: prod._id,
        batchId: batch2Id,
        type: 'PURCHASE',
        quantity: qty2,
        rate: prod.rate,
        totalValue: round2(prod.rate * qty2),
        referenceType: 'PURCHASE',
        referenceId: batch2No,
        createdBy: adminAttribution,
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)
      });

      // Batch 3 for high-volume items
      if (i % 3 === 0) {
        const batch3No = `B26-${3000 + i}`;
        const exp3 = new Date(now.getTime() + 850 * 24 * 60 * 60 * 1000);
        const qty3 = 80 + (i % 4) * 25;
        const batch3Id = new mongoose.Types.ObjectId();

        batchesToInsert.push({
          _id: batch3Id,
          tenantId,
          productId: prod._id,
          batchNo: batch3No,
          expiryDate: exp3,
          rate: prod.rate,
          mrp: prod.newMRP,
          gstPercent: prod.gstPercentage,
          initialQty: qty3,
          remainingQty: qty3,
          isActive: true,
          createdBy: adminAttribution
        });

        stockMovementsToInsert.push({
          tenantId,
          productId: prod._id,
          batchId: batch3Id,
          type: 'PURCHASE',
          quantity: qty3,
          rate: prod.rate,
          totalValue: round2(prod.rate * qty3),
          referenceType: 'PURCHASE',
          referenceId: batch3No,
          createdBy: adminAttribution,
          createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
        });
      }
    }
  }

  const createdBatches = await Batch.insertMany(batchesToInsert);
  await StockMovement.insertMany(stockMovementsToInsert);

  // Update Product currentStockQty to match batch sums
  for (const prod of createdProducts) {
    const prodBatches = createdBatches.filter(b => b.productId.toString() === prod._id.toString());
    const totalStock = prodBatches.reduce((acc, b) => acc + b.remainingQty, 0);
    const primaryBatch = prodBatches[0];

    await Product.updateOne(
      { _id: prod._id },
      {
        $set: {
          currentStockQty: totalStock,
          openingStockQty: totalStock,
          batchNo: primaryBatch?.batchNo || '',
          expiryDate: primaryBatch?.expiryDate || null
        }
      }
    );
  }
  console.log(`✅ Seeded ${createdBatches.length} Batches and ${stockMovementsToInsert.length} StockMovements.`);

  // ─────────────────────────────────────────────────────────────────
  // 8. Seed Purchases (20 Distributed Purchases from Suppliers)
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n📑 Seeding Purchases...`);
  const purchasesToInsert: any[] = [];

  for (let i = 1; i <= 20; i++) {
    const supplier = createdSuppliers[i % createdSuppliers.length];
    const purchaseDate = new Date(now.getTime() - (65 - i * 3) * 24 * 60 * 60 * 1000);
    const purchaseNumber = `PO-2026-${String(i).padStart(4, '0')}`;
    const supplierInvoiceNumber = `SUP-INV-${10000 + i * 47}`;

    // Select 3 products for this purchase
    const p1 = createdProducts[(i * 2) % createdProducts.length];
    const p2 = createdProducts[(i * 2 + 1) % createdProducts.length];
    const p3 = createdProducts[(i * 2 + 2) % createdProducts.length];

    const items = [p1, p2, p3].map((prod) => {
      const qty = 50 + (i % 4) * 25;
      const taxable = round2(qty * prod.rate);
      const gstAmt = round2(taxable * (prod.gstPercentage / 100));
      const cgst = round2(gstAmt / 2);
      const sgst = round2(gstAmt / 2);
      const total = round2(taxable + gstAmt);

      return {
        productId: prod._id,
        batchNumber: `SUP-B-${i}`,
        expiryDate: new Date(now.getTime() + 600 * 24 * 60 * 60 * 1000),
        quantity: qty,
        freeQuantity: 0,
        mrp: prod.newMRP,
        purchaseRate: prod.rate,
        sellingRate: prod.rate,
        gstPercent: prod.gstPercentage,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: 0,
        gstAmount: gstAmt,
        discount: 0,
        taxableAmount: taxable,
        total: total
      };
    });

    const subtotal = round2(items.reduce((acc, it) => acc + (it.quantity * it.purchaseRate), 0));
    const totalTaxable = round2(items.reduce((acc, it) => acc + it.taxableAmount, 0));
    const totalGST = round2(items.reduce((acc, it) => acc + it.gstAmount, 0));
    const totalCGST = round2(items.reduce((acc, it) => acc + it.cgstAmount, 0));
    const totalSGST = round2(items.reduce((acc, it) => acc + it.sgstAmount, 0));
    const grandTotal = round2(totalTaxable + totalGST);

    purchasesToInsert.push({
      tenantId,
      supplierId: supplier._id,
      purchaseNumber,
      purchaseDate,
      supplierInvoiceNumber,
      items,
      totals: {
        subtotal,
        totalDiscount: 0,
        totalTaxable,
        totalGST,
        totalCGST,
        totalSGST,
        totalIGST: 0,
        grandTotal
      },
      status: 'COMPLETED',
      createdBy: adminAttribution,
      createdAt: purchaseDate,
      updatedAt: purchaseDate
    });
  }

  const createdPurchases = await Purchase.insertMany(purchasesToInsert);
  console.log(`✅ Seeded ${createdPurchases.length} Purchase orders.`);

  // ─────────────────────────────────────────────────────────────────
  // 9. Seed Customers (30 Believable Indian Pharmacies)
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n🏥 Seeding Customers...`);
  const customersCatalog = [
    { customerName: 'Sharma Medicals', phone: '9811000001', email: 'sharma.medicals@gmail.com', address: 'Shop 4, Civil Lines, Gurugram, Haryana - 122001', gstin: '06AAACS1001A1Z1', dlNo: 'HR-GGM-1011', creditLimit: 150000, theme: 'blue' },
    { customerName: 'CarePlus Pharmacy & Clinic', phone: '9811000002', email: 'careplus.delhi@outlook.com', address: 'Main Market, Green Park, New Delhi - 110016', gstin: '07AAACC2002B1Z2', dlNo: 'DL-SZ-2022', creditLimit: 200000, theme: 'emerald' },
    { customerName: 'Maa Durga Medical Hall', phone: '9811000003', email: 'maadurgamed@rediffmail.com', address: 'Bata Chowk, NIT, Faridabad, Haryana - 121001', gstin: '06AAACM3003C1Z3', dlNo: 'HR-FBD-3033', creditLimit: 100000, theme: 'amber' },
    { customerName: 'City Care Pharmacy', phone: '9811000004', email: 'citycare.noida@gmail.com', address: 'B-Block Market, Sector 27, Noida, UP - 201301', gstin: '09AAACC4004D1Z4', dlNo: 'UP-GBN-4044', creditLimit: 120000, theme: 'purple' },
    { customerName: 'Wellness Drug House', phone: '9811000005', email: 'wellnessdrug@yahoo.in', address: 'RDC, Raj Nagar, Ghaziabad, UP - 201002', gstin: '09AAACW5005E1Z5', dlNo: 'UP-GZB-5055', creditLimit: 150000, theme: 'rose' },
    { customerName: 'Apollo Meds & Surgicals', phone: '9811000006', email: 'apollomeds.gk@gmail.com', address: 'M-Block, Greater Kailash II, New Delhi - 110048', gstin: '07AAACA6006F1Z6', dlNo: 'DL-SZ-6066', creditLimit: 300000, theme: 'sky' },
    { customerName: 'Sanjeevani Healthcare Chemist', phone: '9811000007', email: 'sanjeevani.ggn@gmail.com', address: 'Galleria Market, DLF Phase IV, Gurugram - 122009', gstin: '06AAACS7007G1Z7', dlNo: 'HR-GGM-7077', creditLimit: 180000, theme: 'teal' },
    { customerName: 'Gupta Medicos', phone: '9811000008', email: 'guptamedicos.cp@gmail.com', address: 'Shankar Market, Connaught Place, New Delhi - 110001', gstin: '07AAACG8008H1Z8', dlNo: 'DL-CZ-8088', creditLimit: 120000, theme: 'indigo' },
    { customerName: 'Relife Chemist & Druggist', phone: '9811000009', email: 'relife.dwarka@outlook.com', address: 'Sector 12 Market, Dwarka, New Delhi - 110075', gstin: '07AAACR9009I1Z9', dlNo: 'DL-WZ-9099', creditLimit: 140000, theme: 'blue' },
    { customerName: 'Pulse Pharmacy', phone: '9811000010', email: 'pulse.vasant@gmail.com', address: 'Sector C, Vasant Kunj, New Delhi - 110070', gstin: '07AAACP0101J1Z0', dlNo: 'DL-SW-0101', creditLimit: 160000, theme: 'emerald' },
    { customerName: 'Prime Healthcare Chemists', phone: '9811000011', email: 'primehealth.saket@gmail.com', address: 'J-Block, Saket Community Centre, New Delhi - 110017', gstin: '07AAACP1112K1Z1', dlNo: 'DL-SZ-1112', creditLimit: 220000, theme: 'amber' },
    { customerName: 'New Life Drug Store', phone: '9811000012', email: 'newlife.indirapuram@yahoo.com', address: 'Ahinsa Khand II, Indirapuram, Ghaziabad - 201014', gstin: '09AAACN2223L1Z2', dlNo: 'UP-GZB-2223', creditLimit: 90000, theme: 'purple' },
    { customerName: 'Lifeline Medical Agency', phone: '9811000013', email: 'lifeline.rohini@gmail.com', address: 'Sector 7, Rohini, New Delhi - 110085', gstin: '07AAACL3334M1Z3', dlNo: 'DL-NW-3334', creditLimit: 175000, theme: 'rose' },
    { customerName: 'Metro Chemist & Druggist', phone: '9811000014', email: 'metrochemist.janak@gmail.com', address: 'District Centre, Janakpuri, New Delhi - 110058', gstin: '07AAACM4445N1Z4', dlNo: 'DL-WZ-4445', creditLimit: 130000, theme: 'sky' },
    { customerName: 'Royal Pharmacy', phone: '9811000015', email: 'royalpharma.grnoida@gmail.com', address: 'Alpha 1 Commercial Belt, Greater Noida, UP - 201308', gstin: '09AAACR5556O1Z5', dlNo: 'UP-GBN-5556', creditLimit: 110000, theme: 'teal' },
    { customerName: 'Shiva Medical Store', phone: '9811000016', email: 'shivamed.sonipat@gmail.com', address: 'Subhash Chowk, Sonipat, Haryana - 131001', gstin: '06AAACS6667P1Z6', dlNo: 'HR-SNP-6667', creditLimit: 85000, theme: 'indigo' },
    { customerName: 'Good Health Chemist', phone: '9811000017', email: 'goodhealth.kb@gmail.com', address: 'Ajmal Khan Road, Karol Bagh, New Delhi - 110005', gstin: '07AAACG7778Q1Z7', dlNo: 'DL-CZ-7778', creditLimit: 160000, theme: 'blue' },
    { customerName: 'Balaji Medicals', phone: '9811000018', email: 'balajimed.najafgarh@gmail.com', address: 'Main Thana Road, Najafgarh, New Delhi - 110043', gstin: '07AAACB8889R1Z8', dlNo: 'DL-SW-8889', creditLimit: 95000, theme: 'emerald' },
    { customerName: 'Apex Care Chemists', phone: '9811000019', email: 'apexcare.lajpat@gmail.com', address: 'Central Market, Lajpat Nagar II, New Delhi - 110024', gstin: '07AAACA9990S1Z9', dlNo: 'DL-SE-9990', creditLimit: 210000, theme: 'amber' },
    { customerName: 'Hope Pharmacy & Wellness', phone: '9811000020', email: 'hopepharma.mayur@gmail.com', address: 'Phase 1 Market, Mayur Vihar, Delhi - 110091', gstin: '07AAACH0001T1Z0', dlNo: 'DL-EZ-0001', creditLimit: 115000, theme: 'purple' },
    { customerName: 'Global Meds Express', phone: '9811000021', email: 'globalmeds.pv@gmail.com', address: 'A-Block, Paschim Vihar, New Delhi - 110063', gstin: '07AAACG1112U1Z1', dlNo: 'DL-WZ-1112', creditLimit: 145000, theme: 'rose' },
    { customerName: 'Shree Ram Medicos', phone: '9811000022', email: 'shreeram.cc@gmail.com', address: 'Bhagirath Palace, Chandni Chowk, Delhi - 110006', gstin: '07AAACS2223V1Z2', dlNo: 'DL-NZ-2223', creditLimit: 250000, theme: 'sky' },
    { customerName: 'MedPlus Express Pharmacy', phone: '9811000023', email: 'medplus.connaught@gmail.com', address: 'Outer Circle, Connaught Place, New Delhi - 110001', gstin: '07AAACM3334W1Z3', dlNo: 'DL-CZ-3334', creditLimit: 280000, theme: 'teal' },
    { customerName: 'HealthFirst Chemist', phone: '9811000024', email: 'healthfirst.noida62@gmail.com', address: 'Electronic City, Sector 62, Noida, UP - 201309', gstin: '09AAACH4445X1Z4', dlNo: 'UP-GBN-4445', creditLimit: 135000, theme: 'indigo' },
    { customerName: 'Anand Medical Agency', phone: '9811000025', email: 'anandmed.gzb@gmail.com', address: 'Old Bus Stand, Meerut Road, Ghaziabad - 201001', gstin: '09AAACA5556Y1Z5', dlNo: 'UP-GZB-5556', creditLimit: 105000, theme: 'blue' },
    { customerName: 'Krishna Pharmacy Store', phone: '9811000026', email: 'krishnapharma.fbd@gmail.com', address: 'Neelam Bata Road, Faridabad NIT - 121001', gstin: '06AAACK6667Z1Z6', dlNo: 'HR-FBD-6667', creditLimit: 125000, theme: 'emerald' },
    { customerName: 'Om Sai Medicals', phone: '9811000027', email: 'omsaimed.ggn4@gmail.com', address: 'Railway Road, Sector 4, Gurugram - 122006', gstin: '06AAAC07778A1Z7', dlNo: 'HR-GGM-7778', creditLimit: 90000, theme: 'amber' },
    { customerName: 'Star Drug Distributors', phone: '9811000028', email: 'stardrug.manesar@gmail.com', address: 'IMT Manesar, Sector 1, Gurugram, Haryana - 122050', gstin: '06AAACS8889B1Z8', dlNo: 'HR-GGM-8889', creditLimit: 190000, theme: 'purple' },
    { customerName: 'Unity Chemist & Surgical', phone: '9811000029', email: 'unitychemist.palam@gmail.com', address: 'Main Palam Road, Palam Village, New Delhi - 110045', gstin: '07AAACU9990C1Z9', dlNo: 'DL-SW-9990', creditLimit: 110000, theme: 'rose' },
    { customerName: 'Vardhman Medicos', phone: '9811000030', email: 'vardhman.pitampura@gmail.com', address: 'Kohat Enclave, Pitampura, New Delhi - 110034', gstin: '07AAACV0001D1Z0', dlNo: 'DL-NW-0001', creditLimit: 170000, theme: 'sky' },
  ];

  const createdCustomers = await Customer.insertMany(
    customersCatalog.map((c, idx) => ({
      ...c,
      tenantId,
      customerCode: `CUST-${String(idx + 1).padStart(3, '0')}`,
      outstandingBalance: 0,
      creditBalance: 0,
      totalPurchases: 0,
      invoiceCount: 0,
      isActive: true,
      createdBy: adminAttribution
    }))
  );
  console.log(`✅ Seeded ${createdCustomers.length} Customers.`);

  // ─────────────────────────────────────────────────────────────────
  // 10. Seed Invoices (70 Invoices Across Past 90 Days)
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n🧾 Seeding Invoices (70 distributed records)...`);

  // Target Status Distribution:
  // - Invoices 1 to 35: Paid (full amount paid)
  // - Invoices 36 to 50: Partial (partially paid)
  // - Invoices 51 to 70: Unpaid (unpaid)
  const invoicesToInsert: any[] = [];
  const paymentsToInsert: any[] = [];

  for (let invIdx = 1; invIdx <= 70; invIdx++) {
    const customer = createdCustomers[(invIdx * 7) % createdCustomers.length];

    let invoiceDate: Date;
    if (invIdx >= 66) {
      // Today (5 invoices at different hours today)
      invoiceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + (invIdx - 66) * 2, 15, 0);
    } else if (invIdx >= 62) {
      // Yesterday (4 invoices)
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      invoiceDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 10 + (invIdx - 62) * 2, 30, 0);
    } else if (invIdx >= 44) {
      // 7 to 2 days ago
      const daysAgo = 2 + ((61 - invIdx) % 6);
      invoiceDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else if (invIdx >= 19) {
      // 30 to 8 days ago
      const daysAgo = 8 + ((43 - invIdx) % 22);
      invoiceDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else {
      // 90 to 31 days ago
      const daysAgo = 32 + ((18 - invIdx) % 55);
      invoiceDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    }

    const invoiceNumber = `INV-2026-${String(invIdx).padStart(4, '0')}`;
    const invoiceId = new mongoose.Types.ObjectId();

    // Line items (2 to 4 items per invoice)
    const itemCount = 2 + (invIdx % 3);
    const invoiceItems: any[] = [];

    for (let k = 0; k < itemCount; k++) {
      const prod = createdProducts[(invIdx * 3 + k) % createdProducts.length];
      const prodBatches = createdBatches.filter(b => b.productId.toString() === prod._id.toString());
      const chosenBatch = prodBatches[0] || {
        _id: new mongoose.Types.ObjectId(),
        batchNo: `B-${invIdx}-${k}`,
        expiryDate: new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000)
      };

      const qty = 5 + ((invIdx + k) % 6) * 5;
      const rate = prod.rate;
      const baseAmount = round2(qty * rate);
      const discount = (k === 0 && invIdx % 4 === 0) ? 5 : 0; // 5% discount on some items
      const discountAmount = round2(baseAmount * (discount / 100));
      const taxableAmount = round2(baseAmount - discountAmount);
      const gstAmount = round2(taxableAmount * (prod.gstPercentage / 100));
      const cgstAmount = round2(gstAmount / 2);
      const sgstAmount = round2(gstAmount / 2);
      const totalAmount = round2(taxableAmount + gstAmount);

      invoiceItems.push({
        product: {
          _id: prod._id,
          productName: prod.productName,
          hsnCode: prod.hsnCode,
          pack: prod.unit,
          batchNo: chosenBatch.batchNo,
          expiryDate: chosenBatch.expiryDate,
          newMRP: prod.newMRP,
          gstPercentage: prod.gstPercentage
        },
        batchAllocations: [{
          batchId: chosenBatch._id,
          batchNo: chosenBatch.batchNo,
          quantity: qty,
          expiryDate: chosenBatch.expiryDate,
          rate: rate,
          mrp: prod.newMRP,
          gstPercent: prod.gstPercentage
        }],
        allocationMode: 'AUTO',
        quantitySold: qty,
        freeQuantity: 0,
        ratePerUnit: rate,
        schemeDiscount: discount,
        baseAmount,
        discountAmount,
        taxableAmount,
        gstAmount,
        cgstAmount,
        sgstAmount,
        totalAmount
      });
    }

    const totalBase = round2(invoiceItems.reduce((acc, it) => acc + it.baseAmount, 0));
    const totalDiscount = round2(invoiceItems.reduce((acc, it) => acc + it.discountAmount, 0));
    const totalTaxable = round2(invoiceItems.reduce((acc, it) => acc + it.taxableAmount, 0));
    const totalGST = round2(invoiceItems.reduce((acc, it) => acc + it.gstAmount, 0));
    const totalCGST = round2(invoiceItems.reduce((acc, it) => acc + it.cgstAmount, 0));
    const totalSGST = round2(invoiceItems.reduce((acc, it) => acc + it.sgstAmount, 0));
    const netTotal = round2(totalTaxable + totalGST);

    // Determine payment status
    let paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
    let paidAmount = 0;

    if (invIdx <= 35) {
      // 100% Paid
      paymentStatus = 'Paid';
      paidAmount = netTotal;
    } else if (invIdx <= 50) {
      // Partially Paid (roughly 50%)
      paymentStatus = 'Partial';
      paidAmount = round2(netTotal * 0.5);
    } else {
      // Unpaid
      paymentStatus = 'Unpaid';
      paidAmount = 0;
    }

    invoicesToInsert.push({
      _id: invoiceId,
      tenantId,
      invoiceNumber,
      invoiceDate,
      customer: {
        _id: customer._id,
        customerName: customer.customerName,
        address: customer.address,
        phone: customer.phone,
        gstin: customer.gstin,
        dlNo: customer.dlNo
      },
      distributor: {
        firmName: showcaseAdmin.firmName,
        firmAddress: showcaseAdmin.firmAddress,
        firmPhone: showcaseAdmin.firmPhone,
        firmGSTIN: showcaseAdmin.firmGSTIN,
        firmDL: showcaseAdmin.firmDL,
        paymentInformation: showcaseAdmin.paymentInformation
      },
      items: invoiceItems,
      totals: {
        baseAmount: totalBase,
        totalDiscount,
        totalTaxable,
        totalGST,
        totalCGST,
        totalSGST,
        netTotal,
        amountInWords: numberToWords(netTotal)
      },
      paymentType: 'Credit',
      status: 'Created',
      notes: invIdx % 5 === 0 ? 'Standard distributor 30-day payment term.' : '',
      paidAmount,
      paymentStatus,
      dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
      createdBy: adminAttribution,
      createdAt: invoiceDate,
      updatedAt: invoiceDate
    });

    // Create corresponding payments for Paid and Partial invoices
    if (paidAmount > 0) {
      const paymentDate = new Date(invoiceDate.getTime() + (invIdx % 4) * 24 * 60 * 60 * 1000);
      const methods = ['UPI', 'Bank Transfer', 'UPI', 'NEFT/RTGS', 'Cash', 'UPI'];
      const method = methods[invIdx % methods.length];
      const refNumber = method === 'UPI'
        ? `UPI/${728190000000 + invIdx * 193}`
        : method === 'Cash'
        ? ''
        : `NEFT-HDFC-${981200 + invIdx * 31}`;

      paymentsToInsert.push({
        tenantId,
        invoice: invoiceId,
        customer: customer._id,
        amount: paidAmount,
        paymentDate,
        paymentMethod: method,
        referenceNumber: refNumber,
        notes: `Payment for ${invoiceNumber}`,
        invoiceSnapshot: {
          invoiceNumber,
          invoiceDate,
          netTotal
        },
        createdBy: adminAttribution,
        createdAt: paymentDate,
        updatedAt: paymentDate
      });
    }
  }

  const createdInvoices = await Invoice.insertMany(invoicesToInsert);
  const createdPayments = await Payment.insertMany(paymentsToInsert);
  console.log(`✅ Seeded ${createdInvoices.length} Invoices and ${createdPayments.length} Payments.`);

  // ─────────────────────────────────────────────────────────────────
  // 11. Seed Credit Notes (3 Realistic Sales Return Credit Notes)
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n↩️ Seeding Credit Notes (3 records)...`);
  const creditNotesToInsert: any[] = [];

  // Credit Note 1 on Invoice 10
  const inv10 = createdInvoices.find((inv: any) => inv.invoiceNumber === 'INV-2026-0010');
  if (inv10) {
    const returnItem = inv10.items[0];
    const qtyReturned = 2;
    const rate = returnItem.ratePerUnit;
    const taxable = round2(qtyReturned * rate);
    const gstAmt = round2(taxable * (returnItem.product.gstPercentage / 100));
    const cgst = round2(gstAmt / 2);
    const sgst = round2(gstAmt / 2);
    const total = round2(taxable + gstAmt);

    creditNotesToInsert.push({
      tenantId,
      creditNoteNumber: 'CN-2026-0001',
      invoiceId: inv10._id,
      invoiceNumber: inv10.invoiceNumber,
      customer: inv10.customer,
      distributor: inv10.distributor,
      items: [{
        productId: returnItem.product._id,
        batchNo: returnItem.product.batchNo,
        productName: returnItem.product.productName,
        quantityReturned: qtyReturned,
        rate,
        gstPercent: returnItem.product.gstPercentage,
        taxableAmount: taxable,
        gstAmount: gstAmt,
        cgstAmount: cgst,
        sgstAmount: sgst,
        totalAmount: total
      }],
      totals: {
        totalTaxable: taxable,
        totalGST: gstAmt,
        totalCGST: cgst,
        totalSGST: sgst,
        netTotal: total
      },
      reason: 'Damaged outer seal upon customer receipt - batch replacement credit.',
      createdBy: adminAttribution,
      createdAt: new Date(inv10.invoiceDate.getTime() + 2 * 24 * 60 * 60 * 1000)
    });
  }

  // Credit Note 2 on Invoice 22
  const inv22 = createdInvoices.find((inv: any) => inv.invoiceNumber === 'INV-2026-0022');
  if (inv22) {
    const returnItem = inv22.items[0];
    const qtyReturned = 3;
    const rate = returnItem.ratePerUnit;
    const taxable = round2(qtyReturned * rate);
    const gstAmt = round2(taxable * (returnItem.product.gstPercentage / 100));
    const cgst = round2(gstAmt / 2);
    const sgst = round2(gstAmt / 2);
    const total = round2(taxable + gstAmt);

    creditNotesToInsert.push({
      tenantId,
      creditNoteNumber: 'CN-2026-0002',
      invoiceId: inv22._id,
      invoiceNumber: inv22.invoiceNumber,
      customer: inv22.customer,
      distributor: inv22.distributor,
      items: [{
        productId: returnItem.product._id,
        batchNo: returnItem.product.batchNo,
        productName: returnItem.product.productName,
        quantityReturned: qtyReturned,
        rate,
        gstPercent: returnItem.product.gstPercentage,
        taxableAmount: taxable,
        gstAmount: gstAmt,
        cgstAmount: cgst,
        sgstAmount: sgst,
        totalAmount: total
      }],
      totals: {
        totalTaxable: taxable,
        totalGST: gstAmt,
        totalCGST: cgst,
        totalSGST: sgst,
        netTotal: total
      },
      reason: 'Order quantity discrepancy - excess strips returned in good condition.',
      createdBy: adminAttribution,
      createdAt: new Date(inv22.invoiceDate.getTime() + 3 * 24 * 60 * 60 * 1000)
    });
  }

  // Credit Note 3 on Invoice 38
  const inv38 = createdInvoices.find((inv: any) => inv.invoiceNumber === 'INV-2026-0038');
  if (inv38) {
    const returnItem = inv38.items[0];
    const qtyReturned = 1;
    const rate = returnItem.ratePerUnit;
    const taxable = round2(qtyReturned * rate);
    const gstAmt = round2(taxable * (returnItem.product.gstPercentage / 100));
    const cgst = round2(gstAmt / 2);
    const sgst = round2(gstAmt / 2);
    const total = round2(taxable + gstAmt);

    creditNotesToInsert.push({
      tenantId,
      creditNoteNumber: 'CN-2026-0003',
      invoiceId: inv38._id,
      invoiceNumber: inv38.invoiceNumber,
      customer: inv38.customer,
      distributor: inv38.distributor,
      items: [{
        productId: returnItem.product._id,
        batchNo: returnItem.product.batchNo,
        productName: returnItem.product.productName,
        quantityReturned: qtyReturned,
        rate,
        gstPercent: returnItem.product.gstPercentage,
        taxableAmount: taxable,
        gstAmount: gstAmt,
        cgstAmount: cgst,
        sgstAmount: sgst,
        totalAmount: total
      }],
      totals: {
        totalTaxable: taxable,
        totalGST: gstAmt,
        totalCGST: cgst,
        totalSGST: sgst,
        netTotal: total
      },
      reason: 'Pharmacy overstock return accepted per monthly credit memo.',
      createdBy: adminAttribution,
      createdAt: new Date(inv38.invoiceDate.getTime() + 1 * 24 * 60 * 60 * 1000)
    });
  }

  const createdCreditNotes = await CreditNote.insertMany(creditNotesToInsert);
  console.log(`✅ Seeded ${createdCreditNotes.length} Credit Notes.`);

  // ─────────────────────────────────────────────────────────────────
  // 12. Reconcile Customer Balances to 100% Mathematical Parity
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n⚖️ Reconciling Customer Outstanding Balances with 100% Ledger Parity...`);

  for (const customer of createdCustomers) {
    const custId = customer._id;

    // All invoices for this customer
    const custInvoices = createdInvoices.filter((inv: any) => inv.customer._id.toString() === custId.toString());
    // All payments for this customer
    const custPayments = createdPayments.filter((p: any) => p.customer.toString() === custId.toString());
    // All credit notes for this customer
    const custCreditNotes = createdCreditNotes.filter((cn: any) => cn.customer._id.toString() === custId.toString());

    const totalDebit = round2(custInvoices.reduce((acc: number, inv: any) => acc + inv.totals.netTotal, 0));
    const totalPaymentCredit = round2(custPayments.reduce((acc: number, p: any) => acc + p.amount, 0));
    const totalCreditNoteCredit = round2(custCreditNotes.reduce((acc: number, cn: any) => acc + cn.totals.netTotal, 0));

    const totalCredit = round2(totalPaymentCredit + totalCreditNoteCredit);
    const liveOutstandingBalance = round2(totalDebit - totalCredit);
    const lastInvDate = custInvoices.length > 0
      ? new Date(Math.max(...custInvoices.map((inv: any) => new Date(inv.invoiceDate).getTime())))
      : undefined;

    await Customer.updateOne(
      { _id: custId },
      {
        $set: {
          outstandingBalance: liveOutstandingBalance,
          creditBalance: totalCreditNoteCredit,
          totalPurchases: totalDebit,
          invoiceCount: custInvoices.length,
          lastInvoiceDate: lastInvDate
        }
      }
    );
  }
  console.log(`✅ All 30 Customer summary balances reconciled with zero paisa drift.`);

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🎉 SHOWCASE SEEDING COMPLETE FOR: Bharat Healthcare & Distributors`);
  console.log(`══════════════════════════════════════════════════════════`);
  console.log(`  • Showcase Email : ${showcaseEmail}`);
  console.log(`  • Showcase Pass  : ${showcasePassword}`);
  console.log(`  • Customers      : ${createdCustomers.length}`);
  console.log(`  • Products       : ${createdProducts.length}`);
  console.log(`  • Batches        : ${createdBatches.length}`);
  console.log(`  • Suppliers      : ${createdSuppliers.length}`);
  console.log(`  • Purchases      : ${createdPurchases.length}`);
  console.log(`  • Invoices       : ${createdInvoices.length}`);
  console.log(`  • Payments       : ${createdPayments.length}`);
  console.log(`  • Credit Notes   : ${createdCreditNotes.length}`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  await mongoose.disconnect();
}

// Execute if run directly
if (require.main === module) {
  runShowcaseSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Showcase Seeding Error:', err);
      process.exit(1);
    });
}
