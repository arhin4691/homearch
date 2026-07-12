import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ITEM_CATEGORIES } from "@/lib/constants";

const itemSchema = z.object({
  matchedItemId: z.string().nullable(),
  name: z.string().min(1).max(100),
  category: z.string(),
  action: z.enum(["ADD", "REMOVE"]),
  quantity: z.number().int().min(1),
  hasExpiry: z.boolean(),
  expiryDate: z.string().nullable(),
});

const commitSchema = z.object({
  items: z.array(itemSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const parsed = commitSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 422);

    await connectDB();
    const user = (await User.findById(session.userId).lean()) as any;
    if (!user?.familyId) return apiError("Not in a family", 403);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = [];
    const results: { name: string; newQuantity: number; created: boolean }[] = [];

    for (const it of parsed.data.items) {
      const category = (ITEM_CATEGORIES as readonly string[]).includes(it.category)
        ? it.category
        : "Other";
      const expiryDate = it.hasExpiry && it.expiryDate ? new Date(it.expiryDate) : undefined;

      const existing = it.matchedItemId
        ? ((await Item.findOne({ _id: it.matchedItemId, familyId: user.familyId })
            .select("quantity")
            .lean()) as any)
        : null;

      if (existing) {
        const currentQty = existing.quantity ?? 1;
        const newQty =
          it.action === "ADD" ? currentQty + it.quantity : Math.max(currentQty - it.quantity, 0);
        const setFields: Record<string, unknown> = { quantity: newQty };
        if (it.hasExpiry && expiryDate) {
          setFields.hasExpiry = true;
          setFields.expiryDate = expiryDate;
        } else if (!it.hasExpiry) {
          setFields.hasExpiry = false;
          setFields.expiryDate = null;
        }
        ops.push({
          updateOne: {
            filter: { _id: it.matchedItemId, familyId: user.familyId },
            update: { $set: setFields },
          },
        });
        results.push({ name: it.name, newQuantity: newQty, created: false });
      } else {
        // No match in DB: only makes sense to create a brand-new item for ADD.
        // A REMOVE on a non-existent item has nothing to do — skip it.
        if (it.action === "REMOVE") continue;
        ops.push({
          insertOne: {
            document: {
              familyId: user.familyId,
              uploaderId: user._id,
              name: it.name,
              category,
              quantity: it.quantity,
              hasExpiry: it.hasExpiry,
              expiryDate,
              hashTags: [],
              favoritedBy: [],
            },
          },
        });
        results.push({ name: it.name, newQuantity: it.quantity, created: true });
      }
    }

    if (ops.length === 0) return apiError("Nothing to apply", 400);

    await Item.bulkWrite(ops);

    return apiSuccess({ applied: results.length, results });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
