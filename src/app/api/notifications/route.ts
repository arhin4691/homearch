// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const notifications = await Notification.find({ recipientId: session.userId })
      .populate("senderId", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return apiSuccess(
      notifications.map((n) => ({
        id: (n._id as { toString(): string }).toString(),
        type: n.type,
        status: n.status,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        sender: n.senderId
          ? { name: (n.senderId as any).name, avatarUrl: (n.senderId as any).avatarUrl }
          : null,
        createdAt: n.createdAt,
      }))
    );
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const body = await req.json();
    const { id, action } = body;

    await connectDB();
    const notif = await Notification.findOne({ _id: id, recipientId: session.userId });
    if (!notif) return apiError("Notification not found", 404);

    if (action === "accept" && notif.type === "FAMILY_INVITE") {
      const meta = notif.metadata as any;
      await User.findByIdAndUpdate(meta.requesterId, { familyId: meta.familyId });
      notif.status = "ACCEPTED";
    } else if (action === "decline" && notif.type === "FAMILY_INVITE") {
      notif.status = "DECLINED";
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

