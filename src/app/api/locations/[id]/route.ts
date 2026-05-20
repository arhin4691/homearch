// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Location } from "@/models/Location";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";
import { deleteImageKitFile } from "@/lib/imagekit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(200).optional(),
  imageUrl: z.string().url().optional(),
  imageFileId: z.string().optional(),
  hashTags: z.array(z.string().max(30)).max(20).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const loc = await Location.findOne({ _id: id, familyId: user.familyId }).lean();
    if (!loc) return apiError("Location not found", 404);

    const items = await Item.find({ locationId: id, familyId: user.familyId })
      .sort({ createdAt: -1 })
      .lean();

    return apiSuccess({
      id: (loc._id as { toString(): string }).toString(),
      name: loc.name,
      description: loc.description,
      imageUrl: loc.imageUrl,
      items: items.map((item) => ({
        id: (item._id as { toString(): string }).toString(),
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        hasExpiry: item.hasExpiry,
        expiryDate: item.expiryDate,
        bestBeforeDate: item.bestBeforeDate,
        hashTags: item.hashTags,
      })),
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

    const loc = await Location.findOneAndUpdate(
      { _id: id, familyId: user.familyId },
      { $set: parsed.data },
      { new: true }
    );
    if (!loc) return apiError("Location not found", 404);

    return apiSuccess({ id: loc._id.toString(), name: loc.name, imageUrl: loc.imageUrl });
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

    const loc = await Location.findOneAndDelete({ _id: id, familyId: user.familyId });
    if (!loc) return apiError("Location not found", 404);

    if (loc.imageFileId) {
      await deleteImageKitFile(loc.imageFileId).catch(console.error);
    }

    // Unassign items from this location
    await Item.updateMany({ locationId: id }, { $unset: { locationId: "" } });

    return apiSuccess({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
