/**
 * Bharat Enterprise Billing System — Platform Control Plane Rate Limiting Middleware
 * In-memory sliding window rate limiter designed for control plane authentication endpoints.
 * Defends against brute-force attacks and credential stuffing with accurate client IP extraction.
 */

import type { Request, Response, NextFunction } from 'express';
import { extractClientIp } from '../utils/clientIp';

export interface RateLimitOptions {
  windowMs?: number;        // Time window in milliseconds (default: 15 minutes)
  max?: number;             // Max requests per window per IP (default: 20)
  message?: string;         // Rejection message
  statusCode?: number;      // HTTP response code (default: 429)
  keyGenerator?: (req: Request | any) => string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class PlatformRateLimiter {
  private windowMs: number;
  private max: number;
  private message: string;
  private statusCode: number;
  private keyGenerator: (req: Request | any) => string;
  private store: Map<string, RateLimitRecord>;

  constructor(options: RateLimitOptions = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 mins
    this.max = options.max || 20;
    this.message = options.message || 'Too many authentication attempts. Please try again later.';
    this.statusCode = options.statusCode || 429;
    this.keyGenerator = options.keyGenerator || ((req) => extractClientIp(req));
    this.store = new Map<string, RateLimitRecord>();
  }

  public getRecord(key: string): RateLimitRecord | undefined {
    return this.store.get(key);
  }

  public isBlocked(key: string): boolean {
    const record = this.store.get(key);
    if (!record) return false;
    if (Date.now() > record.resetTime) {
      this.store.delete(key);
      return false;
    }
    return record.count >= this.max;
  }

  public reset(key?: string): void {
    if (key && key !== '*') {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  public middleware = (req: Request | any, res: Response | any, next: NextFunction): void => {
    const key = this.keyGenerator(req) || '127.0.0.1';
    const now = Date.now();

    let record = this.store.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.store.set(key, record);
    } else {
      record.count += 1;
    }

    const resetSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    const remaining = Math.max(0, this.max - record.count);

    // Standard rate limit response headers (RFC 6585 & Draft RFC RateLimit Headers)
    if (typeof res.setHeader === 'function') {
      res.setHeader('RateLimit-Limit', this.max.toString());
      res.setHeader('RateLimit-Remaining', remaining.toString());
      res.setHeader('RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
    }

    if (record.count > this.max) {
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', resetSeconds.toString());
      }

      res.status(this.statusCode).json({
        success: false,
        error: this.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: resetSeconds,
      });
      return;
    }

    next();
  };
}

/**
 * Default singleton platform auth rate limiter:
 * 20 attempts per 15 minutes per unique client IP.
 */
export const platformAuthLimiterInstance = new PlatformRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
});

export const platformAuthRateLimiter = platformAuthLimiterInstance.middleware;

export function createPlatformRateLimiter(options?: RateLimitOptions): PlatformRateLimiter {
  return new PlatformRateLimiter(options);
}

export default platformAuthRateLimiter;
