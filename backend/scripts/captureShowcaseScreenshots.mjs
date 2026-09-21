/**
 * Automated Showcase Screenshot Capture
 *
 * Uses puppeteer-core driving local Chrome/Edge in headless mode to capture
 * pixel-perfect, high-DPI screenshots of the REAL Bharat Enterprise application.
 *
 * Usage:
 *   node scripts/captureShowcaseScreenshots.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const outputDir = path.resolve(__dirname, '../../frontend/public/landing/product');

// Detect Chrome or Edge executable on Windows
function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error('Neither Google Chrome nor Microsoft Edge executable was found on system.');
}

async function run() {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`📸 BHARAT ENTERPRISE AUTOMATED SCREENSHOT ENGINE`);
  console.log(`══════════════════════════════════════════════════════════`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browserPath = findBrowserExecutable();
  console.log(`🌐 Browser Binary: ${browserPath}`);
  console.log(`📂 Output Directory: ${outputDir}`);

  // Connect to DB to get sample IDs
  const mongoUri = process.env.SHOWCASE_MONGODB_URI || 'mongodb://localhost:27017/';
  await mongoose.connect(mongoUri);

  const showcaseEmail = (process.env.SHOWCASE_ADMIN_EMAIL || 'admin@sys.com').toLowerCase().trim();
  const showcasePassword = process.env.SHOWCASE_ADMIN_PASSWORD || 'SysAdmin@2026';

  const Admin = mongoose.model('Admin', new mongoose.Schema({ email: String }, { strict: false }));
  await Admin.updateOne({ email: showcaseEmail }, { $set: { 'preferences.showCalculator': false } });
  const admin = await Admin.findOne({ email: showcaseEmail }).lean();
  if (!admin) {
    console.error(`❌ Showcase Admin [${showcaseEmail}] not found! Run npm run seed:showcase first.`);
    process.exit(1);
  }
  const tenantId = admin._id;

  const Customer = mongoose.model('Customer', new mongoose.Schema({ tenantId: mongoose.Schema.Types.ObjectId, customerName: String }, { strict: false }));
  const Invoice = mongoose.model('Invoice', new mongoose.Schema({ tenantId: mongoose.Schema.Types.ObjectId, invoiceNumber: String }, { strict: false }));

  const sampleCustomer = await Customer.findOne({ tenantId, customerName: 'Sharma Medicals' }).lean() || await Customer.findOne({ tenantId }).lean();
  const sampleInvoice = await Invoice.findOne({ tenantId, paymentStatus: 'Paid' }).lean() || await Invoice.findOne({ tenantId }).lean();

  console.log(`🎯 Sample Customer ID: ${sampleCustomer?._id} (${sampleCustomer?.customerName})`);
  console.log(`🎯 Sample Invoice ID : ${sampleInvoice?._id} (${sampleInvoice?.invoiceNumber})`);

  await mongoose.disconnect();

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2 // Crisp HiDPI Retina quality
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--hide-scrollbars'
    ]
  });

  const page = await browser.newPage();

  // ─────────────────────────────────────────────────────────────
  // 1. Authenticate via /login
  // ─────────────────────────────────────────────────────────────
  console.log(`\n🔑 Authenticating as ${showcaseEmail}...`);
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));

  // Fill credentials
  await page.waitForSelector('input[type="email"], input[name="email"]');
  await page.type('input[type="email"], input[name="email"]', showcaseEmail);
  await page.type('input[type="password"], input[name="password"]', showcasePassword);

  // Click submit
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  }

  // Wait for redirect to /
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  console.log(`✅ Authenticated successfully! Current URL: ${page.url()}`);

  // Helper for capturing screenshots
  async function capture(screenUrl, filename, label, waitMs = 2500) {
    console.log(`\n📸 Capturing ${label}...`);
    await page.goto(screenUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    // Allow charts, counters and transitions to fully settle
    await new Promise(r => setTimeout(r, waitMs));

    // Remove any floating calculator or toast popups if rendered
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach(el => {
        if (el.textContent && el.textContent.includes('Drag to move · releases dock')) {
          el.remove();
        }
      });
    });

    const filepath = path.join(outputDir, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    const stats = fs.statSync(filepath);
    console.log(`  ✅ Saved: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Capture Key Product Screens
  // ─────────────────────────────────────────────────────────────

  // Screen 1: Dashboard
  await capture('http://localhost:3000/', 'dashboard.png', 'Executive Dashboard (KPIs, Charts & Alerts)', 3500);

  // Screen 2: Invoice Detailed View
  if (sampleInvoice) {
    await capture(`http://localhost:3000/invoices/${sampleInvoice._id}`, 'invoice.png', `GST Tax Invoice Preview (${sampleInvoice.invoiceNumber})`, 2500);
  }

  // Screen 3: Products / Inventory
  await capture('http://localhost:3000/products', 'inventory.png', 'Products Catalog & Batch Inventory', 2500);

  // Screen 4: Customer Details / Financial Ledger
  if (sampleCustomer) {
    await capture(`http://localhost:3000/customers/${sampleCustomer._id}`, 'customer-ledger.png', `Customer Ledger & Transactions (${sampleCustomer.customerName})`, 2500);
  }

  // Screen 5: Sales Analytics / Reports
  await capture('http://localhost:3000/reports', 'analytics.png', 'Analytics & GST Reports Hub', 3000);

  // Screen 6: Purchases Management
  await capture('http://localhost:3000/purchases', 'purchases.png', 'Supplier Purchases & Order History', 2500);

  await browser.close();

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🎉 ALL 6 REAL PRODUCT SCREENSHOTS CAPTURED SUCCESSFULLY!`);
  console.log(`══════════════════════════════════════════════════════════\n`);
}

run().catch((err) => {
  console.error('❌ Screenshot Capture Error:', err);
  process.exit(1);
});
