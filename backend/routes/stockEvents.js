const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const getTenantId = require('../utils/getTenantId');
const stockChangeStream = require('../services/stockChangeStream');

/**
 * GET /api/stock-events/stream
 * 
 * Server-Sent Events endpoint for real-time stock updates.
 * 
 * - Protected by cookie-based JWT authentication
 * - Long-lived HTTP response (text/event-stream)
 * - Per-user connection limit enforced by the stockChangeStream service
 * - No rate limiter — SSE is a single long-lived connection
 * 
 * Events sent:
 *   event: connected       — initial connection confirmation
 *   event: stock-updated   — { updates: [{ productId, currentStockQty, stockVersion }] }
 *   event: heartbeat       — keepalive every 30s
 */
router.get('/stream', protect, (req, res) => {
  const tenantId = getTenantId(req).toString();
  const userId = req.user._id.toString();

  // Set SSE headers using Express API (preserves cors/helmet headers)
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // Disable Nginx buffering if behind reverse proxy
  });

  // Flush headers immediately — critical for SSE through proxies (Vite dev server)
  res.flushHeaders();

  // Register client with connection limit
  const registered = stockChangeStream.addClient(tenantId, userId, res);
  if (!registered) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'Too many active connections' })}\n\n`);
    res.end();
    return;
  }

  console.log(`[SSE] Client connected: tenant=${tenantId} user=${userId}`);

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ tenantId, timestamp: new Date().toISOString() })}\n\n`);

  // Clean up on client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected: tenant=${tenantId} user=${userId}`);
    stockChangeStream.removeClient(tenantId, res);
  });
});

module.exports = router;
