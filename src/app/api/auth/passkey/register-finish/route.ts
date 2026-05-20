// @ts-nocheck
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
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

function getExpectedOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const cookieStore = await cookies();
    const stateToken = cookieStore.get("webauthn_state")?.value;
    if (!stateToken) return apiError("Challenge expired or missing", 400);

    let state: { challenge: string; userId: string };
    try {
      state = jwt.verify(stateToken, JWT_SECRET) as any;
    } catch {
      return apiError("Invalid or expired challenge", 400);
    }

    // Clear challenge cookie immediately
    cookieStore.set("webauthn_state", "", { maxAge: 0, path: "/" });

    if (state.userId !== session.userId) return apiError("User mismatch", 403);

    const body = await req.json();

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: state.challenge,
      expectedOrigin: getExpectedOrigin(),
      expectedRPID: getRpId(),
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return apiError("Passkey verification failed", 400);
    }

    const { credential } = verification.registrationInfo;

    await connectDB();

    // Upsert so re-registration of same device overwrites
    await PasskeyCredential.findOneAndUpdate(
      { credentialId: credential.id },
      {
        userId: session.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credential.deviceType ?? "singleDevice",
        transports: body.response?.transports ?? [],
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return apiSuccess({ registered: true });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
