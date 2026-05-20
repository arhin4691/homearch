// @ts-nocheck
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user) return apiError("User not found", 404);

    return apiSuccess({
      id: (user._id as { toString(): string }).toString(),
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

