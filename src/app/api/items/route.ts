// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import "@/models/Location";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";
import { ITEM_CATEGORIES } from "@/models/Item";

const schema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(ITEM_CATEGORIES).default("Other"),
  quantity: z.number().int().min(0).default(1),
  locationId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageFileId: z.string().optional(),
  hashTags: z.array(z.string()).default([]),
  hasExpiry: z.boolean().default(true),
  expiryDate: z.string().datetime().optional(),
  bestBeforeDate: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const url = new URL(req.url);
    const search = url.searchParams.get("q");
    const category = url.searchParams.get("category");
    const locationId = url.searchParams.get("locationId");
    const favorite = url.searchParams.get("favorite");
    const filter = url.searchParams.get("filter"); // "expired" | "expiring"
    const sort = url.searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "6", 10)));
    const paginate = url.searchParams.get("paginate") !== "false";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { familyId: user.familyId };
    if (category) query.category = category;
    if (locationId) query.locationId = locationId;
    if (favorite === "true") query.favoritedBy = user._id;

    if (filter === "expired") {
      query.hasExpiry = true;
      query.expiryDate = { $lt: new Date() };
    } else if (filter === "expiring") {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      query.hasExpiry = true;
      query.expiryDate = { $gte: new Date(), $lte: sevenDaysFromNow };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { hashTags: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const sortMap: Record<string, object> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      qty_asc: { quantity: 1 },
      qty_desc: { quantity: -1 },
    };
    const sortQuery = sortMap[sort] ?? sortMap.newest;

    const baseQuery = Item.find(query)
      .populate("locationId", "name")
      .populate("uploaderId", "name avatarUrl")
      .sort(sortQuery);

    const items = paginate
      ? await baseQuery.skip((page - 1) * limit).limit(limit).lean()
      : await baseQuery.lean();

    const total = paginate ? await Item.countDocuments(query) : items.length;

    const mapped = items.map((item) => ({
      id: (item._id as { toString(): string }).toString(),
      name: item.name,
      category: item.category,
      quantity: (item as any).quantity ?? 1,
      imageUrl: item.imageUrl,
      hasExpiry: item.hasExpiry,
      expiryDate: item.expiryDate,
      bestBeforeDate: item.bestBeforeDate,
      hashTags: item.hashTags,
      isFavorite: (item.favoritedBy as { toString(): string }[]).some(
        (id) => id.toString() === (user._id as { toString(): string }).toString()
      ),
      location: item.locationId
        ? { id: (item.locationId as any)._id?.toString(), name: (item.locationId as any).name }
        : null,
      uploader: item.uploaderId
        ? { name: (item.uploaderId as any).name, avatarUrl: (item.uploaderId as any).avatarUrl }
        : null,
      createdAt: item.createdAt,
    }));

    return apiSuccess({ items: mapped, total, page, limit, hasMore: paginate ? page * limit < total : false });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 422);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const { expiryDate, bestBeforeDate, ...rest } = parsed.data;
    const item = await Item.create({
      ...rest,
      familyId: user.familyId,
      uploaderId: user._id,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      bestBeforeDate: bestBeforeDate ? new Date(bestBeforeDate) : undefined,
    });

    // Notify all family members
    const members = await User.find({
      familyId: user.familyId,
      _id: { $ne: user._id },
    }).select("_id").lean();

    await Notification.insertMany(
      (members as any[]).map((m) => ({
        recipientId: m._id,
        senderId: user._id,
        type: "ITEM_ADDED",
        status: "PENDING",
        title: "New Item Added",
        message: `${(user as any).name} added "${item.name}"`,
        metadata: { itemId: item._id.toString() },
      }))
    );

    return apiSuccess({ id: item._id.toString(), name: item.name }, 201);
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

