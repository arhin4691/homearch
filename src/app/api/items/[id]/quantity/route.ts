// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { notifyFamily } from "@/lib/notify-family";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const LOW_STOCK_THRESHOLD = 2;

const schema = z.object({ delta: z.number().int() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success || parsed.data.delta === 0) return apiError("Invalid delta", 422);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const item = await Item.findOne({ _id: id, familyId: user.familyId });
    if (!item) return apiError("Item not found", 404);

    const newQty = Math.max(0, (item.quantity ?? 1) + parsed.data.delta);
    item.quantity = newQty;
    await item.save();

    // Notify whole family if stock is low (deduped to once per 24 h)
    if (newQty <= LOW_STOCK_THRESHOLD) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const alreadyNotified = await Notification.findOne({
        type: "LOW_STOCK",
        "metadata.itemId": id,
        createdAt: { $gte: oneDayAgo },
      });
      if (!alreadyNotified) {
        await notifyFamily({
          familyId: user.familyId,
          type: "LOW_STOCK",
          title: newQty === 0 ? "Out of Stock" : "Low Stock Alert",
          message:
            newQty === 0
              ? `"${item.name}" is now out of stock`
              : `"${item.name}" is running low — only ${newQty} left`,
          metadata: { itemId: id, quantity: newQty },
          senderId: user._id,
        });
      }
    }

    return apiSuccess({ quantity: newQty });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
