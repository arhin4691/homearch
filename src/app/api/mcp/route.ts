import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ApiKeyPermission } from "@/lib/api-key-permissions";
import {
  authenticateExternalApiKey,
  consumeExternalApiRateLimit,
  createExternalItem,
  createExternalLocation,
  externalItemFiltersSchema,
  externalItemSchema,
  externalLocationSchema,
  getExternalItems,
  getExternalLocations,
  hasApiKeyPermission,
  readExternalJson,
} from "@/lib/external-api";

const requestSchema = z.object({
  method: z.enum(["tools/list", "tools/call"]),
  params: z.record(z.unknown()).optional(),
});

const readTools = new Set([
  "get_inventory",
  "filter_inventory",
  "get_locations",
  "search_items",
]);
function toolResult(value: unknown) {
  return NextResponse.json({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  });
}

function toolError(message: string, status = 400) {
  return NextResponse.json(
    { isError: true, content: [{ type: "text", text: message }] },
    { status },
  );
}

function availableTools(permissions: ApiKeyPermission[]) {
  const tools = [];
  if (permissions.includes("items:read")) {
    tools.push({
      name: "get_inventory",
      description: "List inventory items.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, maximum: 1000 },
          limit: { type: "integer", minimum: 1, maximum: 50 },
          ...(permissions.includes("items:read:filtered")
            ? {
                q: { type: "string", maxLength: 100 },
                category: { type: "string" },
                filter: {
                  type: "string",
                  enum: ["expiring_today", "expiring_week", "expired"],
                },
              }
            : {}),
        },
      },
    });
  }
  if (permissions.includes("items:read:filtered")) {
    tools.push({
      name: "filter_inventory",
      description: "List inventory matching a text, category, or expiry filter.",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", maxLength: 100 },
          category: { type: "string" },
          filter: {
            type: "string",
            enum: ["expiring_today", "expiring_week", "expired"],
          },
          page: { type: "integer", minimum: 1, maximum: 1000 },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
      },
    });
  }
  if (permissions.includes("locations:read")) {
    tools.push({
      name: "get_locations",
      description: "List storage locations.",
      inputSchema: { type: "object", properties: {} },
    });
  }
  if (permissions.includes("items:read:filtered")) {
    tools.push({
      name: "search_items",
      description: "Search items by name, category, or hashtag.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string", maxLength: 100 } },
      },
    });
  }
  if (permissions.includes("items:create")) {
    tools.push({
      name: "create_item",
      description: "Add an inventory item.",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", maxLength: 100 },
          category: { type: "string" },
          quantity: { type: "integer", minimum: 0 },
          locationId: { type: "string" },
          hashTags: { type: "array", items: { type: "string" } },
          hasExpiry: { type: "boolean" },
          expiryDate: { type: "string", format: "date-time" },
          bestBeforeDate: { type: "string", format: "date-time" },
        },
      },
    });
  }
  if (permissions.includes("locations:create")) {
    tools.push({
      name: "create_location",
      description: "Add a storage location.",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", maxLength: 80 },
          description: { type: "string", maxLength: 200 },
          hashTags: { type: "array", items: { type: "string" } },
        },
      },
    });
  }
  return tools;
}

export async function POST(req: NextRequest) {
  try {
    const key = await authenticateExternalApiKey(req);
    if (!key) return toolError("Invalid API key", 401);

    const json = await readExternalJson(req);
    if (!json.ok) {
      const invalidRequestRate = await consumeExternalApiRateLimit(
        key.id,
        "POST",
        "mcp",
      );
      if (!invalidRequestRate.allowed) {
        const response = toolError("Rate limit exceeded", 429);
        response.headers.set("Retry-After", String(invalidRequestRate.retryAfter));
        return response;
      }
      return toolError(
        json.reason === "too_large"
          ? "Request body exceeds 64 KiB"
          : "Invalid JSON",
        json.reason === "too_large" ? 413 : 400,
      );
    }

    const body = requestSchema.safeParse(json.value);
    if (!body.success) {
      const invalidRequestRate = await consumeExternalApiRateLimit(
        key.id,
        "POST",
        "mcp",
      );
      if (!invalidRequestRate.allowed) {
        const response = toolError("Rate limit exceeded", 429);
        response.headers.set("Retry-After", String(invalidRequestRate.retryAfter));
        return response;
      }
      return toolError("Invalid MCP request");
    }

    const params = body.data.params ?? {};
    const toolName = typeof params.name === "string" ? params.name : "";
    const operation = readTools.has(toolName) || body.data.method === "tools/list"
      ? "GET"
      : "POST";
    const rate = await consumeExternalApiRateLimit(key.id, operation, "mcp");
    if (!rate.allowed) {
      const response = toolError("Rate limit exceeded", 429);
      response.headers.set("Retry-After", String(rate.retryAfter));
      return response;
    }

    if (body.data.method === "tools/list") {
      return NextResponse.json({ tools: availableTools(key.permissions) });
    }

    const args =
      typeof params.arguments === "object" &&
      params.arguments !== null &&
      !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (toolName === "get_inventory" || toolName === "filter_inventory") {
      const filteredTool = toolName === "filter_inventory";
      const filters = externalItemFiltersSchema.safeParse({
        q: args.q,
        category: args.category,
        filter: args.filter,
      });
      if (!filters.success) {
        return toolError(filters.error.issues[0]?.message ?? "Invalid filters");
      }
      const filtered = Boolean(
        filters.data.q || filters.data.category || filters.data.filter,
      );
      if (filteredTool && !filtered) {
        return toolError("At least one item filter is required");
      }
      if (
        !hasApiKeyPermission(
          key,
          filtered ? "items:read:filtered" : "items:read",
        )
      ) {
        return toolError("API key does not permit this operation", 403);
      }

      const page =
        typeof args.page === "number" &&
        Number.isInteger(args.page) &&
        args.page > 0 &&
        args.page <= 1000
          ? args.page
          : 1;
      const limit =
        typeof args.limit === "number" &&
        Number.isInteger(args.limit) &&
        args.limit > 0 &&
        args.limit <= 50
          ? args.limit
          : 50;
      if (
        args.page !== undefined &&
        (typeof args.page !== "number" ||
          !Number.isInteger(args.page) ||
          args.page < 1 ||
          args.page > 1000)
      ) {
        return toolError("page must be between 1 and 1000");
      }
      if (
        args.limit !== undefined &&
        (typeof args.limit !== "number" ||
          !Number.isInteger(args.limit) ||
          args.limit < 1 ||
          args.limit > 50)
      ) {
        return toolError("limit must be between 1 and 50");
      }
      return toolResult(
        await getExternalItems(key.familyId, filters.data, page, limit),
      );
    }

    if (toolName === "get_locations") {
      if (!hasApiKeyPermission(key, "locations:read")) {
        return toolError("API key does not permit this operation", 403);
      }
      return toolResult(await getExternalLocations(key.familyId));
    }

    if (toolName === "search_items") {
      if (!hasApiKeyPermission(key, "items:read:filtered")) {
        return toolError("API key does not permit this operation", 403);
      }
      const query = z.string().trim().min(1).max(100).safeParse(args.query);
      if (!query.success) return toolError("query must be a non-empty string up to 100 characters");
      return toolResult(
        await getExternalItems(key.familyId, { q: query.data }, 1, 50),
      );
    }

    if (toolName === "create_item") {
      if (!hasApiKeyPermission(key, "items:create")) {
        return toolError("API key does not permit this operation", 403);
      }
      const parsed = externalItemSchema.safeParse(args);
      if (!parsed.success) {
        return toolError(parsed.error.issues[0]?.message ?? "Invalid item");
      }
      const item = await createExternalItem(key, parsed.data);
      if (!item) return toolError("API key owner or location is invalid", 403);
      return toolResult(item);
    }

    if (toolName === "create_location") {
      if (!hasApiKeyPermission(key, "locations:create")) {
        return toolError("API key does not permit this operation", 403);
      }
      const parsed = externalLocationSchema.safeParse(args);
      if (!parsed.success) {
        return toolError(parsed.error.issues[0]?.message ?? "Invalid location");
      }
      return toolResult(
        await createExternalLocation(key.familyId, parsed.data),
      );
    }

    return toolError("Unknown tool");
  } catch (error) {
    console.error("MCP request failed:", error);
    return toolError("Internal server error", 500);
  }
}
