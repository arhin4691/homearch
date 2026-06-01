import mongoose, { Schema, Document, Types } from "mongoose";

export interface IRecipe extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  createdBy: Types.ObjectId;
  recipeName: string;
  difficulty: "Easy" | "Medium" | "Hard";
  prepTime: string;
  cookingTime: string;
  ingredientsUsed: string[];
  pantryAdditions: string[];
  steps: string[];
  chefTip: string;
  tags: string[];
  isUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RecipeSchema = new Schema<IRecipe>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipeName: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    prepTime: { type: String, default: "" },
    cookingTime: { type: String, default: "" },
    ingredientsUsed: [{ type: String }],
    pantryAdditions: [{ type: String }],
    steps: [{ type: String }],
    chefTip: { type: String, default: "" },
    tags: [{ type: String, lowercase: true, trim: true }],
    isUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RecipeSchema.index({ familyId: 1, recipeName: "text", tags: "text" });

export const Recipe =
  mongoose.models.Recipe ?? mongoose.model<IRecipe>("Recipe", RecipeSchema);
