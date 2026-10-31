import { NextRequest } from "next/server";
import mongoose, { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-response";
import { inventoryUpdatePipeline } from "@/lib/inventory-update";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { VoiceProposal, type VoiceProposalRecord } from "@/models/VoiceProposal";

class VoiceCommitError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const schema = z.object({ id: z.string().refine(isValidObjectId), confirm: z.literal(true) }).strict();

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid confirmation", 422);
    await connectDB();
    const user = await User.findById(session.userId).select("_id familyId")
      .lean<{ _id: Types.ObjectId; familyId?: Types.ObjectId } | null>();
    if (!user?.familyId) return apiError("Not in a family", 403);
    const familyId = user.familyId;
    const scope = { _id: parsed.data.id, familyId, userId: user._id };
    const transaction = await mongoose.startSession();
    try {
      let applied = 0;
      await transaction.withTransaction(async () => {
        const stillMember = await User.exists({ _id: user._id, familyId }).session(transaction);
        if (!stillMember) throw new VoiceCommitError("Not in a family", 403);
        const proposal = await VoiceProposal.findOneAndUpdate(
          { ...scope, status: "pending", expiresAt: { $gt: new Date() } },
          { $set: { status: "completed" } },
          { new: true, session: transaction },
        ).lean<VoiceProposalRecord | null>();
        if (!proposal) {
          const exists = await VoiceProposal.exists(scope).session(transaction);
          throw new VoiceCommitError(exists ? "Confirmation expired or already used" : "Proposal not found", exists ? 409 : 404);
        }

        for (const operation of proposal.operations) {
          if (operation.createsItem) {
            const escaped = operation.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            if (await Item.exists({ familyId, name: { $regex: `^${escaped}$`, $options: "i" } }).session(transaction)) {
              throw new VoiceCommitError("Item already exists; review again", 409);
            }
            await Item.create([{
              _id: operation.itemId, familyId, uploaderId: user._id,
              name: operation.name, category: operation.category, quantity: operation.afterQuantity,
              hasExpiry: operation.hasExpiry, expiryDate: operation.expiryDate,
            }], { session: transaction });
          } else {
            if (!operation.expectedUpdatedAt || !Number.isSafeInteger(operation.beforeQuantity) ||
              operation.afterQuantity < 0) throw new VoiceCommitError("Invalid preview", 409);
            const result = await Item.updateOne(
              { _id: operation.itemId, familyId, updatedAt: operation.expectedUpdatedAt, quantity: operation.beforeQuantity },
              inventoryUpdatePipeline({ quantity: operation.afterQuantity }),
              { session: transaction },
            );
            if (!result.matchedCount) throw new VoiceCommitError("Inventory changed; review again", 409);
          }
        }
        applied = proposal.operations.length;
      });
      return apiSuccess({ applied });
    } finally {
      await transaction.endSession();
    }
  } catch (error) {
    if (error instanceof VoiceCommitError) return apiError(error.message, error.status);
    console.error("Voice confirmation failed", error);
    return apiError("Voice confirmation failed; check inventory before retrying", 500);
  }
}
