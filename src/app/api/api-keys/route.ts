// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { ApiKey } from "@/models/ApiKey";
import { User } from "@/models/User";
import { Family } from "@/models/Family";
import { generateApiKey } from "@/lib/codes";
import { hashPassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1).max(60) });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const family = await Family.findById(user.familyId).lean();
    if (!family || family.ownerId.toString() !== session.userId) {
      return apiError("Only the family owner can manage API keys", 403);
    }

    const keys = await ApiKey.find({ familyId: user.familyId })
      .select("-apiKeyHash")
      .sort({ createdAt: -1 })
      .lean();

    return apiSuccess(
      keys.map((k) => ({
        id: (k._id as { toString(): string }).toString(),
        name: k.name,
        createdAt: k.createdAt,
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

    const family = await Family.findById(user.familyId).lean();
    if (!family || family.ownerId.toString() !== session.userId) {
      return apiError("Only the family owner can create API keys", 403);
    }

    const rawKey = generateApiKey();
    const apiKeyHash = await hashPassword(rawKey);

    await ApiKey.create({
      familyId: user.familyId,
      apiKeyHash,
      name: parsed.data.name,
    });

    // Return plaintext key ONCE ??not stored
    return apiSuccess({ key: rawKey }, 201);
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

