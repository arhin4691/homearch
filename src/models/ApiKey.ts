import mongoose, { Schema, Document, Types } from "mongoose";
import { API_KEY_PERMISSIONS, type ApiKeyPermission } from "@/lib/api-key-permissions";

export interface IApiKey extends Document {
  _id: Types.ObjectId;
  keyId: string;
  familyId: Types.ObjectId;
  createdBy: Types.ObjectId;
  apiKeyHash: string;
  name: string;
  permissions: ApiKeyPermission[];
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    keyId: { type: String, unique: true, sparse: true },
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    apiKeyHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    permissions: {
      type: [{ type: String, enum: API_KEY_PERMISSIONS }],
      default: [],
    },
  },
  { timestamps: true }
);

export const ApiKey =
  mongoose.models.ApiKey ?? mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
