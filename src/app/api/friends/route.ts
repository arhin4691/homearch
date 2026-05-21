// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { FriendRequest } from "@/models/FriendRequest";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/friends — list accepted friends + pending requests
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId).populate("friends", "name avatarUrl userCode email").lean();
    if (!user) return apiError("User not found", 404);

    // Pending requests (incoming)
    const incomingReqs = await FriendRequest.find({
      receiverId: session.userId,
      status: "PENDING",
    })
      .populate("senderId", "name avatarUrl userCode")
      .lean();

    // Pending requests (outgoing)
    const outgoingReqs = await FriendRequest.find({
      senderId: session.userId,
      status: "PENDING",
    })
      .populate("receiverId", "name avatarUrl userCode")
      .lean();

    const friends = (user.friends ?? []).map((f: any) => ({
      id: f._id.toString(),
      name: f.name,
      avatarUrl: f.avatarUrl ?? null,
      userCode: f.userCode,
      email: f.email,
    }));

    const incoming = incomingReqs.map((r: any) => ({
      requestId: r._id.toString(),
      user: {
        id: r.senderId._id.toString(),
        name: r.senderId.name,
        avatarUrl: r.senderId.avatarUrl ?? null,
        userCode: r.senderId.userCode,
      },
    }));

    const outgoing = outgoingReqs.map((r: any) => ({
      requestId: r._id.toString(),
      user: {
        id: r.receiverId._id.toString(),
        name: r.receiverId.name,
        avatarUrl: r.receiverId.avatarUrl ?? null,
        userCode: r.receiverId.userCode,
      },
    }));

    return apiSuccess({ friends, incoming, outgoing });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}

// POST /api/friends — send friend request by userCode
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const body = await req.json();
    const targetCode: string = (body.userCode ?? "").trim().toUpperCase();
    if (!targetCode) return apiError("userCode required", 400);

    await connectDB();
    const [sender, target] = await Promise.all([
      User.findById(session.userId).lean(),
      User.findOne({ userCode: targetCode }).lean(),
    ]);
    if (!sender) return apiError("Unauthorized", 401);
    if (!target) return apiError("User not found", 404);

    const targetId = target._id.toString();
    const senderId = session.userId;

    if (targetId === senderId) return apiError("Cannot add yourself", 400);

    // Check already friends
    const alreadyFriends = (sender.friends ?? []).some((f: any) => f.toString() === targetId);
    if (alreadyFriends) return apiError("Already friends", 409);

    // Check existing pending request (either direction)
    const existingReq = await FriendRequest.findOne({
      $or: [
        { senderId, receiverId: targetId },
        { senderId: targetId, receiverId: senderId },
      ],
      status: "PENDING",
    });
    if (existingReq) return apiError("Request already pending", 409);

    // Remove old declined/accepted request if any so we can re-send
    await FriendRequest.deleteMany({
      $or: [
        { senderId, receiverId: targetId },
        { senderId: targetId, receiverId: senderId },
      ],
      status: { $ne: "PENDING" },
    });

    await FriendRequest.create({ senderId, receiverId: targetId });
    return apiSuccess({ sent: true }, 201);
  } catch (e: any) {
    if (e.code === 11000) return apiError("Request already pending", 409);
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
