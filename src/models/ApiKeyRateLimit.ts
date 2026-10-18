import mongoose, { Schema } from "mongoose";

interface IApiKeyRateLimit {
  _id: string;
  timestamps: Date[];
  expiresAt: Date;
}

const ApiKeyRateLimitSchema = new Schema<IApiKeyRateLimit>(
  {
    _id: { type: String, required: true },
    timestamps: { type: [Date], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

ApiKeyRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ApiKeyRateLimit =
  mongoose.models.ApiKeyRateLimit ??
  mongoose.model<IApiKeyRateLimit>("ApiKeyRateLimit", ApiKeyRateLimitSchema);
