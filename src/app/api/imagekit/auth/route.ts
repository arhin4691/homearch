// @ts-nocheck
import { getSession } from "@/lib/session";
import { getImageKitAuthParams } from "@/lib/imagekit";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const auth = await getImageKitAuthParams();
    return apiSuccess(auth);
  } catch (e) {
    console.error(e);
    return apiError("Failed to get auth params", 500);
  }
}

