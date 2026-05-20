// @ts-nocheck
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
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
    const options = await generateAuthenticationOptions({
      rpID: getRpId(),
      timeout: 60000,
      allowCredentials: [], // discoverable / resident key — no userId needed
      userVerification: "preferred",
    });

    const state = jwt.sign({ challenge: options.challenge }, JWT_SECRET, {
      expiresIn: "5m",
    });

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
