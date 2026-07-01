import mongoose, { Schema, Document, Types } from "mongoose";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/constants";

export { ITEM_CATEGORIES } from "@/lib/constants";
export type { ItemCategory } from "@/lib/constants";

export interface IItem extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  locationId?: Types.ObjectId;
  uploaderId: Types.ObjectId;
  name: string;
  category: ItemCategory;
  quantity: number;
  imageUrl?: string;
  imageFileId?: string;
  hashTags: string[];
  barcode?: string;
  favoritedBy: Types.ObjectId[];
  hasExpiry: boolean;
  expiryDate?: Date;
  bestBeforeDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IItem>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    uploaderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ITEM_CATEGORIES, default: "Other" },
    quantity: { type: Number, default: 1, min: 0 },
    imageUrl: { type: String },
    imageFileId: { type: String },
    hashTags: [{ type: String, lowercase: true, trim: true }],
    barcode: { type: String, trim: true },
    favoritedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    hasExpiry: { type: Boolean, default: true },
    expiryDate: { type: Date },
    bestBeforeDate: { type: Date },
  },
  { timestamps: true }
);

ItemSchema.index({ familyId: 1, name: "text", hashTags: "text" });
ItemSchema.index({ familyId: 1, barcode: 1 });

export const Item = mongoose.models.Item ?? mongoose.model<IItem>("Item", ItemSchema);
