// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ApiKey } from "@/models/ApiKey";
import { Item } from "@/models/Item";
import { Location } from "@/models/Location";
import { comparePassword } from "@/lib/auth";

async function verifyApiKey(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const rawKey = authHeader.slice(7);

  await connectDB();
  const keys = await ApiKey.find({}).lean();
  for (const key of keys) {
    const valid = await comparePassword(rawKey, key.apiKeyHash);
    if (valid) return key.familyId.toString();
  }
  return null;
}

/**
 * MCP (Model Context Protocol) endpoint
 * Supports: tools/list and tools/call
 */
export async function POST(req: NextRequest) {
  try {
    const familyId = await verifyApiKey(req);
    if (!familyId) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const body = await req.json();
    const { method, params } = body;

    if (method === "tools/list") {
      return NextResponse.json({
        tools: [
          {
            name: "get_inventory",
            description: "Get all inventory items. Optionally filter by expiry status.",
            inputSchema: {
              type: "object",
              properties: {
                filter: {
                  type: "string",
                  enum: ["all", "expiring_today", "expiring_week", "expired"],
                  description: "Filter items by expiry status",
                },
              },
            },
          },
          {
            name: "get_locations",
            description: "Get all storage locations in the home.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "search_items",
            description: "Search for items by name, category, or hashtag.",
            inputSchema: {
              type: "object",
              required: ["query"],
              properties: {
                query: { type: "string", description: "Search term" },
              },
            },
          },
        ],
      });
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      const now = new Date();

      if (toolName === "get_inventory") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any = { familyId };
        const filter = toolArgs.filter;

        if (filter === "expiring_today") {
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);
          query.hasExpiry = true;
          query.expiryDate = { $gte: now, $lte: endOfDay };
        } else if (filter === "expiring_week") {
          const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          query.hasExpiry = true;
          query.expiryDate = { $gte: now, $lte: in7Days };
        } else if (filter === "expired") {
          query.hasExpiry = true;
          query.expiryDate = { $lt: now };
        }

        const items = await Item.find(query)
          .populate("locationId", "name")
          .sort({ expiryDate: 1 })
          .lean();

        const result = items.map((item) => ({
          name: item.name,
          category: item.category,
          expiryDate: item.expiryDate?.toISOString().split("T")[0] ?? "N/A",
          bestBefore: item.bestBeforeDate?.toISOString().split("T")[0] ?? "N/A",
          location: (item.locationId as any)?.name ?? "Unassigned",
          tags: item.hashTags,
        }));

        return NextResponse.json({
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      }

      if (toolName === "get_locations") {
        const locations = await Location.find({ familyId }).lean();
        const result = locations.map((l) => ({ name: l.name, description: l.description ?? "" }));
        return NextResponse.json({
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      }

      if (toolName === "search_items") {
        const q = toolArgs.query as string;
        const items = await Item.find({
          familyId,
          $or: [
            { name: { $regex: q, $options: "i" } },
            { hashTags: { $regex: q, $options: "i" } },
            { category: { $regex: q, $options: "i" } },
          ],
        })
          .populate("locationId", "name")
          .lean();

        const result = items.map((item) => ({
          name: item.name,
          category: item.category,
          expiryDate: item.expiryDate?.toISOString().split("T")[0] ?? "N/A",
          location: (item.locationId as any)?.name ?? "Unassigned",
          tags: item.hashTags,
        }));

        return NextResponse.json({
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      }

      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }

    return NextResponse.json({ error: "Unknown method" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

