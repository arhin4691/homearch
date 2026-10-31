// @ts-nocheck
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { Location } from "@/models/Location";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [totalItems, totalLocations, expiredItems, expiringItems, recentItems, unreadCount] =
      await Promise.all([
        Item.countDocuments({ familyId: user.familyId }),
        Location.countDocuments({ familyId: user.familyId }),
        Item.countDocuments({ familyId: user.familyId, hasExpiry: true, expiryDate: { $lt: now } }),
        Item.countDocuments({
          familyId: user.familyId,
          hasExpiry: true,
          expiryDate: { $gte: now, $lte: in7Days },
        }),
        Item.find({ familyId: user.familyId })
          .populate({ path: "locationId", select: "name", match: { familyId: user.familyId } })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        Notification.countDocuments({ recipientId: session.userId, status: "PENDING", clearedAt: null }),
      ]);

    const expiringList = await Item.find({
      familyId: user.familyId,
      hasExpiry: true,
      expiryDate: { $lte: in7Days },
    })
      .sort({ expiryDate: 1 })
      .limit(6)
      .lean();

    const responseData = {
      stats: { totalItems, totalLocations, expiredItems, expiringItems, unreadCount },
      expiringList: expiringList.map((item) => ({
        id: (item._id as { toString(): string }).toString(),
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        expiryDate: item.expiryDate,
        bestBeforeDate: item.bestBeforeDate,
      })),
      recentItems: recentItems.map((item) => ({
        id: (item._id as { toString(): string }).toString(),
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        quantity: (item as any).quantity ?? 1,
        hasExpiry: item.hasExpiry,
        expiryDate: item.expiryDate,
        location: item.locationId ? { name: (item.locationId as any).name } : null,
        createdAt: item.createdAt,
      })),
    };

    return apiSuccess(responseData);
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
