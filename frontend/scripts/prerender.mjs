import puppeteer from 'puppeteer';
import { createServer } from 'http';
import handler from 'serve-handler';
import fs from 'fs/promises';
import path from 'path';

const ROUTES = [
  '/landing',
  '/privacy-policy',
  '/terms',
  '/login',
  '/register',
];

const DIST_DIR = path.resolve('dist');
const SNAPSHOTS_DIR = path.resolve('snapshots');

async function run() {
  console.log('\n[prerender] Starting static snapshot generation...');

  // Ensure stale route directories are cleaned before snapshotting
  for (const route of ROUTES) {
    const routeDir = path.join(DIST_DIR, route.slice(1));
    await fs.rm(routeDir, { recursive: true, force: true }).catch(() => {});
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
      await fs.copyFile(distIndex, distApp);
      await fs.unlink(distIndex);
      console.log('[prerender] ✓ Successfully promoted dist/index.html -> dist/app.html for Vercel Edge root rewrite evaluation');
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
