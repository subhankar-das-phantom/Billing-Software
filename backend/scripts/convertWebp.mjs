import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imgDir = path.resolve(__dirname, '../../frontend/public/landing/product');

const files = [
  'dashboard.png',
  'invoice.png',
  'inventory.png',
  'customer-ledger.png',
  'analytics.png',
  'purchases.png',
];

/**
 * Centralized Mobile Crop Configurations for 2880×1800 Source Screenshots.
 * All crops maintain a strict 16:10 aspect ratio to guarantee zero CLS layout stability.
 * Each configuration focuses tightly on high-value data surfaces, eliminating desktop navigation chrome.
 */
const MOBILE_CROPS = {
  // Focuses on the primary KPI metrics row, comparative trend graph, and cash flow donut chart
  dashboard: {
    x: 520,
    y: 200,
    width: 2320,
    height: 1450,
  },
  // Frames payment summary, copy mode control, and statutory tax invoice details with customer GSTIN and itemized product lines
  invoice: {
    x: 540,
    y: 540,
    width: 2000,
    height: 1250,
  },
  // Focuses on catalog status counters and itemized inventory table showing HSN codes, MRP, rates, and stock units
  inventory: {
    x: 520,
    y: 200,
    width: 2320,
    height: 1450,
  },
  // Captures customer profile card, contact details, GSTIN, outstanding balance metrics, and chronological invoice ledger entries
  'customer-ledger': {
    x: 520,
    y: 200,
    width: 2320,
    height: 1450,
  },
  // Focuses on executive intelligence hub header, analytics tab selector, revenue/collection KPI cards, and sales trend curve
  analytics: {
    x: 520,
    y: 200,
    width: 2320,
    height: 1450,
  },
  // Isolates procurement metrics counters, search filters, and supplier purchase orders table with line items, spend amounts, and settlement status
  purchases: {
    x: 520,
    y: 200,
    width: 2320,
    height: 1450,
  },
};

/**
 * Environment-Safe Portable Browser Discovery.
 * Prioritizes environment variables, native discovery tools (where/which), and standard candidate paths.
 */
async function resolveBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  // Check Puppeteer bundled executable if available
  try {
    if (typeof puppeteer.executablePath === 'function') {
      const p = await Promise.resolve(puppeteer.executablePath()).catch(() => null);
      if (p && typeof p === 'string' && fs.existsSync(p)) return p;
    }
  } catch {
    // Continue to platform-native discovery
  }

  // Native CLI discovery
  if (process.platform === 'win32') {
    for (const cmd of ['where.exe chrome', 'where.exe msedge']) {
      try {
        const out = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
        if (out && fs.existsSync(out)) return out;
      } catch {
        // Continue to fallback candidates
      }
    }
  } else {
    for (const cmd of ['which google-chrome', 'which google-chrome-stable', 'which chromium', 'which chromium-browser']) {
      try {
        const out = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
        if (out && fs.existsSync(out)) return out;
      } catch {
        // Continue to fallback candidates
      }
    }
  }

  // Fallback candidate paths
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error('No supported Chrome or Chromium executable found in current environment.');
}

function calculateChecksum(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function main() {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🖼️  BHARAT ENTERPRISE RESPONSIVE WEBP SHOWCASE COMPOSER`);
  console.log(`══════════════════════════════════════════════════════════`);

  const browserPath = await resolveBrowserExecutable();
  console.log(`🌐 Resolved Browser Executable: ${browserPath}`);
  console.log(`📂 Output Directory: ${imgDir}`);

  // 1. Calculate & record pre-generation checksums for original PNG source captures
  console.log(`\n🔒 Baseline PNG Checksum Verification:`);
  const initialChecksums = {};
  for (const file of files) {
    const filePath = path.join(imgDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Critical source screenshot missing: ${filePath}`);
    }
    const hash = calculateChecksum(filePath);
    initialChecksums[file] = hash;
    console.log(`  - ${file}: ${hash.substring(0, 16)}... [OK]`);
  }

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  console.log(`\n⚙️  Composing & Rendering Three-Tier WebP Assets:`);

  for (const file of files) {
    const filePath = path.join(imgDir, file);
    const baseName = path.basename(file, '.png');
    const crop = MOBILE_CROPS[baseName];

    if (!crop) {
      console.warn(`⚠️ Warning: No mobile crop configuration found for ${baseName}, using full canvas.`);
    }

    const base64 = fs.readFileSync(filePath).toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;

    // ─────────────────────────────────────────────────────────────
    // Tier 1: Desktop WebP (1920×1200 full application context, quality 0.84)
    // ─────────────────────────────────────────────────────────────
    const desktopWebp = await page.evaluate(async (uri) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 1920 / img.naturalWidth);
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', 0.84));
        };
        img.src = uri;
      });
    }, dataUri);

    const desktopBuffer = Buffer.from(desktopWebp.split(',')[1], 'base64');
    const desktopOutPath = path.join(imgDir, `${baseName}.webp`);
    fs.writeFileSync(desktopOutPath, desktopBuffer);

    // ─────────────────────────────────────────────────────────────
    // Tier 2: Mobile WebP (1080×675 focused crop for high-DPR screens, quality 0.86)
    // ─────────────────────────────────────────────────────────────
    const mobileWebp = await page.evaluate(async (uri, c) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 675; // Strict 16:10 ratio
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (c) {
            ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, 1080, 675);
          } else {
            ctx.drawImage(img, 0, 0, 1080, 675);
          }

          resolve(canvas.toDataURL('image/webp', 0.86));
        };
        img.src = uri;
      });
    }, dataUri, crop);

    const mobileBuffer = Buffer.from(mobileWebp.split(',')[1], 'base64');
    const mobileOutPath = path.join(imgDir, `${baseName}-mobile.webp`);
    fs.writeFileSync(mobileOutPath, mobileBuffer);

    // ─────────────────────────────────────────────────────────────
    // Tier 3: Small-Mobile Fallback WebP (720×450 focused crop, quality 0.84)
    // ─────────────────────────────────────────────────────────────
    const smWebp = await page.evaluate(async (uri, c) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 720;
          canvas.height = 450; // Strict 16:10 ratio
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (c) {
            ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, 720, 450);
          } else {
            ctx.drawImage(img, 0, 0, 720, 450);
          }

          resolve(canvas.toDataURL('image/webp', 0.84));
        };
        img.src = uri;
      });
    }, dataUri, crop);

    const smBuffer = Buffer.from(smWebp.split(',')[1], 'base64');
    const smOutPath = path.join(imgDir, `${baseName}-sm.webp`);
    fs.writeFileSync(smOutPath, smBuffer);

    const origKb = (fs.statSync(filePath).size / 1024).toFixed(1);
    const deskKb = (desktopBuffer.length / 1024).toFixed(1);
    const mobKb = (mobileBuffer.length / 1024).toFixed(1);
    const smKb = (smBuffer.length / 1024).toFixed(1);

    console.log(`  ✅ ${baseName}: Desktop (1920×1200): ${deskKb} KB | Mobile (1080×675): ${mobKb} KB | Small (720×450): ${smKb} KB (from ${origKb} KB PNG)`);
  }

  await browser.close();

  // 2. Recalculate and assert PNG checksum invariance
  console.log(`\n🔒 Post-Generation Source PNG Integrity Audit:`);
  let allIntact = true;
  for (const file of files) {
    const filePath = path.join(imgDir, file);
    const postHash = calculateChecksum(filePath);
    const preHash = initialChecksums[file];
    if (postHash !== preHash) {
      console.error(`  ❌ INTEGRITY VIOLATION: ${file} checksum mutated!`);
      allIntact = false;
    } else {
      console.log(`  ✓ ${file}: Checksum verified immutable (${postHash.substring(0, 16)}...)`);
    }
  }

  if (!allIntact) {
    throw new Error('Source PNG integrity check failed! Source captures must never be modified.');
  }

  console.log(`\n✨ All responsive WebP derivatives generated successfully with 100% source PNG integrity preserved.`);
  console.log(`══════════════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error('❌ Asset Conversion Error:', err);
  process.exit(1);
});
