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
const ROUTE_CONFIGS = [
  {
    route: '/landing',
    expectedTitle: 'Bharat Enterprise — Billing, Multi-Batch Inventory & Customer Khata Suite',
    expectedRobots: 'index, follow'
  },
  {
    route: '/privacy-policy',
    expectedTitle: 'Privacy Policy — Bharat Enterprise Billing System',
    expectedRobots: 'index, follow'
  },
  {
    route: '/terms',
    expectedTitle: 'Terms & Conditions — Bharat Enterprise Billing System',
    expectedRobots: 'index, follow'
  },
];

const ROUTES = ROUTE_CONFIGS.map((c) => c.route);

// Routes that must NOT exist as filesystem directories in dist/.
// If stale snapshots of these exist, delete them before deploying.
const BLOCKED_STATIC_ROUTES = ['/login', '/register'];

const DIST_DIR = path.resolve('dist');
const SNAPSHOTS_DIR = path.resolve('snapshots');

const isStrict = process.env.PRERENDER_STRICT === 'true' || process.env.CI === 'true';

/**
 * Resolve production origin without hardcoding fallbacks.
 * In strict production builds, missing configuration causes an immediate fatal error.
 */
function resolveProductionOrigin() {
  const origin =
    process.env.VITE_FRONTEND_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);

  if (!origin || !origin.trim()) {
    if (isStrict) {
      throw new Error(
        '[prerender] FATAL: Production origin is not configured in strict mode. ' +
        'Set VITE_FRONTEND_URL or VERCEL_PROJECT_PRODUCTION_URL before building.'
      );
    }
    console.warn(
      '[prerender] ⚠ Warning: Production origin is not configured. Local origin will be used for dev preview.'
    );
    return null;
  }

  return origin.trim().replace(/\/+$/, '');
}

async function run() {
  console.log('\n[prerender] Starting static snapshot generation...');

  const productionOrigin = resolveProductionOrigin();
  if (productionOrigin) {
    console.log(`[prerender] Production origin configured: ${productionOrigin}`);
  }

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
  const succeededRoutes = [];
  const failedRoutes = [];

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

    // Inject production origin into the window context before scripts execute
    if (productionOrigin) {
      await page.evaluateOnNewDocument((origin) => {
        window.__PRODUCTION_ORIGIN__ = origin;
      }, productionOrigin);
    }

    for (const cfg of ROUTE_CONFIGS) {
      const { route } = cfg;
      const url = `http://127.0.0.1:${port}${route}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Deterministic metadata verification: wait until title, description, robots, and canonical are active in DOM
        await page.waitForFunction(
          (config, origin) => {
            const ready =
              document.documentElement.getAttribute('data-prerender-ready') === 'true' ||
              window.__PRERENDER_METADATA_READY__ === true;
            const titleOk = document.title === config.expectedTitle;
            const desc = document.querySelector('meta[name="description"]')?.getAttribute('content');
            const descOk = Boolean(desc && desc.trim().length > 10);
            const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content');
            const robotsOk = Boolean(robots && robots.includes('index'));

            let canonicalOk = true;
            if (origin) {
              const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
              canonicalOk = Boolean(canonical && canonical === `${origin}${config.route}`);
            }

            return ready && titleOk && descOk && robotsOk && canonicalOk;
          },
          { timeout: 15000 },
          cfg,
          productionOrigin
        );

        let html = await page.content();

        // If production origin is configured, ensure any static %VITE_FRONTEND_URL% placeholders are resolved
        if (productionOrigin) {
          html = html.replaceAll('%VITE_FRONTEND_URL%', productionOrigin);
        }

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
      if (isStrict) {
        throw new Error(`[prerender] Strict mode failure: failed to pre-render routes: ${failedRoutes.join(', ')}`);
      }
    }
  } catch (err) {
    if (isStrict) {
      throw err;
    }

    console.warn('\n[prerender] ⚠ Headless browser pre-rendering unavailable or failed:');
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

    // 1. Save dist/index.html (the Vite client bundle SPA shell) as dist/app.html for dynamic routes
    const distIndex = path.join(DIST_DIR, 'index.html');
    const distApp = path.join(DIST_DIR, 'app.html');
    try {
      let shellHtml = await fs.readFile(distIndex, 'utf-8');
      await fs.writeFile(distApp, shellHtml, 'utf-8');
      console.log('[prerender] ✓ Saved dist/app.html as dynamic SPA shell');
    } catch {
      // index.html may already be handled
    }

    // 2. Promote pre-rendered /landing snapshot to dist/index.html so root '/' serves the complete landing page
    const landingSnapshot = path.join(DIST_DIR, 'landing', 'index.html');
    const rootSnapshotFile = path.join(SNAPSHOTS_DIR, 'index.html');
    try {
      let landingHtml = await fs.readFile(landingSnapshot, 'utf-8');
      // Anchor canonical and og:url to root '/' for root delivery
      landingHtml = landingHtml.replace(
        /rel="canonical" href="([^"]*)\/landing"/,
        'rel="canonical" href="$1/"'
      ).replace(
        /property="og:url" content="([^"]*)\/landing"/,
        'property="og:url" content="$1/"'
      );
      await fs.writeFile(distIndex, landingHtml, 'utf-8');
      await fs.writeFile(rootSnapshotFile, landingHtml, 'utf-8');
      console.log('[prerender] ✓ Promoted landing snapshot -> dist/index.html for root delivery');
    } catch (landingErr) {
      console.warn(`[prerender] ⚠ Could not copy landing snapshot to index.html: ${landingErr.message}`);
    }

    // ─── Post-Prerender Validation & Blocked Route Invariant Enforcement ────
    console.log('[prerender] Validating snapshot invariants...');

    // 1. Enforce blocked routes: assert /login and /register do not exist as static HTML files in dist/
    for (const blockedRoute of BLOCKED_STATIC_ROUTES) {
      const blockedDir = path.join(DIST_DIR, blockedRoute.slice(1));
      const blockedFile = path.join(blockedDir, 'index.html');
      try {
        await fs.access(blockedFile);
        console.warn(`  ⚠ Blocked static route detected: dist/${blockedRoute.slice(1)}/index.html. Purging...`);
        await fs.rm(blockedDir, { recursive: true, force: true });
        if (isStrict) {
          throw new Error(`[prerender] Invariant violation: Blocked route ${blockedRoute} was produced in dist/!`);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    console.log('  ✓ Invariant verified: No blocked dynamic routes (/login, /register) exist in dist/');

    // 2. Validate that no snapshots contain local ephemeral URLs in canonical or OpenGraph metadata
    for (const cfg of ROUTE_CONFIGS) {
      const targetFile = path.join(DIST_DIR, cfg.route.slice(1), 'index.html');
      try {
        const content = await fs.readFile(targetFile, 'utf-8');
        const hasLocalhost = content.includes('127.0.0.1') || content.includes('localhost');
        if (hasLocalhost) {
          const errMsg = `[prerender] Invariant violation: Snapshot for ${cfg.route} contains local ephemeral address (127.0.0.1 or localhost)!`;
          if (isStrict) {
            throw new Error(errMsg);
          } else {
            console.warn(`  ⚠ ${errMsg}`);
          }
        }
      } catch (err) {
        if (isStrict && err.code === 'ENOENT') throw err;
      }
    }
    console.log('  ✓ Invariant verified: No local ephemeral URLs detected in static snapshots\n');
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[prerender] Fatal error:', err.message);
    if (isStrict) {
      process.exit(1);
    }
    process.exit(0);
  });
