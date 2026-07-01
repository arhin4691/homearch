import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProductDictionary extends Document {
  _id: Types.ObjectId;
  barcode: string;
  name: string;
  category: string;
  hashTags: string[];
  imageUrl?: string;
  imageFileId?: string;
  uploaderId?: Types.ObjectId;
  createdAt: Date;
}

const ProductDictionarySchema = new Schema<IProductDictionary>(
  {
    barcode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    hashTags: [{ type: String, lowercase: true, trim: true }],
    imageUrl: { type: String },
    imageFileId: { type: String },
    uploaderId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ProductDictionary =
  mongoose.models.ProductDictionary ??
  mongoose.model<IProductDictionary>("ProductDictionary", ProductDictionarySchema);
