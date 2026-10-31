// @ts-nocheck
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { isValidObjectId } from "mongoose";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createInventoryAlerts } from "@/lib/inventory-alerts";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).select("_id familyId").lean();
    if (!user) return apiError("User not found", 404);
    if (user.familyId) await createInventoryAlerts(user.familyId, user._id);
    const notifications = await Notification.find({ recipientId: session.userId, clearedAt: null })
      .populate("senderId", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const itemIds = notifications
      .filter((notification) => ["EXPIRY_ALERT", "ITEM_ADDED", "LOW_STOCK"].includes(notification.type))
      .map((notification) => notification.metadata?.itemId)
      .filter((id) => typeof id === "string" && isValidObjectId(id));
    const currentItems = user?.familyId
      ? await Item.find({ _id: { $in: itemIds }, familyId: user.familyId }).select("_id").lean()
      : [];
    const allowedItems = new Set(currentItems.map((item) => item._id.toString()));
    const visible = notifications.filter((notification) => {
      if (!["EXPIRY_ALERT", "ITEM_ADDED", "LOW_STOCK"].includes(notification.type)) return true;
      if (!allowedItems.has(String(notification.metadata?.itemId))) return false;
      if (notification.type === "LOW_STOCK") {
        return String(notification.metadata?.familyId) === String(user.familyId);
      }
      return true;
    });

    return apiSuccess(
      visible.map((n) => ({
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
        clearedAt: null,
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
    await Notification.updateMany(
      { recipientId: session.userId, type: { $in: ["LOW_STOCK", "EXPIRY_ALERT"] }, clearedAt: null },
      { $set: { clearedAt: new Date() } },
    );
    await Notification.deleteMany({
      recipientId: session.userId,
      type: { $nin: ["LOW_STOCK", "EXPIRY_ALERT"] },
    });

    return apiSuccess({ ok: true });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
