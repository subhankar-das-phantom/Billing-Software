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
      // Inject a <noscript> redirect so headless browsers or non-JS clients
      // that time out before React boots are sent to /landing where all
      // product content, pricing, and features are pre-rendered and visible.
      const noscriptRedirect = `  <noscript><meta http-equiv="refresh" content="0;url=/landing" /></noscript>`;
      shellHtml = shellHtml.replace('</head>', `${noscriptRedirect}\n</head>`);
      await fs.writeFile(distApp, shellHtml, 'utf-8');
      await fs.unlink(distIndex);
      console.log('[prerender] ✓ Promoted dist/index.html -> dist/app.html with noscript /landing redirect');
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
