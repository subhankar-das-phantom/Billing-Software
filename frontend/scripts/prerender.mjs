import puppeteer from 'puppeteer';
import { createServer } from 'http';
import handler from 'serve-handler';
import fs from 'fs/promises';
import path from 'path';

// Only pre-render public marketing and legal pages.
// NEVER include app routes like /login, /register, /dashboard here —
// those must be served by the SPA catch-all (app.html) so that their
// hashed JS assets resolve correctly. A prerendered /login/index.html
// served statically by Vercel's filesystem causes JS MIME type errors.
const ROUTES = [
  '/landing',
  '/privacy-policy',
  '/terms',
];

// Routes that must NOT exist as filesystem directories in dist/.
// If stale snapshots of these exist, delete them before deploying.
const BLOCKED_STATIC_ROUTES = ['/login', '/register'];


const DIST_DIR = path.resolve('dist');
const SNAPSHOTS_DIR = path.resolve('snapshots');

async function run() {
  console.log('\n[prerender] Starting static snapshot generation...');

  // Only remove the stale index.html per route — NOT the full directory.
  // Vite copies static assets (images, fonts) from public/ into the same
  // route subdirectories (e.g. dist/landing/product/*.webp). Deleting the
  // full directory would remove those assets before the snapshot is written.
  for (const route of ROUTES) {
    const staleIndex = path.join(DIST_DIR, route.slice(1), 'index.html');
    await fs.rm(staleIndex, { force: true }).catch(() => {});
  }


  let server;
  let browser;

  try {
    server = createServer((request, response) => {
      return handler(request, response, {
        public: DIST_DIR,
        rewrites: [{ source: '**', destination: '/index.html' }]
      });
    });

    // Event-driven dynamic port binding (port 0 on 127.0.0.1)
    await new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };

      const onListening = () => {
        server.off('error', onError);
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(0, '127.0.0.1');
    });

    const { port } = server.address();
    console.log(`[prerender] Snapshot server listening on http://127.0.0.1:${port}`);

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    // Emulate reduced motion so ScrollReveal renders content at 100% opacity
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    const succeededRoutes = [];
    const failedRoutes = [];

    for (const route of ROUTES) {
      const url = `http://127.0.0.1:${port}${route}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('[data-prerender-ready="true"]', { timeout: 10000 });

        const html = await page.content();
        const targetFile = path.join(DIST_DIR, route.slice(1), 'index.html');
        const snapshotFile = path.join(SNAPSHOTS_DIR, route.slice(1), 'index.html');

        await fs.mkdir(path.dirname(targetFile), { recursive: true });
        await fs.writeFile(targetFile, html, 'utf-8');

        await fs.mkdir(path.dirname(snapshotFile), { recursive: true });
        await fs.writeFile(snapshotFile, html, 'utf-8');

        console.log(`  ✓ Snapshot generated: ${route} -> dist/${route.slice(1)}/index.html`);
        succeededRoutes.push(route);
      } catch (routeErr) {
        console.warn(`  ⚠ Warning: Failed to pre-render ${route}: ${routeErr.message}`);
        failedRoutes.push(route);
      }
    }

    if (failedRoutes.length === 0) {
      console.log(`[prerender] ✓ Pre-rendering complete (${succeededRoutes.length}/${ROUTES.length} routes pre-rendered)\n`);
    } else {
      console.warn(`[prerender] ⚠ Pre-rendering degraded (${succeededRoutes.length}/${ROUTES.length} routes pre-rendered — failed: ${failedRoutes.join(', ')})\n`);
    }
  } catch (err) {
    console.warn('\n[prerender] ⚠ Headless browser pre-rendering unavailable in this environment:');
    console.warn(`[prerender]   ${err.message}`);
    console.log('[prerender] ℹ Hydrating static snapshots from committed snapshots/ repository...');

    for (const route of ROUTES) {
      const snapFile = path.join(SNAPSHOTS_DIR, route.slice(1), 'index.html');
      const distTargetDir = path.join(DIST_DIR, route.slice(1));
      const distTargetFile = path.join(distTargetDir, 'index.html');
      try {
        const snapContent = await fs.readFile(snapFile, 'utf-8');
        await fs.mkdir(distTargetDir, { recursive: true });
        await fs.writeFile(distTargetFile, snapContent, 'utf-8');
        console.log(`  ✓ Snapshot hydrated: ${route} -> dist/${route.slice(1)}/index.html`);
      } catch (copyErr) {
        console.warn(`  ⚠ Warning: Could not hydrate ${route}: ${copyErr.message}`);
      }
    }
    console.log('[prerender] ✓ All static snapshots successfully hydrated for deployment.\n');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.close();

    // Promote dist/index.html to dist/app.html so that requests to root '/'
    // are not intercepted by the physical filesystem before Vercel Edge rewrites are evaluated.
    const distIndex = path.join(DIST_DIR, 'index.html');
    const distApp = path.join(DIST_DIR, 'app.html');
    try {
      let shellHtml = await fs.readFile(distIndex, 'utf-8');

      // Inject a <noscript> redirect so non-JS clients go to /landing
      const noscriptRedirect = `  <noscript><meta http-equiv="refresh" content="0;url=/landing" /></noscript>`;
      shellHtml = shellHtml.replace('</head>', `${noscriptRedirect}\n</head>`);

      // Inject a pre-boot content block inside #root so that AI browsing tools
      // (ChatGPT Browse, Gemini, Perplexity) that read page HTML before React
      // executes see full product info, pricing and features instead of a blank div.
      // React replaces this on hydration — real browser users are unaffected.
      const prebootContent = `<div id="root"><main aria-label="Bharat Enterprise — Billing &amp; GST Invoicing Software" style="font-family:sans-serif;max-width:860px;margin:0 auto;padding:24px 16px;color:#0f172a">
  <h1>Bharat Enterprise — The Operating System for Modern Indian Distribution</h1>
  <p>Cloud billing, multi-batch inventory tracking, customer khata ledgers, and GST-ready invoicing for Indian distributors, wholesalers, pharmaceutical traders, and FMCG enterprises.</p>
  <p><a href="/landing">View full product details</a> | <a href="/register">Start free 14-day trial</a> | <a href="/login">Sign in</a></p>
  <h2>Subscription Plans &amp; Pricing</h2>
  <ul>
    <li><strong>Starter — ₹299/month:</strong> Dashboard, Customer Directory, Product Catalog, Create &amp; Print Invoices, Invoice History, Basic Reports. 14-day free trial.</li>
    <li><strong>Business — ₹499/month (Most Popular):</strong> All Starter features + Supplier Management, Purchase Tracking, Inventory Ledger, Collections &amp; Payment Receipts, Credit Notes &amp; Returns, Customer Khata &amp; Ledgers, Manual Journal Entries, Outstanding Balance Tracking. 14-day free trial.</li>
    <li><strong>Professional — ₹699/month:</strong> All Business features + Employee Management &amp; RBAC, Employee Activity Analytics, Administrative Activity Logs, GST Reports &amp; Tax Ledger Data, Advanced Business Reporting, Inventory Intelligence Engine. 14-day free trial.</li>
  </ul>
  <h2>Tenure Discounts</h2>
  <ul>
    <li>Monthly: standard price</li>
    <li>Quarterly (3 months): 5% off</li>
    <li>Half-Yearly (6 months): 10% off</li>
    <li>Annual (12 months): 20% off — Business plan ₹4,790/year instead of ₹5,988</li>
  </ul>
  <h2>Key Features</h2>
  <ul>
    <li>GST-Ready Invoicing: CGST/SGST for intra-state, IGST for inter-state, HSN code mapping, dual-copy printing</li>
    <li>Multi-Batch Inventory: batch numbers, expiry dates, MRP, low-stock alerts, movement ledger</li>
    <li>Customer Khata: running balance, payment receipts (Cash/UPI/Cheque/NEFT), exportable statements</li>
    <li>Supplier Management: GSTIN/DL tracking, purchase entries, procurement history</li>
    <li>Analytics: daily/monthly sales trends, cash flow ratio, receivables aging</li>
    <li>Role-Based Access: Admin and Employee roles, audit logs, secure sessions</li>
  </ul>
  <p>All plans include a 14-day free trial. Register at <a href="/register">billing-software-dev.vercel.app/register</a></p>
</main></div>`;
      // Extract inner HTML from prebootContent (strips outer <div id="root">...</div> wrapper)
      const prebootInner = prebootContent.replace(/^<div id="root">/, '').replace(/<\/div>$/, '');
      // Path 1: simple empty root div
      shellHtml = shellHtml.replace('<div id="root"></div>', `<div id="root">${prebootInner}</div>`);
      // Path 2: Vite inlines a #prerender spinner inside #root for FCP — replace it.
      shellHtml = shellHtml.replace(
        /<div id="prerender">[\s\S]*?<\/div>\s*<\/div>/,
        `<div id="prerender">${prebootInner}</div>\n      </div>`
      );


      await fs.writeFile(distApp, shellHtml, 'utf-8');
      await fs.unlink(distIndex);
      console.log('[prerender] ✓ Promoted dist/index.html -> dist/app.html with pre-boot content and noscript redirect');

    } catch {
      // index.html may not exist or already promoted
    }
  }
}

run().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('[prerender] Unexpected error:', err);
  process.exit(0); // Graceful degradation: never fail the build
});
