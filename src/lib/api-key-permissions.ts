export const API_KEY_PERMISSIONS = [
  "items:read",
  "items:read:filtered",
  "items:create",
  "locations:read",
  "locations:create",
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number];
