import crypto from 'node:crypto';

/**
 * Calculates the SHA256 hash of a buffer.
 * @param buffer The input buffer.
 * @returns The hex-encoded SHA256 hash.
 */
export function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Add other general utility functions here in the future if needed
