import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { apiError } from "@/lib/api-response";
import { ITEM_CATEGORIES } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      return Response.json({
        success: false,
        error: "Cloudflare credentials not configured",
      });
    }

    const body = await req.json();
    const imageUrl =
      typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (!imageUrl) return apiError("imageUrl is required", 400);

    // Fetch the image — resize to 512×512 via ImageKit transform to keep payload small
    const resizedUrl = imageUrl.includes("?")
      ? `${imageUrl}&tr=w-512,h-512,fo-auto`
      : `${imageUrl}?tr=w-512,h-512,fo-auto`;
    const imageRes = await fetch(resizedUrl);
    if (!imageRes.ok) {
      return Response.json({ success: false, error: "Failed to fetch image" });
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    // /ai/run/ vision format requires image as uint8 integer array
    const image = Array.from(new Uint8Array(arrayBuffer));

    const systemPrompt = `You are a home inventory item scanner. Analyze the image and respond with ONLY a raw JSON object — no markdown, no code fences, no explanation, no extra text before or after.

The JSON must have exactly these three fields:
- "name": string — product name in Traditional Chinese. if you cannot read the chinese or japanese, must return traditional chinese in what you see in the image
- "category": string — MUST be exactly one of: Food, Medicine, Electronics, Household, Clothing, Beauty, Documents, Tools, Other
- "hashTags": string[] — exactly 2-3 single English words describing the item

Example of the ONLY acceptable output JSON format:
{"name":"維他奶","category":"Food","hashTags":["drink","soy","milk"]}`;

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: systemPrompt },
          ],
          image,
          max_tokens: 150,
        }),
      },
    );

    if (!cfRes.ok) {
      const errText = await cfRes.text();
      return Response.json({
        success: false,
        error: `CF ${cfRes.status}: ${errText}`,
      });
    }

    const cfData = await cfRes.json();
    const raw: {} = cfData.result?.response ?? "";

    let parsed: { name?: unknown; category?: unknown; hashTags?: unknown };
    try {
      parsed = raw;
    } catch {
      return Response.json({
        success: false,
        error: "Failed to parse AI response",
      });
    }

    const rawName = typeof parsed.name === "string" ? parsed.name.trim() : "";
    // Reject repetition-loop hallucinations: if any single character makes up >40% of the name, discard it
    const isLooping =
      rawName.length > 6 &&
      [...rawName].some(
        (ch) => rawName.split(ch).length - 1 > rawName.length * 0.4,
      );
    const name = isLooping ? "" : rawName;
    const category =
      typeof parsed.category === "string" &&
      (ITEM_CATEGORIES as readonly string[]).includes(parsed.category)
        ? parsed.category
        : "Other";
    const hashTags = Array.isArray(parsed.hashTags)
      ? (parsed.hashTags as unknown[]).filter(
          (t): t is string => typeof t === "string",
        )
      : [];

    return Response.json({ success: true, data: { name, category, hashTags } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return Response.json({ success: false, error: message });
  }
}
