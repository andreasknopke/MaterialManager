/**
 * Secure encryption utilities for DB tokens
 * Uses AES-256-GCM with JWT_SECRET as encryption key
 * 
 * Based on CuraFlow implementation
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derive a 256-bit key from JWT_SECRET using SHA-256
 * @returns {Buffer} 32-byte key
 */
const getEncryptionKey = (): Buffer => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required for encryption');
  }
  // Use SHA-256 to derive a 32-byte key from the secret
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - The data to encrypt
 * @returns {string} Base64-encoded encrypted data (iv + authTag + ciphertext)
 */
export const encryptToken = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  } as crypto.CipherGCMOptions);
  
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine iv + authTag + ciphertext into single buffer
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString('base64');
};

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Base64-encoded encrypted data
 * @returns {string} Decrypted plaintext
 */
export const decryptToken = (encryptedData: string): string => {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Validate minimum length (IV + AuthTag + at least 1 byte ciphertext)
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted data: too short');
  }
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  } as crypto.CipherGCMOptions);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
};

/**
 * Check if a token is in the old base64 format (unencrypted)
 * Old tokens are just base64-encoded JSON starting with { when decoded
 * @param {string} token - The token to check
 * @returns {boolean} True if it's an old unencrypted token
 */
export const isLegacyToken = (token: string): boolean => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    // Check if it looks like DB config (has host, user, database)
    return parsed && parsed.host && parsed.user && parsed.database;
  } catch {
    return false;
  }
};

/**
 * Parse a DB token - handles both legacy (base64) and encrypted formats
 * @param {string} token - The token to parse
 * @returns {object|null} Parsed DB config or null if invalid
 */
export const parseDbToken = (token: string): {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
  ssl?: boolean;
} | null => {
  try {
    // First, check if it's a legacy unencrypted token
    if (isLegacyToken(token)) {
      console.warn('⚠️ Warning: Legacy unencrypted DB token detected. Please regenerate token for security.');
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    }
    
    // Try to decrypt as new encrypted format
    const decrypted = decryptToken(token);
    return JSON.parse(decrypted);
  } catch (error: any) {
    console.error('Failed to parse DB token:', error.message);
    return null;
  }
};

/**
 * Generate an encrypted DB token from credentials
 * @param credentials - Database credentials
 * @returns {string} Encrypted token
 */
export const generateDbToken = (credentials: {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
  ssl?: boolean;
}): string => {
  const json = JSON.stringify(credentials);
  return encryptToken(json);
};
