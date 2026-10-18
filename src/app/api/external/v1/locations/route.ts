import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  apiRateLimitError,
  authenticateExternalApiKey,
  consumeExternalApiRateLimit,
  createExternalLocation,
  externalLocationSchema,
  getExternalLocations,
  hasApiKeyPermission,
  readExternalJson,
} from "@/lib/external-api";

export async function GET(req: NextRequest) {
  try {
    const key = await authenticateExternalApiKey(req);
    if (!key) return apiError("Invalid API key", 401);
    const rate = await consumeExternalApiRateLimit(key.id, "GET");
    if (!rate.allowed) return apiRateLimitError(rate.retryAfter);
    if (!hasApiKeyPermission(key, "locations:read")) {
      return apiError("API key does not permit this operation", 403);
    }

    return apiSuccess({ locations: await getExternalLocations(key.familyId) });
  } catch (error) {
    console.error("External location list failed:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const key = await authenticateExternalApiKey(req);
    if (!key) return apiError("Invalid API key", 401);
    const rate = await consumeExternalApiRateLimit(key.id, "POST");
    if (!rate.allowed) return apiRateLimitError(rate.retryAfter);
    if (!hasApiKeyPermission(key, "locations:create")) {
      return apiError("API key does not permit this operation", 403);
    }

    const json = await readExternalJson(req);
    if (!json.ok) {
      return apiError(
        json.reason === "too_large" ? "Request body exceeds 64 KiB" : "Invalid JSON",
        json.reason === "too_large" ? 413 : 400,
      );
    }
    const parsed = externalLocationSchema.safeParse(json.value);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid location", 422);
    }

    return apiSuccess(
      await createExternalLocation(key.familyId, parsed.data),
      201,
    );
  } catch (error) {
    console.error("External location creation failed:", error);
    return apiError("Internal server error", 500);
  }
}
