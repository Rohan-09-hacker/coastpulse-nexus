import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || plainText.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  if (!plainText || !passwordHash) return false;
  // If old placeholder hash, immediately reject
  if (passwordHash.startsWith('sha256:') || passwordHash.startsWith('plain:')) {
    return false;
  }
  try {
    return await bcrypt.compare(plainText, passwordHash);
  } catch {
    return false;
  }
}
