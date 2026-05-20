// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { comparePassword, hashPassword, signToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cookies } from "next/headers";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).max(60).optional(),
  avatarUrl: z.string().url().optional(),
  avatarFileId: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 422);

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) return apiError("User not found", 404);

    const { name, avatarUrl, avatarFileId, currentPassword, newPassword } = parsed.data;

    if (name) user.name = name;
    if (avatarUrl) user.avatarUrl = avatarUrl;
    if (avatarFileId) user.avatarFileId = avatarFileId;

    if (currentPassword && newPassword) {
      const valid = await comparePassword(currentPassword, user.passwordHash);
      if (!valid) return apiError("Current password is incorrect", 400);
      user.passwordHash = await hashPassword(newPassword);
    }

    await user.save();

    // Refresh token
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      familyId: user.familyId?.toString(),
    });

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return apiSuccess({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      userCode: user.userCode,
    });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

