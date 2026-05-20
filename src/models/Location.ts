import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILocation extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  name: string;
  imageUrl?: string;
  imageFileId?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String },
    imageFileId: { type: String },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Location =
  mongoose.models.Location ?? mongoose.model<ILocation>("Location", LocationSchema);
