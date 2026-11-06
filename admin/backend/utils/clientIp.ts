/**
 * Bharat Enterprise Billing System — Client IP Extraction & Normalization
 * Resilient client IP parser handling proxy forwarding, IPv4-mapped IPv6,
 * port stripping, and header tampering.
 */

import type { Request } from 'express';

/**
 * Normalizes an IP address:
 * - Trims whitespace
 * - Strips IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 -> 1.2.3.4)
 * - Strips trailing port numbers (e.g. 1.2.3.4:5678 -> 1.2.3.4)
 * - Normalizes bracketed IPv6 with ports (e.g. [2001:db8::1]:8080 -> 2001:db8::1)
 */
export function normalizeIp(rawIp: string): string {
  if (!rawIp || typeof rawIp !== 'string') return '';
  let ip = rawIp.trim();

  // Strip IPv4-mapped IPv6 prefix
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Strip port from IPv4 address if present (e.g. 192.0.2.1:8080)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0]!;
  }

  // Strip port from bracketed IPv6 address if present (e.g. [2001:db8::1]:8080)
  if (/^\[([a-fA-F0-9:]+)\]:\d+$/.test(ip)) {
    const match = ip.match(/^\[([a-fA-F0-9:]+)\]:\d+$/);
    if (match && match[1]) {
      ip = match[1];
    }
  }

  return ip;
}

/**
 * Extracts the real client IP address from an incoming HTTP request.
 * Prioritizes forwarded headers safely, parsing the first client IP in comma-separated chains.
 */
export function extractClientIp(req: Request | any): string {
  if (!req) return '127.0.0.1';

  // 1. X-Forwarded-For header (leftmost IP is the original client)
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    if (Array.isArray(xForwardedFor)) {
      const firstEntry = xForwardedFor[0];
      if (firstEntry && typeof firstEntry === 'string') {
        const clientIp = firstEntry.split(',')[0]?.trim();
        if (clientIp) return normalizeIp(clientIp);
      }
    } else if (typeof xForwardedFor === 'string' && xForwardedFor.trim().length > 0) {
      const clientIp = xForwardedFor.split(',')[0]?.trim();
      if (clientIp) return normalizeIp(clientIp);
    }
  }

  // 2. X-Real-IP header (common behind Nginx reverse proxies)
  const xRealIp = req.headers?.['x-real-ip'];
  if (xRealIp) {
    const ipStr = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    if (typeof ipStr === 'string' && ipStr.trim().length > 0) {
      return normalizeIp(ipStr.trim());
    }
  }

  // 3. Express req.ip (if trust proxy is enabled)
  if (typeof req.ip === 'string' && req.ip.trim().length > 0) {
    return normalizeIp(req.ip.trim());
  }

  // 4. Node socket remoteAddress
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (typeof socketIp === 'string' && socketIp.trim().length > 0) {
    return normalizeIp(socketIp.trim());
  }

  return '127.0.0.1';
}
