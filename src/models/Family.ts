import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFamily extends Document {
  _id: Types.ObjectId;
  name: string;
  ownerId: Types.ObjectId;
  familyCode: string;
  qrCodeData?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FamilySchema = new Schema<IFamily>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    familyCode: { type: String, required: true, unique: true },
    qrCodeData: { type: String },
  },
  { timestamps: true }
);

export const Family = mongoose.models.Family ?? mongoose.model<IFamily>("Family", FamilySchema);
