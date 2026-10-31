import mongoose, { Schema, Types } from "mongoose";

export interface VoiceOperation {
  itemId: Types.ObjectId;
  action: "ADD" | "REMOVE";
  name: string;
  category: string;
  locationName?: string | null;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  expectedUpdatedAt?: Date;
  createsItem: boolean;
  hasExpiry?: boolean;
  expiryDate?: Date | null;
}

export interface VoiceProposalRecord {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  userId: Types.ObjectId;
  operations: VoiceOperation[];
  status: "pending" | "completed";
  expiresAt: Date;
}

const operationSchema = new Schema<VoiceOperation>({
  itemId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, enum: ["ADD", "REMOVE"], required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  locationName: { type: String, default: null },
  quantity: { type: Number, required: true },
  beforeQuantity: { type: Number, required: true },
  afterQuantity: { type: Number, required: true },
  expectedUpdatedAt: { type: Date },
  createsItem: { type: Boolean, required: true },
  hasExpiry: { type: Boolean },
  expiryDate: { type: Date },
}, { _id: false });

const schema = new Schema<VoiceProposalRecord>({
  familyId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  operations: { type: [operationSchema], required: true },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ familyId: 1, userId: 1, status: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const VoiceProposal = mongoose.models.VoiceProposal
  ?? mongoose.model<VoiceProposalRecord>("VoiceProposal", schema);
