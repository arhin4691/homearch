import mongoose, { Schema, Types, type Model } from "mongoose";

export interface AssistantProposalRecord {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  action: "add" | "update" | "deduct" | "delete";
  itemId: Types.ObjectId;
  expectedUpdatedAt?: Date;
  expectedQuantity?: number;
  fields: Record<string, unknown>;
  preview: string;
  status: "pending" | "executing" | "completed" | "failed";
  expiresAt: Date;
}

const schema = new Schema<AssistantProposalRecord>({
  familyId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  conversationId: { type: Schema.Types.ObjectId },
  action: { type: String, enum: ["add", "update", "deduct", "delete"], required: true },
  itemId: { type: Schema.Types.ObjectId, required: true },
  expectedUpdatedAt: { type: Date },
  expectedQuantity: { type: Number },
  fields: { type: Schema.Types.Mixed, required: true },
  preview: { type: String, required: true },
  status: { type: String, enum: ["pending", "executing", "completed", "failed"], default: "pending" },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ familyId: 1, userId: 1, status: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

const existing = mongoose.models.AssistantProposal as Model<AssistantProposalRecord> | undefined;
if (existing && !existing.schema.path("conversationId")) {
  existing.schema.add({ conversationId: { type: Schema.Types.ObjectId } });
  existing.recompileSchema();
}

export const AssistantProposal = existing
  ?? mongoose.model<AssistantProposalRecord>("AssistantProposal", schema);
