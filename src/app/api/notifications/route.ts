// @ts-nocheck
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
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

/** Mark all non-invite notifications as READ */
export async function PATCH() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    await Notification.updateMany(
      {
        recipientId: session.userId,
        status: "PENDING",
        type: { $ne: "FAMILY_INVITE" },
      },
      { $set: { status: "READ" } },
    );

    return apiSuccess({ ok: true });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

/** Delete (clear) all notifications for the current user */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    await Notification.deleteMany({ recipientId: session.userId });

    return apiSuccess({ ok: true });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

