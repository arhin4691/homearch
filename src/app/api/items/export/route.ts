import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import "@/models/Location";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

const HEADERS = [
  "Product Name",
  "Quantity",
  "Location Name",
  "Expiry Date",
  "Item Creator",
  "Hashtags",
];

interface ExportUser {
  familyId?: Types.ObjectId | null;
}

interface ExportItem {
  _id: Types.ObjectId;
  name: string;
  quantity?: number;
  locationId?: { name: string } | null;
  uploaderId?: { name: string } | null;
  hasExpiry: boolean;
  expiryDate?: Date | null;
  hashTags?: string[];
}

type ExportRow = [string, number, string, string, string, string];

function spreadsheetText(value: string) {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvField(value: string | number | undefined) {
  const safe = typeof value === "string" ? spreadsheetText(value) : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const format = new URL(req.url).searchParams.get("format");
    if (format !== "csv" && format !== "xlsx") {
      return apiError("format must be csv or xlsx", 422);
    }

    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const user = await User.findById(session.userId)
      .select("familyId")
      .lean<ExportUser | null>();
    if (!user?.familyId) return apiError("Not in a family", 403);

    const items = await Item.find({ familyId: user.familyId })
      .populate<{ locationId: { name: string } | null }>({
        path: "locationId",
        select: "name",
        match: { familyId: user.familyId },
      })
      .populate<{ uploaderId: { name: string } | null }>("uploaderId", "name")
      .sort({ name: 1, _id: 1 })
      .lean<ExportItem[]>();

    const rows: ExportRow[] = items.map((item) => [
      spreadsheetText(item.name),
      item.quantity ?? 1,
      spreadsheetText(item.locationId?.name ?? ""),
      item.hasExpiry && item.expiryDate
        ? item.expiryDate.toISOString().slice(0, 10)
        : "",
      spreadsheetText(item.uploaderId?.name ?? ""),
      spreadsheetText((item.hashTags ?? []).join(", ")),
    ]);

    const filename = `homearch-inventory.${format}`;
    if (format === "csv") {
      const csv = [
        HEADERS.map(csvField).join(","),
        ...rows.map((row) => row.map(csvField).join(",")),
      ].join("\r\n");
      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventory");
    worksheet.addRow(HEADERS);
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns.forEach((column, index) => {
      column.width = Math.min(
        40,
        Math.max(
          14,
          ...worksheet
            .getColumn(index + 1)
            .values.slice(1)
            .map((value) => String(value ?? "").length + 2),
        ),
      );
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Inventory export failed:", error);
    return apiError("Failed to export inventory", 500);
  }
}
