import { NextRequest } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { Location } from "@/models/Location";
import { VoiceProposal, type VoiceOperation } from "@/models/VoiceProposal";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
const schema = z
  .object({
    items: z
      .array(
        z
          .object({
            matchedItemId: z.string().refine(isValidObjectId).nullable(),
            name: z.string().trim().min(1).max(100),
            category: z.enum(ITEM_CATEGORIES).nullable(),
            action: z.enum(["ADD", "REMOVE"]),
            quantity: z.number().int().min(1).max(100000),
            hasExpiry: z.boolean().nullable(),
            expiryDate: date.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid voice preview", 422);
    await connectDB();
    const user = await User.findById(session.userId)
      .select("_id familyId")
      .lean<{ _id: Types.ObjectId; familyId?: Types.ObjectId } | null>();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const operations: VoiceOperation[] = [];
    const seenIds = new Set<string>();
    const seenNewNames = new Set<string>();
    for (const input of parsed.data.items) {
      const escaped = input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (input.matchedItemId) {
        if (seenIds.has(input.matchedItemId))
          return apiError("The same item appears more than once", 409);
        seenIds.add(input.matchedItemId);
        const existing = await Item.findOne({
          _id: input.matchedItemId,
          familyId: user.familyId,
        })
          .select("_id name category quantity updatedAt locationId")
          .lean<{
            _id: Types.ObjectId;
            name: string;
            category: string;
            quantity: number;
            updatedAt?: Date;
            locationId?: Types.ObjectId | null;
          } | null>();
        if (!existing) return apiError("Item not found", 404);
        if (
          existing.name.toLocaleLowerCase() !== input.name.toLocaleLowerCase()
        )
          return apiError("Item changed; review again", 409);
        if (!existing.updatedAt || !Number.isSafeInteger(existing.quantity))
          return apiError("Item needs a valid quantity and revision", 409);
        if (input.action === "REMOVE" && input.quantity > existing.quantity)
          return apiError("Insufficient quantity", 409);
        const afterQuantity =
          input.action === "ADD"
            ? existing.quantity + input.quantity
            : existing.quantity - input.quantity;
        if (!Number.isSafeInteger(afterQuantity) || afterQuantity > 100000)
          return apiError("Quantity is too large", 422);
        const location = existing.locationId
          ? await Location.findOne({
              _id: existing.locationId,
              familyId: user.familyId,
            })
              .select("name")
              .lean<{ name: string } | null>()
          : null;
        operations.push({
          itemId: existing._id,
          action: input.action,
          name: existing.name,
          category: existing.category,
          locationName: location?.name ?? null,
          quantity: input.quantity,
          beforeQuantity: existing.quantity,
          afterQuantity,
          expectedUpdatedAt: existing.updatedAt,
          createsItem: false,
        });
      } else {
        if (input.action === "REMOVE") return apiError("Item not found", 404);
        if (
          !input.category ||
          input.hasExpiry === null ||
          input.hasExpiry !== !!input.expiryDate
        ) {
          return apiError("Specify the category and expiry information", 422);
        }
        const key = input.name.toLocaleLowerCase();
        if (seenNewNames.has(key))
          return apiError("The same item appears more than once", 409);
        seenNewNames.add(key);
        if (
          await Item.exists({
            familyId: user.familyId,
            name: { $regex: `^${escaped}$`, $options: "i" },
          })
        ) {
          return apiError("Item already exists; choose an item", 409);
        }
        operations.push({
          itemId: new Types.ObjectId(),
          action: "ADD",
          name: input.name,
          category: input.category,
          quantity: input.quantity,
          beforeQuantity: 0,
          afterQuantity: input.quantity,
          createsItem: true,
          hasExpiry: input.hasExpiry,
          expiryDate: input.expiryDate
            ? new Date(`${input.expiryDate}T00:00:00.000Z`)
            : null,
        });
      }
    }

    const proposal = await VoiceProposal.create({
      familyId: user.familyId,
      userId: user._id,
      operations,
      expiresAt: new Date(Date.now() + 15 * 60000),
    });
    return apiSuccess({ id: proposal._id.toString(), operations });
  } catch (error) {
    console.error("Voice preview preparation failed", error);
    return apiError("Voice preview preparation failed", 500);
  }
}
