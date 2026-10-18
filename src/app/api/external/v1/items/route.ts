import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  apiRateLimitError,
  authenticateExternalApiKey,
  consumeExternalApiRateLimit,
  createExternalItem,
  externalItemFiltersSchema,
  externalItemSchema,
  getExternalItems,
  hasApiKeyPermission,
  readExternalJson,
} from "@/lib/external-api";

function parsePositiveInteger(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : null;
}

export async function GET(req: NextRequest) {
  try {
    const key = await authenticateExternalApiKey(req);
    if (!key) return apiError("Invalid API key", 401);
    const rate = await consumeExternalApiRateLimit(key.id, "GET");
    if (!rate.allowed) return apiRateLimitError(rate.retryAfter);

    const url = new URL(req.url);
    const parsedFilters = externalItemFiltersSchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      filter: url.searchParams.get("filter") ?? undefined,
    });
    if (!parsedFilters.success) {
      return apiError(parsedFilters.error.issues[0]?.message ?? "Invalid filters", 422);
    }

    const isFiltered = Boolean(
      parsedFilters.data.q ||
        parsedFilters.data.category ||
        parsedFilters.data.filter,
    );
    const requiredPermission = isFiltered
      ? "items:read:filtered"
      : "items:read";
    if (!hasApiKeyPermission(key, requiredPermission)) {
      return apiError("API key does not permit this operation", 403);
    }

    const page = parsePositiveInteger(url.searchParams.get("page"), 1, 1000);
    const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 50);
    if (page === null || limit === null) {
      return apiError(
        "Page must be between 1 and 1000; limit must be between 1 and 50",
        422,
      );
    }

    return apiSuccess(
      await getExternalItems(key.familyId, parsedFilters.data, page, limit),
    );
  } catch (error) {
    console.error("External item list failed:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const key = await authenticateExternalApiKey(req);
    if (!key) return apiError("Invalid API key", 401);
    const rate = await consumeExternalApiRateLimit(key.id, "POST");
    if (!rate.allowed) return apiRateLimitError(rate.retryAfter);
    if (!hasApiKeyPermission(key, "items:create")) {
      return apiError("API key does not permit this operation", 403);
    }

    const json = await readExternalJson(req);
    if (!json.ok) {
      return apiError(
        json.reason === "too_large" ? "Request body exceeds 64 KiB" : "Invalid JSON",
        json.reason === "too_large" ? 413 : 400,
      );
    }
    const parsed = externalItemSchema.safeParse(json.value);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid item", 422);
    }

    const item = await createExternalItem(key, parsed.data);
    if (!item) {
      return apiError(
        "API key owner is no longer in the family or location is invalid",
        403,
      );
    }
    return apiSuccess(item, 201);
  } catch (error) {
    console.error("External item creation failed:", error);
    return apiError("Internal server error", 500);
  }
}
