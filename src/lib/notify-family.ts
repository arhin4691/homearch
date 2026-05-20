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
  await Notification.insertMany(
    (members as { _id: Types.ObjectId }[]).map((m) => ({
      recipientId: m._id,
      senderId: senderId ?? null,
      type,
      status: "PENDING",
      title,
      message,
      metadata,
    }))
  );
}
