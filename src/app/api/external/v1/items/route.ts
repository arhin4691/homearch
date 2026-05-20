// @ts-nocheck
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ApiKey } from "@/models/ApiKey";
import { Item } from "@/models/Item";
import "@/models/Location";
import { comparePassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

async function verifyApiKey(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7);
  await connectDB();

  const keys = await ApiKey.find({}).lean();
  for (const key of keys) {
    const valid = await comparePassword(rawKey, key.apiKeyHash);
    if (valid) return key.familyId.toString();
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const familyId = await verifyApiKey(req);
    if (!familyId) return apiError("Invalid API key", 401);

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter");
    const now = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { familyId };

    if (filter === "expiring_today") {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      query.hasExpiry = true;
      query.expiryDate = { $gte: now, $lte: endOfDay };
    } else if (filter === "expiring_week") {
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      query.hasExpiry = true;
      query.expiryDate = { $gte: now, $lte: in7Days };
    } else if (filter === "expired") {
      query.hasExpiry = true;
      query.expiryDate = { $lt: now };
    }

    const items = await Item.find(query)
      .populate("locationId", "name")
      .sort({ expiryDate: 1 })
      .lean();

    return apiSuccess(
      items.map((item) => ({
        id: (item._id as { toString(): string }).toString(),
        name: item.name,
        category: item.category,
        hasExpiry: item.hasExpiry,
        expiryDate: item.expiryDate,
        bestBeforeDate: item.bestBeforeDate,
        hashTags: item.hashTags,
        location: item.locationId ? { name: (item.locationId as any).name } : null,
      }))
    );
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

