import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/friends/search?code=XXXX-XXXX
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
    if (!code) return apiError("code param required", 400);

    await connectDB();
    const user = await User.findOne({ userCode: code }).select("name avatarUrl userCode").lean<{ _id: any; name: string; avatarUrl?: string; userCode: string }>();
    if (!user) return apiError("User not found", 404);

    return apiSuccess({
      id: (user._id as any).toString(),
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      userCode: user.userCode,
    });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
