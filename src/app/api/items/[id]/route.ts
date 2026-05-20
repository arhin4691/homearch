// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import "@/models/Location";
import { apiSuccess, apiError } from "@/lib/api-response";
import { deleteImageKitFile } from "@/lib/imagekit";
import { z } from "zod";
import { ITEM_CATEGORIES } from "@/models/Item";

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  quantity: z.number().int().min(0).optional(),
  locationId: z.string().nullable().optional(),
  imageUrl: z.string().url().optional(),
  imageFileId: z.string().optional(),
  hashTags: z.array(z.string()).optional(),
  hasExpiry: z.boolean().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  bestBeforeDate: z.string().datetime().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const item = await Item.findOne({ _id: id, familyId: user.familyId })
      .populate("locationId", "name")
      .populate("uploaderId", "name avatarUrl")
      .lean();

    if (!item) return apiError("Item not found", 404);

    return apiSuccess({
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
        (fid) => fid.toString() === (user._id as { toString(): string }).toString()
      ),
      location: item.locationId
        ? { id: (item.locationId as any)._id?.toString(), name: (item.locationId as any).name }
        : null,
      uploader: item.uploaderId
        ? { name: (item.uploaderId as any).name, avatarUrl: (item.uploaderId as any).avatarUrl }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 422);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const updates: Record<string, unknown> = {};
    const { expiryDate, bestBeforeDate, ...rest } = parsed.data;
    Object.assign(updates, rest);
    if (expiryDate !== undefined) updates.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (bestBeforeDate !== undefined) updates.bestBeforeDate = bestBeforeDate ? new Date(bestBeforeDate) : null;

    const item = await Item.findOneAndUpdate(
      { _id: id, familyId: user.familyId },
      { $set: updates },
      { new: true }
    );
    if (!item) return apiError("Item not found", 404);

    return apiSuccess({ id: item._id.toString(), name: item.name });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const item = await Item.findOneAndDelete({ _id: id, familyId: user.familyId });
    if (!item) return apiError("Item not found", 404);

    if (item.imageFileId) {
      await deleteImageKitFile(item.imageFileId).catch(console.error);
    }

    return apiSuccess({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
