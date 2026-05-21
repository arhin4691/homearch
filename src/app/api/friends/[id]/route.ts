import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { FriendRequest } from "@/models/FriendRequest";
import { apiSuccess, apiError } from "@/lib/api-response";

// PATCH /api/friends/[id] — accept or decline a friend request
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id } = await params;
    const { action }: { action: "accept" | "decline" } = await req.json();

    await connectDB();
    const request = await FriendRequest.findOne({
      _id: id,
      receiverId: session.userId,
      status: "PENDING",
    });
    if (!request) return apiError("Request not found", 404);

    if (action === "accept") {
      request.status = "ACCEPTED";
      await request.save();

      // Add both users to each other's friends list
      await Promise.all([
        User.findByIdAndUpdate(session.userId, {
          $addToSet: { friends: request.senderId },
        }),
        User.findByIdAndUpdate(request.senderId, {
          $addToSet: { friends: session.userId },
        }),
      ]);
      return apiSuccess({ accepted: true });
    }

    if (action === "decline") {
      request.status = "DECLINED";
      await request.save();
      return apiSuccess({ declined: true });
    }

    return apiError("Invalid action", 400);
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

// DELETE /api/friends/[id] — remove a friend (id = friend's user ID)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const { id: friendId } = await params;
    await connectDB();

    // Remove from both sides
    await Promise.all([
      User.findByIdAndUpdate(session.userId, { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: session.userId } }),
    ]);

    // Delete any accepted request between them
    await FriendRequest.deleteMany({
      $or: [
        { senderId: session.userId, receiverId: friendId },
        { senderId: friendId, receiverId: session.userId },
      ],
    });

    return apiSuccess({ removed: true });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
