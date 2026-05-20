import { customAlphabet } from "nanoid";

const alpha = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 4);

export function generateUserCode(): string {
  return `${alpha()}-${alpha()}-${alpha()}`;
}

export function generateFamilyCode(): string {
  return customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8)();
}

export function generateApiKey(): string {
  return `hma_${customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 40)()}`;
}
