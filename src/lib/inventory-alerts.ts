import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { getTranslations } from "next-intl/server";
import { Item, type IItem } from "@/models/Item";
import { Notification } from "@/models/Notification";

type AlertItem = Pick<IItem, "_id" | "name" | "quantity" | "minimumQuantity" |
  "lowStockCycle" | "hasExpiry" | "expiryDate">;

function alertId(parts: string[]) {
  const hash = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return new Types.ObjectId(hash.slice(0, 24));
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function createInventoryAlerts(familyId: Types.ObjectId, userId: Types.ObjectId) {
  const t = await getTranslations("assistant");
  const now = new Date();
  const items = await Item.find({
    familyId,
    $or: [
      { minimumQuantity: { $ne: null }, $expr: { $lt: ["$quantity", "$minimumQuantity"] } },
      { hasExpiry: true, quantity: { $gt: 0 }, expiryDate: { $lte: new Date(now.getTime() + 7 * 86400000) } },
    ],
  }).lean<AlertItem[]>();

  for (const item of items) {
    const itemId = item._id.toString();
    const alerts: { type: "LOW_STOCK" | "EXPIRY_ALERT"; episode: string; title: string; message: string }[] = [];
    if (item.minimumQuantity != null && item.quantity < item.minimumQuantity) {
      alerts.push({
        type: "LOW_STOCK",
        episode: String(item.lowStockCycle ?? 0),
        title: t("lowStockTitle"),
        message: t("lowStock", { name: item.name, quantity: item.quantity, minimum: item.minimumQuantity }),
      });
    }
    if (item.quantity > 0 && item.hasExpiry && item.expiryDate) {
      const expiry = new Date(item.expiryDate);
      if (expiry <= new Date(now.getTime() + 7 * 86400000)) {
        const expired = expiry < now;
        alerts.push({
          type: "EXPIRY_ALERT",
          episode: `${expiry.toISOString()}:${expired ? "expired" : "expiring"}`,
          title: t(expired ? "expiredTitle" : "expiringTitle"),
          message: t(expired ? "expired" : "expiring", {
            name: item.name, quantity: item.quantity, date: expiry.toISOString().slice(0, 10),
          }),
        });
      }
    }
    for (const alert of alerts) {
      const id = alertId(["inventory-alert-v1", familyId.toString(), userId.toString(), itemId, alert.type, alert.episode]);
      try {
        await Notification.updateOne(
          { _id: id, recipientId: userId },
          { $setOnInsert: {
            recipientId: userId, type: alert.type, status: "PENDING", title: alert.title,
            message: alert.message, metadata: { itemId, familyId: familyId.toString() },
          } },
          { upsert: true },
        );
      } catch (error) {
        if (!isDuplicateKey(error) || !(await Notification.exists({ _id: id, recipientId: userId }))) throw error;
      }
    }
  }
}
