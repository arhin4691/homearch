// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Family } from "@/models/Family";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({ familyCode: z.string().min(4) });

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 422);

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) return apiError("User not found", 404);
    if (user.familyId) return apiError("Already in a family", 409);

    const family = await Family.findOne({ familyCode: parsed.data.familyCode });
    if (!family) return apiError("Family code not found", 404);

    // Send invite notification to owner
    await Notification.create({
      recipientId: family.ownerId,
      senderId: user._id,
      type: "FAMILY_INVITE",
      status: "PENDING",
      title: "Join Family Request",
      message: `${user.name} wants to join your family "${family.name}"`,
      metadata: {
        requesterId: user._id.toString(),
        familyId: family._id.toString(),
        requesterName: user.name,
      },
    });

    return apiSuccess({ message: "Request sent" });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

