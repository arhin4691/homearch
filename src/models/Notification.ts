import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType = "FAMILY_INVITE" | "EXPIRY_ALERT" | "ITEM_ADDED" | "LOW_STOCK";
export type NotificationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "READ";

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  senderId?: Types.ObjectId;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: ["FAMILY_INVITE", "EXPIRY_ALERT", "ITEM_ADDED", "LOW_STOCK"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED", "READ"],
      default: "PENDING",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Notification =
  mongoose.models.Notification ??
  mongoose.model<INotification>("Notification", NotificationSchema);
