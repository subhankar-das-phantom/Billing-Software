import fs from 'fs';
import path from 'path';
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
  'purchases.png'
];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  for (const file of files) {
    const filePath = path.join(imgDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${file}: not found`);
      continue;
    }

    const base64 = fs.readFileSync(filePath).toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;

    // Convert to Desktop WebP (1920 max width, quality 84)
    const baseName = path.basename(file, '.png');
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

    // Convert to Mobile WebP (1080 width for Retina/OLED mobile viewports, quality 84)
    const mobileWebp = await page.evaluate(async (uri) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 1080 / img.naturalWidth);
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

    const mobileBuffer = Buffer.from(mobileWebp.split(',')[1], 'base64');
    const mobileOutPath = path.join(imgDir, `${baseName}-mobile.webp`);
    fs.writeFileSync(mobileOutPath, mobileBuffer);

    // Convert to Small Mobile WebP (720 width fallback, quality 82)
    const smWebp = await page.evaluate(async (uri) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 720 / img.naturalWidth);
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', 0.82));
        };
        img.src = uri;
      });
    }, dataUri);

    const smBuffer = Buffer.from(smWebp.split(',')[1], 'base64');
    const smOutPath = path.join(imgDir, `${baseName}-sm.webp`);
    fs.writeFileSync(smOutPath, smBuffer);

    const origSize = (fs.statSync(filePath).size / 1024).toFixed(1);
    const deskSize = (desktopBuffer.length / 1024).toFixed(1);
    const mobSize = (mobileBuffer.length / 1024).toFixed(1);
    const smSize = (smBuffer.length / 1024).toFixed(1);

    console.log(`✅ ${file}: ${origSize} KB -> Desktop: ${deskSize} KB | Mobile (1080p): ${mobSize} KB | Fallback (720p): ${smSize} KB (-${(100 - (mobSize/origSize)*100).toFixed(0)}%)`);
  }

  await browser.close();
}

main().catch(console.error);
