// @ts-nocheck
import { NextRequest } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { PasskeyCredential } from "@/models/PasskeyCredential";
import { signToken } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getRpId, getExpectedOrigins } from "@/lib/webauthn";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const stateToken = cookieStore.get("webauthn_state")?.value;
    if (!stateToken) return apiError("Challenge expired or missing", 400);

    let state: { challenge: string };
    try {
      state = jwt.verify(stateToken, JWT_SECRET) as any;
    } catch {
      return apiError("Invalid or expired challenge", 400);
    }

    // Clear challenge cookie
    cookieStore.set("webauthn_state", "", { maxAge: 0, path: "/" });

    const body = await req.json();
    const expectedOrigins = getExpectedOrigins(req.url);
    const rpId = getRpId(req.url);

    await connectDB();

    // Look up the credential by the id sent by the authenticator
    const storedCredential = await PasskeyCredential.findOne({
      credentialId: body.id,
    }).lean();
    if (!storedCredential) return apiError("Unknown credential", 404);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: state.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpId,
      requireUserVerification: false,
      credential: {
        id: storedCredential.credentialId,
        publicKey: new Uint8Array(storedCredential.publicKey.buffer ?? storedCredential.publicKey),
        counter: storedCredential.counter,
        transports: storedCredential.transports,
      },
    });

    if (!verification.verified) return apiError("Passkey verification failed", 401);

    // Update counter to prevent replay attacks
    await PasskeyCredential.updateOne(
      { _id: storedCredential._id },
      { counter: verification.authenticationInfo.newCounter }
    );

    const user = await User.findById(storedCredential.userId).lean();
    if (!user) return apiError("User not found", 404);

    // Issue a 30-day session (biometric = trusted device)
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      familyId: user.familyId?.toString(),
    });

    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
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
