import { NextRequest } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-response";
import { User } from "@/models/User";
import { Item } from "@/models/Item";
import {
  AssistantProposal,
  type AssistantProposalRecord,
} from "@/models/AssistantProposal";
import { deleteImageKitFile } from "@/lib/imagekit";
import { inventoryUpdatePipeline } from "@/lib/inventory-update";

const schema = z
  .object({ id: z.string().refine(isValidObjectId), confirm: z.literal(true) })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid confirmation", 422);
    await connectDB();
    const user = await User.findById(session.userId)
      .select("_id familyId")
      .lean<{ _id: Types.ObjectId; familyId?: Types.ObjectId } | null>();
    if (!user?.familyId) return apiError("Not in a family", 403);
    const scope = {
      _id: parsed.data.id,
      familyId: user.familyId,
      userId: user._id,
    };
    const proposal = await AssistantProposal.findOneAndUpdate(
      { ...scope, status: "pending", expiresAt: { $gt: new Date() } },
      { $set: { status: "executing" } },
      { new: true },
    ).lean<AssistantProposalRecord | null>();
    if (!proposal) {
      const exists = await AssistantProposal.exists(scope);
      return exists
        ? apiError("Confirmation expired or already used", 409)
        : apiError("Proposal not found", 404);
    }

    try {
      const stillMember = await User.exists({
        _id: user._id,
        familyId: user.familyId,
      });
      if (!stillMember) {
        await AssistantProposal.updateOne(
          { ...scope, status: "executing" },
          { $set: { status: "failed" } },
        );
        return apiError("Not in a family", 403);
      }

      if (
        proposal.action !== "add" &&
        (!proposal.expectedUpdatedAt ||
          !Number.isInteger(proposal.expectedQuantity))
      ) {
        await AssistantProposal.updateOne(
          { ...scope, status: "executing" },
          { $set: { status: "failed" } },
        );
        return apiError("Invalid preview; request a new one", 409);
      }

      let imageCleanupFailed = false;
      if (proposal.action === "add") {
        await Item.create({
          ...proposal.fields,
          _id: proposal.itemId,
          familyId: user.familyId,
          uploaderId: user._id,
        });
      } else {
        const filter = {
          _id: proposal.itemId,
          familyId: user.familyId,
          updatedAt: proposal.expectedUpdatedAt,
          quantity: proposal.expectedQuantity,
        };
        const deleted =
          proposal.action === "delete"
            ? await Item.findOneAndDelete(filter)
            : null;
        const result =
          proposal.action !== "delete"
            ? await Item.updateOne(
                filter,
                inventoryUpdatePipeline(proposal.fields),
              )
            : null;
        const matched =
          proposal.action === "delete" ? !!deleted : !!result?.matchedCount;
        if (!matched) {
          await AssistantProposal.updateOne(
            { ...scope, status: "executing" },
            { $set: { status: "failed" } },
          );
          return apiError(
            "Item changed or no longer exists; request a new preview",
            409,
          );
        }
        if (deleted?.imageFileId) {
          try {
            await deleteImageKitFile(deleted.imageFileId);
          } catch (error) {
            console.error("Deleted item image cleanup failed", error);
            imageCleanupFailed = true;
          }
        }
      }
      await AssistantProposal.updateOne(
        { ...scope, status: "executing" },
        { $set: { status: "completed" } },
      );
      return apiSuccess({ completed: true, imageCleanupFailed });
    } catch (error) {
      console.error("Assistant confirmation failed", error);
      await AssistantProposal.updateOne(
        { ...scope, status: "executing" },
        { $set: { status: "failed" } },
      );
      return apiError(
        "Operation could not be confirmed; check inventory before retrying",
        500,
      );
    }
  } catch (error) {
    console.error("Assistant confirmation request failed", error);
    return apiError("Confirmation failed", 500);
  }
}
