// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { ApiKey } from "@/models/ApiKey";
import { User } from "@/models/User";
import { Family } from "@/models/Family";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const family = await Family.findById(user.familyId).lean();
    if (!family || family.ownerId.toString() !== session.userId) {
      return apiError("Only the family owner can delete API keys", 403);
    }

    const key = await ApiKey.findOneAndDelete({ _id: id, familyId: user.familyId });
    if (!key) return apiError("Key not found", 404);

    return apiSuccess({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
