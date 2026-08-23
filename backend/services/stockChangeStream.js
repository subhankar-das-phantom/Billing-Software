const mongoose = require('mongoose');
const Product = require('../models/Product');

/**
 * Stock Change Stream Service
 * 
 * Uses MongoDB Change Streams as the authoritative event source for stock changes.
 * Controllers never emit SSE events — they only perform atomic DB writes.
 * The Change Stream detects committed changes and routes them to SSE clients.
 * 
 * Architecture:
 *   MongoDB committed change → Change Stream → SSE Client Manager → Browser
 * 
 * Single-process: one Change Stream per Node.js process.
 * Multi-process: each process opens its own Change Stream (no Redis needed).
 */

// ── SSE Client Registry ─────────────────────────────────────────────────────

/** @type {Map<string, Set<import('http').ServerResponse>>} tenantId → Set of SSE response objects */
const clientsByTenant = new Map();

/** @type {Map<string, number>} userId → number of active SSE connections */
const connectionCountByUser = new Map();

const MAX_CONNECTIONS_PER_USER = 3;
const HEARTBEAT_INTERVAL_MS = 30_000;

let heartbeatTimer = null;
let changeStream = null;

/**
 * Register an SSE client for a tenant.
 * @param {string} tenantId
 * @param {string} userId
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true if registered, false if connection limit reached
 */
function addClient(tenantId, userId, res) {
  const currentCount = connectionCountByUser.get(userId) || 0;
  if (currentCount >= MAX_CONNECTIONS_PER_USER) {
    return false;
  }

  if (!clientsByTenant.has(tenantId)) {
    clientsByTenant.set(tenantId, new Set());
  }
  clientsByTenant.get(tenantId).add(res);
  connectionCountByUser.set(userId, currentCount + 1);

  // Store userId on the response for cleanup
  res._sseUserId = userId;

  return true;
}

/**
 * Remove an SSE client when they disconnect.
 * @param {string} tenantId
 * @param {import('http').ServerResponse} res
 */
function removeClient(tenantId, res) {
  const clients = clientsByTenant.get(tenantId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      clientsByTenant.delete(tenantId);
    }
  }

  // Decrement user connection count
  const userId = res._sseUserId;
  if (userId) {
    const count = connectionCountByUser.get(userId) || 0;
    if (count <= 1) {
      connectionCountByUser.delete(userId);
    } else {
      connectionCountByUser.set(userId, count - 1);
    }
  }
}

/**
 * Send an SSE event to a specific client.
 * If the write fails, the client is silently removed.
 */
function sendEvent(res, eventName, data) {
  try {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    // Client likely disconnected — will be cleaned up by req.on('close')
  }
}

/**
 * Broadcast a stock update to all SSE clients for a tenant.
 * @param {string} tenantId
 * @param {Array<{productId: string, currentStockQty: number, stockVersion: number}>} updates
 */
function broadcastToTenant(tenantId, updates) {
  const clients = clientsByTenant.get(tenantId);
  if (!clients || clients.size === 0) return;

  console.log(`[StockChangeStream] Broadcasting to tenant ${tenantId}: ${clients.size} client(s)`, 
    updates.map(u => `${u.productId} → qty=${u.currentStockQty} v=${u.stockVersion}`).join(', '));

  for (const res of clients) {
    sendEvent(res, 'stock-updated', { updates });
  }
}

// ── Heartbeat ────────────────────────────────────────────────────────────────

function startHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    const timestamp = new Date().toISOString();
    for (const [, clients] of clientsByTenant) {
      for (const res of clients) {
        sendEvent(res, 'heartbeat', { timestamp });
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Don't block Node process exit
  heartbeatTimer.unref();
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ── MongoDB Change Stream ────────────────────────────────────────────────────

/**
 * Initialize the MongoDB Change Stream on the Product collection.
 * Must be called after the MongoDB connection is established.
 */
function initialize() {
  if (changeStream) {
    console.log('[StockChangeStream] Already initialized');
    return;
  }

  try {
    // Watch ALL update events on the Product collection.
    // Filtering is done in handleChangeEvent (JavaScript) rather than a pipeline $match,
    // because $match on 'updateDescription.updatedFields.*' paths is unreliable
    // across MongoDB versions and driver combinations.
    changeStream = Product.watch([], {
      fullDocument: 'updateLookup'
    });

    changeStream.on('change', handleChangeEvent);
    changeStream.on('error', handleChangeStreamError);
    changeStream.on('close', () => {
      console.log('[StockChangeStream] Change stream closed');
      changeStream = null;
    });

    startHeartbeat();
    console.log('[StockChangeStream] Initialized successfully — watching Product collection');
  } catch (err) {
    console.error('[StockChangeStream] Failed to initialize:', err.message);
    scheduleReconnect();
  }
}

/**
 * Handle a Change Stream event.
 * Validates the event before broadcasting.
 */
function handleChangeEvent(change) {
  try {
    // Reset reconnect attempts on a successful event
    reconnectAttempts = 0;

    // Only handle update operations (insert/delete/replace are not stock mutations)
    if (change.operationType !== 'update') return;

    const updatedFields = change.updateDescription?.updatedFields || {};

    // Check if currentStockQty was modified (the field we care about)
    const hasStockQtyChange = 'currentStockQty' in updatedFields;
    if (!hasStockQtyChange) return;

    // fullDocument may be null if the document was deleted between the update and the lookup
    const fullDocument = change.fullDocument;
    if (!fullDocument) {
      console.warn('[StockChangeStream] fullDocument is null — document may have been deleted. Skipping.');
      return;
    }

    const tenantId = fullDocument.tenantId?.toString();
    if (!tenantId) {
      console.warn('[StockChangeStream] No tenantId found on document. Skipping.');
      return;
    }

    // Use stockVersion from fullDocument (authoritative), not from updatedFields.
    // updatedFields may not include stockVersion when $inc creates the field for the first time.
    const stockVersion = fullDocument.stockVersion ?? 0;

    const update = {
      productId: fullDocument._id.toString(),
      currentStockQty: fullDocument.currentStockQty,
      stockVersion
    };

    console.log('[StockChangeStream] Stock change detected:', {
      productId: update.productId,
      currentStockQty: update.currentStockQty,
      stockVersion: update.stockVersion,
      tenantId
    });

    broadcastToTenant(tenantId, [update]);
  } catch (err) {
    // Change Stream processing errors must never crash the server
    console.error('[StockChangeStream] Error processing change event:', err.message);
  }
}

/**
 * Handle Change Stream errors.
 * The MongoDB driver handles transient/resumable errors automatically.
 * Non-resumable errors require re-opening the stream.
 */
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 30_000;

function handleChangeStreamError(err) {
  console.error('[StockChangeStream] Error:', err.message);
  changeStream = null;
  scheduleReconnect();
}

function scheduleReconnect() {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
  reconnectAttempts++;

  console.log(`[StockChangeStream] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`);

  setTimeout(() => {
    if (mongoose.connection.readyState === 1) {
      console.log('[StockChangeStream] Attempting to re-open change stream...');
      initialize();
    } else {
      console.log('[StockChangeStream] MongoDB not connected — waiting...');
      scheduleReconnect();
    }
  }, delay);
}

/**
 * Gracefully close the Change Stream and clean up resources.
 */
async function shutdown() {
  stopHeartbeat();
  if (changeStream) {
    try {
      await changeStream.close();
    } catch (err) {
      // Ignore close errors during shutdown
    }
    changeStream = null;
  }
  console.log('[StockChangeStream] Shut down');
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  initialize,
  shutdown,
  addClient,
  removeClient
};
