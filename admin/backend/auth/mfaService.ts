/**
 * Bharat Enterprise Billing System — Platform MFA Service
 * RFC 6238 TOTP, AES-256-GCM encryption for secrets, and single-use backup recovery codes.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { IPlatformUser } from '../types';

// RFC 4648 Base32 Alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BACKUP_CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

let hasWarnedMissingMfaKey = false;

/**
 * Derives a 32-byte key for AES-256-GCM encryption of MFA secrets.
 */
export function getMfaEncryptionKey(): Buffer {
  const envKey = process.env.PLATFORM_MFA_KEY;

  if (envKey && envKey.trim().length > 0) {
    const trimmed = envKey.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL SECURITY ERROR] PLATFORM_MFA_KEY is mandatory in production environment.');
  }

  if (!hasWarnedMissingMfaKey) {
    console.warn('[SECURITY WARNING] PLATFORM_MFA_KEY not set. Using development fallback key.');
    hasWarnedMissingMfaKey = true;
  }

  return crypto.createHash('sha256').update('dev-mfa-encryption-fallback-key-bharat-platform-default-32-bytes').digest();
}

/**
 * Encodes a buffer into an RFC 4648 Base32 string.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte === undefined) continue;
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 4648 Base32 string into a Buffer.
 */
export function base32Decode(base32String: string): Buffer {
  const clean = base32String.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (!char) continue;
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character encountered: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * Output format: `ivHex:authTagHex:ciphertextHex`
 */
export function encryptSecret(plaintextSecret: string): string {
  const key = getMfaEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintextSecret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted secret string.
 */
export function decryptSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted MFA secret payload format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getMfaEncryptionKey();

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a 20-byte random Base32 secret for TOTP.
 */
export function generateTotpSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generates an RFC 6238 otpauth:// URI for QR code generation.
 */
export function generateOtpAuthUri(email: string, secretBase32: string, issuer: string = 'BharatEnterprise'): string {
  const encodedEmail = encodeURIComponent(email.trim());
  const encodedIssuer = encodeURIComponent(issuer.trim());
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Computes the 6-digit TOTP code for a given Base32 secret and time step.
 */
export function computeTotpCode(secretBase32: string, timeStep: number = Math.floor(Date.now() / 1000 / 30)): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const lastByte = hmac[hmac.length - 1];
  if (lastByte === undefined) {
    throw new Error('HMAC calculation returned empty digest');
  }
  const offset = lastByte & 0x0f;

  const b0 = hmac[offset];
  const b1 = hmac[offset + 1];
  const b2 = hmac[offset + 2];
  const b3 = hmac[offset + 3];

  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
    throw new Error('Malformed HMAC slice during TOTP dynamic truncation');
  }

  const binary =
    ((b0 & 0x7f) << 24) |
    ((b1 & 0xff) << 16) |
    ((b2 & 0xff) << 8) |
    (b3 & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code with time-step window skew protection (+-1 window).
 */
export function verifyTotp(secretBase32: string, code: string, windowSkew: number = 1): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const candidateBuf = Buffer.from(normalizedCode);

  for (let offset = -windowSkew; offset <= windowSkew; offset++) {
    const step = currentStep + offset;
    try {
      const expectedCode = computeTotpCode(secretBase32, step);
      const expectedBuf = Buffer.from(expectedCode);
      if (crypto.timingSafeEqual(candidateBuf, expectedBuf)) {
        return true;
      }
    } catch {
      // Continue skew window search
    }
  }

  return false;
}

/**
 * Generates 8 single-use recovery backup codes (10 alphanumeric chars each) and their bcrypt hashes.
 */
export async function generateBackupCodes(): Promise<{
  plainCodes: string[];
  backupCodes: Array<{ codeHash: string; usedAt: null }>;
}> {
  const plainCodes: string[] = [];
  const backupCodes: Array<{ codeHash: string; usedAt: null }> = [];

  for (let i = 0; i < 8; i++) {
    let code = '';
    for (let c = 0; c < 10; c++) {
      const randIdx = crypto.randomInt(0, BACKUP_CODE_CHARSET.length);
      code += BACKUP_CODE_CHARSET[randIdx];
    }
    plainCodes.push(code);

    const codeHash = await bcrypt.hash(code, 10);
    backupCodes.push({ codeHash, usedAt: null });
  }

  return { plainCodes, backupCodes };
}

/**
 * Verifies and atomically marks a single-use backup code as consumed.
 */
export async function verifyAndConsumeBackupCode(
  user: IPlatformUser & { save?: () => Promise<unknown> },
  candidateCode: string
): Promise<boolean> {
  if (!candidateCode || typeof candidateCode !== 'string' || !user.mfaBackupCodes) {
    return false;
  }

  const cleanCode = candidateCode.trim().toUpperCase();

  for (const entry of user.mfaBackupCodes) {
    if (!entry.usedAt) {
      const match = await bcrypt.compare(cleanCode, entry.codeHash);
      if (match) {
        entry.usedAt = new Date();
        if (typeof user.save === 'function') {
          await user.save();
        }
        return true;
      }
    }
  }

  return false;
}

/**
 * Combined helper to generate full MFA setup package for user enrollment.
 */
export async function generateMfaSetup(email: string, issuer: string = 'BharatEnterprise') {
  const secret = generateTotpSecret();
  const encryptedSecret = encryptSecret(secret);
  const otpAuthUri = generateOtpAuthUri(email, secret, issuer);
  const { plainCodes, backupCodes } = await generateBackupCodes();

  return {
    secret,
    encryptedSecret,
    otpAuthUri,
    backupCodes: plainCodes,
    backupCodeHashes: backupCodes,
  };
}
