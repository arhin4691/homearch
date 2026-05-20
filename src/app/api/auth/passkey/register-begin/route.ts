// @ts-nocheck
import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { PasskeyCredential } from "@/models/PasskeyCredential";
import { getSession } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-response";

const JWT_SECRET = process.env.JWT_SECRET!;

function getRpId() {
  const url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    return new URL(url).hostname;
  } catch {
    return "localhost";
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user) return apiError("User not found", 404);

    const existingCredentials = await PasskeyCredential.find({ userId: user._id }).lean();

    const options = await generateRegistrationOptions({
      rpName: "HomeArch",
      rpID: getRpId(),
      userID: isoUint8Array.fromUTF8String(user._id.toString()),
      userName: user.email,
      userDisplayName: user.name,
      timeout: 60000,
      attestationType: "none",
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.credentialId,
        type: "public-key",
        transports: c.transports,
      })),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // Store challenge in a short-lived signed cookie
    const state = jwt.sign(
      { challenge: options.challenge, userId: user._id.toString() },
      JWT_SECRET,
      { expiresIn: "5m" }
    );
    const cookieStore = await cookies();
    cookieStore.set("webauthn_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    return apiSuccess(options);
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
