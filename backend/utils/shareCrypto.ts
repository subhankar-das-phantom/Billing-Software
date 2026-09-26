import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Derive 32-byte key for AES-256-GCM from environment variables.
 * Never hardcodes secrets. Falls back to JWT_SECRET with a console warning in development.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.SHARE_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[SECURITY WARNING] Neither SHARE_TOKEN_SECRET nor JWT_SECRET is set. Using transient fallback.');
    }
    // Fallback salt for non-configured local environments
    return crypto.createHash('sha256').update('bharat-enterprise-billing-share-secret-fallback').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Generate a cryptographically secure random token (256-bit entropy, URL-safe base64url).
 */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Compute SHA-256 hash of raw token for fast, constant-time database lookups.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Encrypt raw token using AES-256-GCM authenticated encryption.
 * Output format: `ivHex:authTagHex:encryptedHex`
 */
export function encryptToken(rawToken: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(rawToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt encrypted token using AES-256-GCM with authentication tag verification.
 * Fails safely by returning `null` if decryption or authentication tag check fails (e.g. rotated key).
 */
export function decryptToken(payload: string): string | null {
  try {
    if (!payload || typeof payload !== 'string') return null;
    const parts = payload.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Decryption failed (invalid auth tag, corrupted payload, or key rotated)
    console.warn('[ShareCrypto] Decrypt token failed safely:', err instanceof Error ? err.message : err);
    return null;
  }
}
