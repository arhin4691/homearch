import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import type { NotificationType } from "@/models/Notification";
import type { Types } from "mongoose";

export async function notifyFamily({
  familyId,
  type,
  title,
  message,
  metadata,
  senderId,
}: {
  familyId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  senderId?: Types.ObjectId | string | null;
}) {
  const members = await User.find({ familyId }).select("_id").lean();
  if (!members.length) return;

  let recipientIds = (members as { _id: Types.ObjectId }[]).map((m) => m._id);

  // Dedup: if a metadata.itemId is provided, skip recipients who already have
  // a notification of the same type for that item (prevents duplicate spam).
  if (metadata?.itemId) {
    const alreadyNotified = await Notification.find({
      recipientId: { $in: recipientIds },
      type,
      "metadata.itemId": metadata.itemId,
    })
      .distinct("recipientId")
      .lean();

    const alreadySet = new Set(
      (alreadyNotified as Types.ObjectId[]).map((id) => id.toString()),
    );
    recipientIds = recipientIds.filter((id) => !alreadySet.has(id.toString()));
  }

  if (!recipientIds.length) return;

  await Notification.insertMany(
    recipientIds.map((recipientId) => ({
      recipientId,
      senderId: senderId ?? null,
      type,
      status: "PENDING",
      title,
      message,
      metadata,
    })),
  );
}

