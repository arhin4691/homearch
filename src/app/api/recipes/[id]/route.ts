// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Recipe } from "@/models/Recipe";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (body.markUsed === true) updates.isUsed = true;
    else if (typeof body.recipeName === "string") updates.recipeName = body.recipeName;
    else return apiError("Invalid update", 422);
    const recipe = await Recipe.findOneAndUpdate(
      { _id: (await params).id, familyId: user.familyId },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!recipe) return apiError("Recipe not found", 404);

    return apiSuccess({ id: recipe._id.toString(), isUsed: recipe.isUsed });
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : "Update failed");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const result = await Recipe.deleteOne({
      _id: (await params).id,
      familyId: user.familyId,
    });

    if (result.deletedCount === 0) return apiError("Recipe not found", 404);

    return apiSuccess({ deleted: true });
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : "Delete failed");
  }
}
