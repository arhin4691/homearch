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

    const systemPrompt = `SYSTEM:
You are a home inventory item scanner. You analyze ONE main product from the image.
[OUTPUT RULE - CRITICAL]
Respond with ONLY a single, valid, raw JSON object.
- No markdown, no json fences, no explanation, no text before or after.
- Must be valid JSON that can be parsed by JSON.parse().
- If you cannot identify the item, return exactly: {"name":"未能識別","category":"Other","hashTags":["unknown","item"]}
[JSON FIELDS]
1. "name": string - Product name in Traditional Chinese (zh-HK).
   - MUST be Traditional Chinese, NOT Simplified, NOT English.
   - If label is English/Japanese (e.g., Coca-Cola, ポカリスエット), TRANSLATE to standard HK term: 可口可樂, 寶礦力.
   - Use Hong Kong terminology: 維他奶, 公仔麵, 保鮮紙.
   - Keep it short: just the product name, no adjectives.
2. "category": string - MUST be exactly one of: ["Food", "Drinks", "Medicine", "Electronics", "Household", "Clothing", "Beauty", "Documents", "Tools", "Other"]
   - Mapping: 維他奶/可樂/啤酒/水/奶 -> Drinks, 麵包/雞蛋/公仔麵 -> Food
3. "hashTags": string[] - Array of exactly 2-3 tags.
   - MUST be single English words, lowercase.
   - Describe type/use: e.g., ["drink","soy","milk"], ["food","noodle","instant"]
[LOGIC]
- If multiple items in image, pick the most central / largest / in-focus one.
- Only return ONE object, not an array.
[EXAMPLES - Learn from these]
Image shows a Vitasoy carton -> {"name":"維他奶","category":"Drinks","hashTags":["drink","soy","milk"]}
Image shows a Coca-Cola can -> {"name":"可口可樂","category":"Drinks","hashTags":["drink","soda","cola"]}
Image shows 【entity-Nissin¦canonical_name=Nissin】 instant noodles -> {"name":"出前一丁","category":"Food","hashTags":["food","noodle","instant"]}
`;

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
