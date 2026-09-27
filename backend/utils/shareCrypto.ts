import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Check if the dedicated SHARE_TOKEN_SECRET is configured.
 */
export function isShareSecretConfigured(): boolean {
  return Boolean(process.env.SHARE_TOKEN_SECRET && process.env.SHARE_TOKEN_SECRET.trim().length > 0);
}

/**
 * Derive 32-byte key for AES-256-GCM from SHARE_TOKEN_SECRET.
 * In production, SHARE_TOKEN_SECRET is strictly mandatory and never falls back to JWT_SECRET or defaults.
 * In non-production environments only, falls back to a salted development key with a console warning.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.SHARE_TOKEN_SECRET;
  if (!secret || !secret.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[FATAL SECURITY ERROR] SHARE_TOKEN_SECRET environment variable is mandatory in production. ' +
        'Public share encryption cannot initialize without a dedicated cryptographic secret.'
      );
    }
    console.warn(
      '[SECURITY WARNING] SHARE_TOKEN_SECRET is not configured in development environment. ' +
      'Using non-production transient salt key. Configure SHARE_TOKEN_SECRET in your .env file.'
    );
    return crypto.createHash('sha256').update('bharat-enterprise-dev-share-token-salt-key-do-not-use-in-prod').digest();
  }
  return crypto.createHash('sha256').update(secret.trim()).digest();
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
