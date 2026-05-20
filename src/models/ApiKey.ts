import mongoose, { Schema, Document, Types } from "mongoose";

export interface IApiKey extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  apiKeyHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    apiKeyHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const ApiKey =
  mongoose.models.ApiKey ?? mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
