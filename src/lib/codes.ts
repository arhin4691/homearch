import { customAlphabet } from "nanoid";

const alpha = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 4);

export function generateUserCode(): string {
  return `${alpha()}-${alpha()}-${alpha()}`;
}

export function generateFamilyCode(): string {
  return customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8)();
}

export function generateApiKey(): string {
  const random = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 40);
  const keyId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16)();
  return `hma_${keyId}_${random()}`;
}

export function parseApiKey(rawKey: string | null) {
  if (!rawKey || rawKey.length > 64) return null;
  const match = /^hma_([a-z0-9]{16})_([a-z0-9]{40})$/.exec(rawKey);
  if (!match) return null;
  return { keyId: match[1], rawKey };
}
