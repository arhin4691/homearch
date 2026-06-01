// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Recipe } from "@/models/Recipe";
import { Item } from "@/models/Item";
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

    const recipe = await Recipe.findOne({
      _id: (await params).id,
      familyId: user.familyId,
    });
    if (!recipe) return apiError("Recipe not found", 404);

    const body = await req.json().catch(() => ({}));

    // Mark as used: deduct matching food item quantities
    if (body.markUsed) {
      recipe.isUsed = true;
      await recipe.save();

      // Best-effort deduction of each ingredient by 1
      for (const ingredientName of recipe.ingredientsUsed) {
        await Item.findOneAndUpdate(
          {
            familyId: user.familyId,
            category: "Food",
            name: { $regex: new RegExp(`^${ingredientName}$`, "i") },
            quantity: { $gt: 0 },
          },
          { $inc: { quantity: -1 } },
        );
      }
    } else {
      // Generic patch (e.g. rename)
      if (typeof body.recipeName === "string")
        recipe.recipeName = body.recipeName;
      await recipe.save();
    }

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
