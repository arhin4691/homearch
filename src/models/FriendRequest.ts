import mongoose, { Schema, Document, Types } from "mongoose";

export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface IFriendRequest extends Document {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const FriendRequestSchema = new Schema<IFriendRequest>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

// Unique index: one pending request between a pair at a time
FriendRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

export const FriendRequest =
  mongoose.models.FriendRequest ??
  mongoose.model<IFriendRequest>("FriendRequest", FriendRequestSchema);
