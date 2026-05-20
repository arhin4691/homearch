import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPasskeyCredential extends Document {
  userId: mongoose.Types.ObjectId;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  deviceType: string;
  transports: string[];
  createdAt: Date;
}

const PasskeyCredentialSchema = new Schema<IPasskeyCredential>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  credentialId: { type: String, required: true, unique: true },
  publicKey: { type: Buffer, required: true },
  counter: { type: Number, default: 0 },
  deviceType: { type: String, default: "singleDevice" },
  transports: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export const PasskeyCredential: Model<IPasskeyCredential> =
  (mongoose.models.PasskeyCredential as Model<IPasskeyCredential>) ||
  mongoose.model<IPasskeyCredential>("PasskeyCredential", PasskeyCredentialSchema);
