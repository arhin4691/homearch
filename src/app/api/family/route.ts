// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Family } from "@/models/Family";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { generateFamilyCode } from "@/lib/codes";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({ name: z.string().min(2).max(80) });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 404);

    const family = await Family.findById(user.familyId).lean();
    if (!family) return apiError("Family not found", 404);

    const members = await User.find({ familyId: user.familyId })
      .select("name email avatarUrl userCode _id")
      .lean();

    return apiSuccess({
      id: (family._id as { toString(): string }).toString(),
      name: family.name,
      familyCode: family.familyCode,
      ownerId: family.ownerId.toString(),
      members: (members as any[]).map((m) => ({
        id: m._id.toString(),
        name: m.name,
        email: m.email,
        avatarUrl: m.avatarUrl,
        userCode: m.userCode,
      })),
    });
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 422);

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) return apiError("User not found", 404);
    if (user.familyId) return apiError("Already in a family", 409);

    const familyCode = generateFamilyCode();
    const family = await Family.create({
      name: parsed.data.name,
      ownerId: user._id,
      familyCode,
      qrCodeData: `${process.env.NEXT_PUBLIC_APP_URL}/join-family?code=${familyCode}`,
    });

    user.familyId = family._id;
    await user.save();

    return apiSuccess({ id: family._id.toString(), name: family.name, familyCode }, 201);
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

