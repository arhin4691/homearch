// @ts-nocheck
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { comparePassword, signToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cookies } from "next/headers";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Invalid credentials", 400);

    await connectDB();
    const { email, password, rememberMe } = parsed.data;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return apiError("Invalid email or password", 401);

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) return apiError("Invalid email or password", 401);

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      familyId: user.familyId?.toString(),
    });

    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return apiSuccess({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      userCode: user.userCode,
      familyId: user.familyId?.toString() ?? null,
    });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

