// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    await connectDB();
    const notif = await Notification.findOne({ _id: id, recipientId: session.userId });
    if (!notif) return apiError("Notification not found", 404);

    if (action === "accept" && notif.type === "FAMILY_INVITE") {
      const meta = notif.metadata as any;
      await User.findByIdAndUpdate(meta.requesterId, { familyId: meta.familyId });
      notif.status = "ACCEPTED";
    } else if (action === "decline" && notif.type === "FAMILY_INVITE") {
      notif.status = "DECLINED";
    } else if (action === "unread") {
      notif.status = "PENDING";
    } else {
      notif.status = "READ";
    }

    await notif.save();
    return apiSuccess({ status: notif.status });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
