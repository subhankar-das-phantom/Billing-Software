/**
 * CSRF & Custom Header Origin Protection Middleware
 * Protects state-changing API operations (POST, PUT, PATCH, DELETE) against cross-site request forgery.
 */
const verifyRequestOrigin = (req, res, next) => {
  const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Exempt Razorpay subscription webhook (signature is verified by Razorpay crypto)
  if (req.originalUrl.startsWith('/api/saas/subscription/webhook')) {
    return next();
  }

  // Browser SOP ensures foreign origins cannot set custom non-simple headers without preflight approval
  const hasCustomHeader = req.headers['x-requested-with'] || req.headers['x-client-platform'];
  if (hasCustomHeader) {
    return next();
  }

  // Verify Origin / Referer against allowed frontend origins
  const origin = req.headers.origin || (req.headers.referer ? (() => {
    try {
      return new URL(req.headers.referer).origin;
    } catch (_) {
      return null;
    }
  })() : null);

  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedOrigins = new Set([
    allowedOrigin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]);

  if (origin && allowedOrigins.has(origin)) {
    return next();
  }

  // In development, if testing via local tools (Postman/Curl) without browser origin, allow if no origin header
  if (!origin && process.env.NODE_ENV === 'development') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Cross-site request forgery protection: missing required custom header or untrusted request origin.'
  });
};

module.exports = verifyRequestOrigin;
