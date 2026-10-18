// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { ApiKey } from "@/models/ApiKey";
import { User } from "@/models/User";
import { Family } from "@/models/Family";
import { generateApiKey, parseApiKey } from "@/lib/codes";
import { hashPassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { API_KEY_PERMISSIONS } from "@/lib/api-key-permissions";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  permissions: z
    .array(z.enum(API_KEY_PERMISSIONS))
    .min(1)
    .max(API_KEY_PERMISSIONS.length)
    .refine((permissions) => new Set(permissions).size === permissions.length),
});

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
        permissions: k.permissions ?? [],
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
    const parsedKey = parseApiKey(rawKey);
    if (!parsedKey) throw new Error("Generated API key had an invalid format");
    const apiKeyHash = await hashPassword(rawKey);

    const created = await ApiKey.create({
      keyId: parsedKey.keyId,
      familyId: user.familyId,
      createdBy: user._id,
      apiKeyHash,
      name: parsed.data.name,
      permissions: parsed.data.permissions,
    });

    return apiSuccess(
      {
        id: created._id.toString(),
        key: rawKey,
        permissions: parsed.data.permissions,
      },
      201,
    );
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
