// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { inventoryUpdatePipeline } from "@/lib/inventory-update";

const schema = z.object({ delta: z.number().int() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("Item not found", 404);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success || parsed.data.delta === 0) return apiError("Invalid delta", 422);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const newQuantity = { $add: [{ $ifNull: ["$quantity", 1] }, parsed.data.delta] };
    const item = await Item.findOneAndUpdate(
      { _id: id, familyId: user.familyId, $expr: { $gte: [newQuantity, 0] } },
      inventoryUpdatePipeline({}, { quantity: newQuantity }),
      { new: true },
    );
    if (!item) {
      const exists = await Item.exists({ _id: id, familyId: user.familyId });
      return exists ? apiError("Insufficient quantity", 409) : apiError("Item not found", 404);
    }

    const newQty = item.quantity;

    return apiSuccess({ quantity: newQty });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
