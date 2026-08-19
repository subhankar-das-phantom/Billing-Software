import { useState, useEffect, useRef, useCallback } from 'react';

// Build the SSE base URL from the same env var that api.js uses.
// VITE_API_URL is e.g. "https://billing-software-1-tbdx.onrender.com/api"
// For SSE we need the stock-events path under that same origin.
const API_URL = import.meta.env.VITE_API_URL || '/api';

// ── Reconnection constants ──────────────────────────────────────────────────
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 30000;

/**
 * useStockSSE — Real-time stock synchronization via Server-Sent Events.
 *
 * Manages the EventSource connection lifecycle, version tracking, and
 * reconnection handling. Uses manual reconnection with exponential backoff
 * instead of EventSource's uncontrolled built-in retry.
 *
 * Client-side product filtering happens in the consumer (InvoiceCreatePage),
 * NOT in this hook.
 *
 * @param {Object} options
 * @param {(updates: Array<{productId: string, currentStockQty: number, stockVersion: number}>) => void} options.onStockUpdate
 *   Called with stock updates that passed version check.
 * @param {() => void} options.onReconnect
 *   Called when SSE reconnects after a disconnection.
 * @param {boolean} [options.enabled=true]
 *   Whether the SSE connection should be active.
 * @returns {{ connectionState: 'connected'|'disconnected'|'connecting', applyVersions: (versions: Object) => void }}
 */
export function useStockSSE({ onStockUpdate, onReconnect, enabled = true }) {
  const [connectionState, setConnectionState] = useState('disconnected');

  // Version map lives in a ref (not state) — changes don't cause renders
  const versionMapRef = useRef(new Map());

  // Track whether we've ever been connected (to detect reconnections)
  const wasConnectedRef = useRef(false);

  // Reconnection tracking refs
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const gaveUpRef = useRef(false);

  // Stable refs for callbacks so the EventSource listeners don't go stale
  const onStockUpdateRef = useRef(onStockUpdate);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onStockUpdateRef.current = onStockUpdate;
  }, [onStockUpdate]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  /**
   * Seed or update the version map from a fetch/reconciliation result.
   * Only updates a product's version if the new version is greater.
   * @param {Object} versions — { [productId]: stockVersion }
   */
  const applyVersions = useCallback((versions) => {
    const map = versionMapRef.current;
    for (const [productId, version] of Object.entries(versions)) {
      const current = map.get(productId) || 0;
      if (version > current) {
        map.set(productId, version);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnectionState('disconnected');
      return;
    }

    // Track whether this effect is still active (for cleanup races)
    let cancelled = false;

    /**
     * Create and wire up a new EventSource connection.
     * Closes itself on error and schedules a manual reconnect with backoff.
     */
    function connect() {
      if (cancelled) return;

      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('[useStockSSE] No auth token found — skipping SSE connection');
        setConnectionState('disconnected');
        return;
      }

      setConnectionState('connecting');

      const sseUrl = `${API_URL}/stock-events/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener('connected', (event) => {
        if (cancelled) return;
        console.log('[useStockSSE] SSE connected', event.data);

        // Reset retry state on successful connection
        retryCountRef.current = 0;
        gaveUpRef.current = false;

        const isReconnect = wasConnectedRef.current;
        wasConnectedRef.current = true;
        setConnectionState('connected');

        if (isReconnect && onReconnectRef.current) {
          onReconnectRef.current();
        }
      });

      es.addEventListener('stock-updated', (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          const updates = data.updates;
          if (!Array.isArray(updates) || updates.length === 0) return;

          console.log('[useStockSSE] Received stock update:', updates);

          // Pass all updates (version filtering bypassed for now)
          if (onStockUpdateRef.current) {
            onStockUpdateRef.current(updates);
          }
        } catch (err) {
          console.error('[useStockSSE] Error parsing stock-updated event:', err);
        }
      });

      es.addEventListener('error', () => {
        if (cancelled) return;

        // Close immediately to prevent EventSource's built-in auto-reconnect
        es.close();
        eventSourceRef.current = null;
        setConnectionState('disconnected');

        // Schedule manual reconnect with exponential backoff
        scheduleReconnect();
      });
    }

    /**
     * Schedule a reconnect attempt with exponential backoff.
     * Gives up after MAX_RETRIES to prevent infinite console spam.
     */
    function scheduleReconnect() {
      if (cancelled) return;

      const attempt = retryCountRef.current;

      if (attempt >= MAX_RETRIES) {
        if (!gaveUpRef.current) {
          console.warn(
            `[useStockSSE] Gave up after ${MAX_RETRIES} failed attempts. ` +
            'Stock updates will not be real-time until page reload.'
          );
          gaveUpRef.current = true;
        }
        return;
      }

      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
      retryCountRef.current = attempt + 1;

      console.log(
        `[useStockSSE] Reconnecting in ${(delay / 1000).toFixed(1)}s ` +
        `(attempt ${attempt + 1}/${MAX_RETRIES})`
      );

      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        connect();
      }, delay);
    }

    // Start the initial connection
    connect();

    // Cleanup: close EventSource and cancel any pending retry timer
    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnectionState('disconnected');
    };
  }, [enabled]);

  return { connectionState, applyVersions };
}
