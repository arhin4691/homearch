// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Recipe } from "@/models/Recipe";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const saveSchema = z.object({
  recipeName: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  prepTime: z.string().default(""),
  cookingTime: z.string().default(""),
  ingredientsUsed: z.array(z.string()).default([]),
  pantryAdditions: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),
  chefTip: z.string().default(""),
  tags: z.array(z.string()).default([]),
  isUsed: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(20, Number(url.searchParams.get("limit") ?? "12"));

    const query: Record<string, unknown> = { familyId: user.familyId };
    if (search) {
      query.$or = [
        { recipeName: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Recipe.countDocuments(query);
    const recipes = await Recipe.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const formatted = recipes.map((r) => ({
      id: r._id.toString(),
      recipeName: r.recipeName,
      difficulty: r.difficulty,
      prepTime: r.prepTime,
      cookingTime: r.cookingTime,
      ingredientsUsed: r.ingredientsUsed,
      pantryAdditions: r.pantryAdditions,
      steps: r.steps,
      chefTip: r.chefTip,
      tags: r.tags,
      isUsed: r.isUsed,
      createdAt: r.createdAt,
    }));

    return apiSuccess({
      recipes: formatted,
      total,
      hasMore: page * limit < total,
    });
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : "Failed to load recipes");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const body = await req.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) return apiError("Invalid recipe data", 400);

    const recipe = await Recipe.create({
      ...parsed.data,
      familyId: user.familyId,
      createdBy: session.userId,
    });

    return apiSuccess({ id: recipe._id.toString() }, 201);
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : "Failed to save recipe");
  }
}
