// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Location } from "@/models/Location";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  imageUrl: z.string().url().optional(),
  imageFileId: z.string().optional(),
  hashTags: z.array(z.string().max(30)).max(20).default([]),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const locations = await Location.find({ familyId: user.familyId })
      .sort({ createdAt: -1 })
      .lean();

    const locationIds = locations.map((l) => l._id);
    const counts = await Item.aggregate([
      { $match: { locationId: { $in: locationIds }, familyId: user.familyId } },
      { $group: { _id: "$locationId", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c._id.toString()] = c.count;

    return apiSuccess(
      locations.map((l) => ({
        id: (l._id as { toString(): string }).toString(),
        name: l.name,
        description: l.description,
        imageUrl: l.imageUrl,
        hashTags: (l as any).hashTags ?? [],
        itemCount: countMap[(l._id as { toString(): string }).toString()] ?? 0,
        familyId: l.familyId.toString(),
        createdAt: l.createdAt,
      }))
    );
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

    const loc = await Location.create({ ...parsed.data, familyId: user.familyId });
    return apiSuccess({ id: loc._id.toString(), name: loc.name, imageUrl: loc.imageUrl }, 201);
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

