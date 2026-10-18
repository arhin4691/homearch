import { apiSuccess } from "@/lib/api-response";
import { API_KEY_PERMISSIONS } from "@/lib/api-key-permissions";

export async function GET() {
  return apiSuccess({
    authentication: {
      header: "x-api-key",
      format: "hma_<key-id>_<secret>",
      requiredFor: [
        "GET /api/external/v1/items",
        "POST /api/external/v1/items",
        "GET /api/external/v1/locations",
        "POST /api/external/v1/locations",
        "POST /api/mcp",
      ],
    },
    rateLimits: {
      rest: {
        get: "60 requests per rolling minute",
        post: "100 requests per rolling hour",
      },
      mcp: {
        readTools: "6 calls per rolling minute",
        writeTools: "100 calls per rolling hour",
      },
      note: "Write limits are shared across REST and MCP for each key; MCP reads also count toward the shared REST GET limit.",
    },
    legacyKeys:
      "Keys created before scoped permissions were introduced are disabled; create a replacement key with explicit permissions.",
    transportSecurity: "Use HTTPS and keep API keys secret.",
    permissions: API_KEY_PERMISSIONS,
    endpoints: [
      {
        method: "GET",
        path: "/api/external/v1/items",
        permission: "items:read",
        description: "List all items. Supports page and limit (maximum 50).",
        query: { page: "1-1000, default 1", limit: "1-50, default 50" },
      },
      {
        method: "GET",
        path: "/api/external/v1/items",
        permission: "items:read:filtered",
        description: "Filter items by text, category, or expiry.",
        query: {
          q: "optional literal search in item names, categories, and hashtags",
          category: "optional category",
          filter: "expiring_today | expiring_week | expired",
          page: "1-1000, default 1",
          limit: "1-50, default 50",
        },
      },
      {
        method: "POST",
        path: "/api/external/v1/items",
        permission: "items:create",
        body: {
          name: "Milk",
          category: "Food",
          quantity: 2,
          locationId: "optional 24-character location id",
          hashTags: ["dairy"],
          hasExpiry: true,
          expiryDate: "optional ISO-8601 datetime",
          bestBeforeDate: "optional ISO-8601 datetime",
        },
      },
      {
        method: "GET",
        path: "/api/external/v1/locations",
        permission: "locations:read",
        description: "List locations belonging to the API key's family.",
      },
      {
        method: "POST",
        path: "/api/external/v1/locations",
        permission: "locations:create",
        body: {
          name: "Kitchen",
          description: "optional",
          hashTags: ["cold-storage"],
        },
      },
      {
        method: "POST",
        path: "/api/mcp",
        permission: "per-tool",
        description:
          "MCP tools/list and tools/call; available tools are restricted by the API key's permissions.",
        body: {
          method: "tools/call",
          params: { name: "get_inventory", arguments: { limit: 50 } },
        },
      },
    ],
    userData: "External REST and MCP responses never expose account or family-member profiles.",
  });
}
