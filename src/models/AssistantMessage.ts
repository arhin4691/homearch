import mongoose, { Schema, Types, type Model } from "mongoose";

export interface AssistantMessageRecord {
  familyId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

const schema = new Schema<AssistantMessageRecord>({
  familyId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  conversationId: { type: Schema.Types.ObjectId },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
}, { timestamps: true });

schema.index({ familyId: 1, userId: 1, createdAt: -1 });
schema.index({ familyId: 1, userId: 1, conversationId: 1, createdAt: -1 });

const existing = mongoose.models.AssistantMessage as Model<AssistantMessageRecord> | undefined;
if (existing && !existing.schema.path("conversationId")) {
  existing.schema.add({ conversationId: { type: Schema.Types.ObjectId } });
  existing.recompileSchema();
}

export const AssistantMessage = existing
  ?? mongoose.model<AssistantMessageRecord>("AssistantMessage", schema);
