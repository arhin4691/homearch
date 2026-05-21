// @ts-nocheck
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/auth";
import { signToken } from "@/lib/auth";
import { generateUserCode } from "@/lib/codes";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cookies } from "next/headers";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-z0-9_]+$/i, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8),
  name: z.string().min(2).max(60),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 422);
    }

    await connectDB();
    const { email, username, password, name } = parsed.data;

    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }).lean(),
      User.findOne({ username: username.toLowerCase() }).lean(),
    ]);
    if (existingEmail) return apiError("Email already registered", 409);
    if (existingUsername) return apiError("Username already taken", 409);

    const passwordHash = await hashPassword(password);
    const userCode = generateUserCode();

    const user = await User.create({ email, username: username.toLowerCase(), passwordHash, name, userCode });

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

    return apiSuccess(
      {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name,
        userCode: user.userCode,
        familyId: null,
      },
      201
    );
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

