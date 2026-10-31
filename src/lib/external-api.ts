import { FilterQuery, Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { comparePassword } from "@/lib/auth";
import { parseApiKey } from "@/lib/codes";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { API_KEY_PERMISSIONS, type ApiKeyPermission } from "@/lib/api-key-permissions";
import { ApiKey } from "@/models/ApiKey";
import { ApiKeyRateLimit } from "@/models/ApiKeyRateLimit";
import { Item, type IItem } from "@/models/Item";
import { Location } from "@/models/Location";
import { User } from "@/models/User";
import { apiError } from "@/lib/api-response";
import type { ItemCategory } from "@/lib/constants";

interface StoredApiKey {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  apiKeyHash: string;
  permissions?: string[];
}

interface RateLimitCounter {
  timestamps: Date[];
}

interface ExternalItemDocument {
  _id: Types.ObjectId;
  name: string;
  category: ItemCategory;
  quantity?: number;
  hasExpiry: boolean;
  expiryDate?: Date | null;
  bestBeforeDate?: Date | null;
  hashTags: string[];
  locationId?: Types.ObjectId | null;
}

interface ExternalLocationDocument {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  hashTags?: string[];
  createdAt: Date;
}

interface ExternalCreator {
  _id: Types.ObjectId;
}

export interface ExternalApiKey {
  id: string;
  familyId: string;
  createdBy: string;
  permissions: ApiKeyPermission[];
}

export const externalItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: z.enum(ITEM_CATEGORIES).default("Other"),
    quantity: z.number().int().min(0).max(100000).default(1),
    locationId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    hashTags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
    hasExpiry: z.boolean().default(true),
    expiryDate: z.string().datetime().nullish(),
    bestBeforeDate: z.string().datetime().nullish(),
  })
  .strict();

export const externalLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(200).optional(),
    hashTags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  })
  .strict();

export const externalItemFiltersSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    filter: z.enum(["expiring_today", "expiring_week", "expired"]).optional(),
  })
  .strict();

export async function authenticateExternalApiKey(
  request: globalThis.Request,
): Promise<ExternalApiKey | null> {
  const parsed = parseApiKey(request.headers.get("x-api-key"));
  if (!parsed) return null;

  await connectDB();
  const storedKey = await ApiKey.findOne({ keyId: parsed.keyId }).lean<StoredApiKey | null>();
  if (!storedKey || !(await comparePassword(parsed.rawKey, storedKey.apiKeyHash))) {
    return null;
  }
  if (!storedKey.createdBy || !(await User.exists({
    _id: storedKey.createdBy,
    familyId: storedKey.familyId,
  }))) {
    return null;
  }

  const permissions = (storedKey.permissions ?? []).filter(
    (permission): permission is ApiKeyPermission =>
      API_KEY_PERMISSIONS.includes(permission as ApiKeyPermission),
  );

  return {
    id: storedKey._id.toString(),
    familyId: storedKey.familyId.toString(),
    createdBy: storedKey.createdBy?.toString() ?? "",
    permissions,
  };
}

export function hasApiKeyPermission(
  key: ExternalApiKey,
  permission: ApiKeyPermission,
) {
  return key.permissions.includes(permission);
}

export function apiRateLimitError(retryAfter: number) {
  const response = apiError("Rate limit exceeded", 429);
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}

export async function readExternalJson(request: globalThis.Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64 * 1024) return { ok: false as const, reason: "too_large" as const };
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > 64 * 1024) {
    return { ok: false as const, reason: "too_large" as const };
  }
  try {
    return {
      ok: true as const,
      value: JSON.parse(new TextDecoder().decode(buffer)) as unknown,
    };
  } catch {
    return { ok: false as const, reason: "invalid_json" as const };
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

async function consumeRateLimitBucket(
  bucketId: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const activeTimestamps = {
    $filter: {
      input: { $ifNull: ["$timestamps", []] },
      as: "timestamp",
      cond: { $gt: ["$$timestamp", cutoff] },
    },
  };

  try {
    const result = await ApiKeyRateLimit.findOneAndUpdate(
      {
        _id: bucketId,
        $expr: { $lt: [{ $size: activeTimestamps }, limit] },
      },
      [
        {
          $set: {
            timestamps: {
              $concatArrays: [activeTimestamps, [{ $literal: now }]],
            },
            expiresAt: { $literal: new Date(now.getTime() + windowMs) },
          },
        },
      ],
      { upsert: true, new: true },
    );
    if (!result) throw new Error("Rate-limit counter update returned no document");
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const counter = await ApiKeyRateLimit.findById(bucketId).lean<RateLimitCounter | null>();
    const activeTimestamps = counter?.timestamps
      .filter((timestamp) => timestamp.getTime() > cutoff.getTime())
      .sort((a, b) => a.getTime() - b.getTime()) ?? [];
    if (activeTimestamps.length < limit) {
      return consumeRateLimitBucket(bucketId, limit, windowMs);
    }
    const oldestActive = activeTimestamps[0];
    return {
      allowed: false,
      retryAfter: oldestActive
        ? Math.max(1, Math.ceil((oldestActive.getTime() + windowMs - now.getTime()) / 1000))
        : 1,
    };
  }
}

export async function consumeExternalApiRateLimit(
  keyId: string,
  method: "GET" | "POST",
  mode: "rest" | "mcp" = "rest",
): Promise<{ allowed: boolean; retryAfter: number }> {
  if (method === "POST") {
    return consumeRateLimitBucket(`${keyId}:POST`, 100, 60 * 60 * 1000);
  }

  if (mode === "mcp") {
    const mcpRate = await consumeRateLimitBucket(
      `${keyId}:MCP:GET`,
      6,
      60 * 1000,
    );
    if (!mcpRate.allowed) return mcpRate;
  }
  return consumeRateLimitBucket(`${keyId}:GET`, 60, 60 * 1000);
}

export async function getExternalItems(
  familyId: string,
  filters: z.infer<typeof externalItemFiltersSchema> = {},
  page = 1,
  limit = 50,
) {
  const query: FilterQuery<IItem> = {
    familyId: new Types.ObjectId(familyId),
  };
  if (filters.category) query.category = filters.category;
  if (filters.filter) {
    const now = new Date();
    if (filters.filter === "expired") {
      query.hasExpiry = true;
      query.expiryDate = { $lt: now };
    } else if (filters.filter === "expiring_today") {
      const endOfDay = new Date(now);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query.hasExpiry = true;
      query.expiryDate = { $gte: now, $lte: endOfDay };
    } else {
      const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      query.hasExpiry = true;
      query.expiryDate = { $gte: now, $lte: inSevenDays };
    }
  }
  if (filters.q) {
    const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { hashTags: { $regex: escaped, $options: "i" } },
      { category: { $regex: escaped, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Item.find(query)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<ExternalItemDocument[]>(),
    Item.countDocuments(query),
  ]);

  const locationIds = items.flatMap((item) =>
    item.locationId ? [item.locationId] : [],
  );
  const locations = locationIds.length
    ? await Location.find({
        _id: { $in: locationIds },
        familyId: new Types.ObjectId(familyId),
      })
        .select("_id name")
        .lean<Pick<ExternalLocationDocument, "_id" | "name">[]>()
    : [];
  const locationNames = new Map(
    locations.map((location) => [location._id.toString(), location.name]),
  );

  return {
    items: items.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      category: item.category,
      quantity: item.quantity ?? 1,
      hasExpiry: item.hasExpiry,
      expiryDate: item.expiryDate ?? null,
      bestBeforeDate: item.bestBeforeDate ?? null,
      hashTags: item.hashTags,
      location: item.locationId
        ? {
            id: item.locationId.toString(),
            name: locationNames.get(item.locationId.toString()) ?? null,
          }
        : null,
    })),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

export async function getExternalLocations(familyId: string) {
  const locations = await Location.find({
    familyId: new Types.ObjectId(familyId),
  })
    .select("_id name description hashTags createdAt")
    .sort({ createdAt: -1 })
    .lean<ExternalLocationDocument[]>();
  return locations.map((location) => ({
    id: location._id.toString(),
    name: location.name,
    description: location.description ?? "",
    hashTags: location.hashTags ?? [],
    createdAt: location.createdAt,
  }));
}

export async function createExternalItem(
  key: ExternalApiKey,
  data: z.infer<typeof externalItemSchema>,
) {
  const creator = key.createdBy
    ? await User.findOne({ _id: key.createdBy, familyId: key.familyId })
        .select("_id")
        .lean<ExternalCreator | null>()
    : null;
  if (!creator) return null;

  if (data.locationId) {
    const location = await Location.exists({
      _id: data.locationId,
      familyId: key.familyId,
    });
    if (!location) return null;
  }

  const item = await Item.create({
    ...data,
    familyId: key.familyId,
    uploaderId: creator._id,
    locationId: data.locationId || undefined,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
    bestBeforeDate: data.bestBeforeDate ? new Date(data.bestBeforeDate) : undefined,
  });
  return { id: item._id.toString(), name: item.name };
}

export async function createExternalLocation(
  familyId: string,
  data: z.infer<typeof externalLocationSchema>,
) {
  const location = await Location.create({ ...data, familyId });
  return { id: location._id.toString(), name: location.name };
}
