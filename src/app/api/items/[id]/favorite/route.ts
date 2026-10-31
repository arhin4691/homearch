// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";
import { isValidObjectId } from "mongoose";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("Item not found", 404);
    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const item = await Item.findOne({ _id: id, familyId: user.familyId });
    if (!item) return apiError("Item not found", 404);

    const userId = (user._id as { toString(): string }).toString();
    const alreadyFavorited = item.favoritedBy.some((fid) => fid.toString() === userId);

    if (alreadyFavorited) {
      const updated = await Item.findOneAndUpdate({ _id: id, familyId: user.familyId }, { $pull: { favoritedBy: user._id } });
      if (!updated) return apiError("Item not found", 404);
      return apiSuccess({ isFavorite: false });
    } else {
      const updated = await Item.findOneAndUpdate({ _id: id, familyId: user.familyId }, { $addToSet: { favoritedBy: user._id } });
      if (!updated) return apiError("Item not found", 404);
      return apiSuccess({ isFavorite: true });
    }
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
