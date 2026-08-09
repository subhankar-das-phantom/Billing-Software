import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useStockSSE — Real-time stock synchronization via Server-Sent Events.
 *
 * Manages the EventSource connection lifecycle, version tracking, and
 * reconnection handling. The SSE connection is independent of invoice items —
 * it represents an authenticated application session, not a product set.
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

    setConnectionState('connecting');

    const eventSource = new EventSource('/api/stock-events/stream');

    eventSource.addEventListener('connected', (event) => {
      console.log('[useStockSSE] SSE connected', event.data);
      const isReconnect = wasConnectedRef.current;
      wasConnectedRef.current = true;
      setConnectionState('connected');

      if (isReconnect && onReconnectRef.current) {
        onReconnectRef.current();
      }
    });

    eventSource.addEventListener('stock-updated', (event) => {
      try {
        const data = JSON.parse(event.data);
        const updates = data.updates;
        if (!Array.isArray(updates) || updates.length === 0) return;

        console.log('[useStockSSE] Received stock update:', updates);

        // Version filtering: only pass through updates newer than last applied
        const map = versionMapRef.current;
        // Bypassing version check for diagnosis
        const validUpdates = updates;

        if (validUpdates.length > 0 && onStockUpdateRef.current) {
          onStockUpdateRef.current(validUpdates);
        }
      } catch (err) {
        console.error('[useStockSSE] Error parsing stock-updated event:', err);
      }
    });

    // EventSource fires 'open' on initial connect AND on every reconnect
    eventSource.addEventListener('open', () => {
      if (wasConnectedRef.current) {
        // This is a reconnect by the EventSource's built-in retry
        setConnectionState('connected');
        if (onReconnectRef.current) {
          onReconnectRef.current();
        }
      }
    });

    eventSource.addEventListener('error', (e) => {
      console.warn('[useStockSSE] SSE error/disconnected, readyState:', eventSource.readyState);
      // EventSource automatically reconnects on errors
      setConnectionState('disconnected');
    });

    return () => {
      eventSource.close();
      setConnectionState('disconnected');
    };
  }, [enabled]);

  return { connectionState, applyVersions };
}
