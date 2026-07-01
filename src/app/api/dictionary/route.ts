// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { ProductDictionary } from "@/models/ProductDictionary";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const barcode = new URL(req.url).searchParams.get("barcode");
    if (!barcode) return apiError("barcode parameter is required", 400);

    await connectDB();
    const product = await ProductDictionary.findOne({ barcode }).lean();
    if (!product) return apiError("Not found", 404);

    return apiSuccess({
      name: product.name,
      category: product.category,
      hashTags: product.hashTags ?? [],
      imageUrl: product.imageUrl ?? null,
    });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
