const rateLimit = require('express-rate-limit');
const { isDisposableEmail } = require('../utils/disposableEmailBlocker');

const isDev = process.env.NODE_ENV === 'development';

/**
 * Dedicated rate limiter for tenant registration.
 *
 * Restricts registration attempts to 5 per IP per hour in production (20 in dev)
 * to prevent bulk tenant provisioning, trial quota abuse, and storage exhaustion.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 20 : 5,
  message: {
    success: false,
    message: 'Too many accounts created from this IP address. Please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Registration access control & anti-abuse guard.
 *
 * Enforces:
 * 1. Honeypot verification (silently trips automated bots filling hidden inputs)
 * 2. Emergency kill-switch (ALLOW_PUBLIC_REGISTRATION=false) with optional secret bypass
 * 3. Disposable/temporary email domain rejection
 */
const registrationGuard = (req, res, next) => {
  // 1. Honeypot check: automated scrapers and spam bots fill every input on a form
  const honeypot = req.body?.website || req.body?.firmWebsite_hp;
  if (honeypot && typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid registration payload detected.'
    });
  }

  // 2. Emergency kill-switch / registration gate
  const allowPublic = process.env.ALLOW_PUBLIC_REGISTRATION !== 'false';
  if (!allowPublic) {
    const providedSecret = req.headers['x-registration-secret'] || req.body?.registrationSecret;
    const configuredSecret = process.env.REGISTRATION_SECRET;

    // If a valid registration secret is configured and supplied, allow registration to proceed
    const isSecretValid = Boolean(
      configuredSecret &&
      providedSecret &&
      typeof providedSecret === 'string' &&
      providedSecret.trim() === configuredSecret.trim()
    );

    if (!isSecretValid) {
      return res.status(403).json({
        success: false,
        code: 'REGISTRATION_DISABLED',
        message: 'Public registration is currently disabled. Please contact your system administrator or provide a valid registration key.'
      });
    }
  }

  // 3. Disposable email domain check
  const email = req.body?.email;
  if (email && isDisposableEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Disposable or temporary email addresses are not permitted. Please use a permanent business or personal email address.'
    });
  }

  next();
};

module.exports = {
  registerLimiter,
  registrationGuard
};
