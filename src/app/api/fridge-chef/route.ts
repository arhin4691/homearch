// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiError } from "@/lib/api-response";

const SYSTEM_PROMPT = `You are "Fridge Chef", a creative 5-star Michelin chef specializing in home cooking, local Hong Kong cuisine, and reducing food waste.
Given a list of food ingredients that are about expire, must not include the out of stock items and no qty's items, generate ONE delicious, practical home-cooked recipe that utilizes as many of these ingredients as possible.
Not using all ingredients is acceptable, but do not add any ingredients that are not commonly found in a home kitchen. The recipe should be easy to prepare and cook within 30 minutes, with no hard-to-find ingredients or complex techniques. Focus on flavors that would appeal to a typical Hong Kong household.
You must strictly output a single JSON object in Traditional Chinese (繁體中文/香港本地生活用語) matching this schema exactly:
{
  "recipeName": "Creative Recipe Title",
  "difficulty": "Easy",
  "prepTime": "15分鐘",
  "cookingTime": "10分鐘",
  "ingredientsUsed": ["Item A", "Item B"],
  "pantryAdditions": ["生抽", "糖", "油"],
  "steps": ["第一步說明...", "第二步說明..."],
  "chefTip": "A friendly cooking or storage tip.",
  "tags": ["stir-fry", "quick", "beef"]
}

Rules:
- difficulty must be exactly one of: Easy, Medium, Hard
- tags must be 2-4 single English words
- steps must be a numbered array of clear instructions
- Output raw JSON only — no markdown, no code fences, no extra text.`;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken)
      return apiError("Cloudflare credentials not configured", 500);

    const body = await req.json().catch(() => ({}));
    const useNearExpiry: boolean = body.useNearExpiry !== false;

    await connectDB();
    const user = (await User.findById(session.userId).lean()) as any;
    if (!user?.familyId) return apiError("Not in a family", 403);

    // Fetch food items — near-expiry sort when flag is on, otherwise all food items
    const now = new Date();
    const query: Record<string, unknown> = {
      familyId: user.familyId,
      category: { $in: ["Food"] },
    };
    if (useNearExpiry) {
      query.$or = [
        { hasExpiry: true, expiryDate: { $gte: now } },
        { hasExpiry: true, bestBeforeDate: { $gte: now } },
      ];
    }
    const items = await Item.find(query)
      .sort(
        useNearExpiry
          ? { expiryDate: 1, bestBeforeDate: 1 }
          : { createdAt: -1 },
      )
      .limit(Math.floor(Math.random() * 4) + 2) // 2-5
      .select("name")
      .lean();

    const ingredients = items.map((i) => i.name);

    if (ingredients.length === 0) {
      return Response.json({ success: false, error: "NO_FOOD_ITEMS" });
    }

    const userMessage = `My expiring food ingredients: ${ingredients.join(", ")}. Please generate a recipe using as many of these as possible.`;

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          max_tokens: 1024,
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
    const raw: string = cfData.result?.response ?? "";

    // Extract the first {...} block (strips any markdown fences or preamble)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : raw.trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({
        success: false,
        error: "Failed to parse AI response",
      });
    }

    const recipe = {
      recipeName: String(parsed.recipeName ?? ""),
      difficulty: ["Easy", "Medium", "Hard"].includes(String(parsed.difficulty))
        ? (parsed.difficulty as string)
        : "Medium",
      prepTime: String(parsed.prepTime ?? ""),
      cookingTime: String(parsed.cookingTime ?? ""),
      ingredientsUsed: Array.isArray(parsed.ingredientsUsed)
        ? (parsed.ingredientsUsed as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
      pantryAdditions: Array.isArray(parsed.pantryAdditions)
        ? (parsed.pantryAdditions as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
      steps: Array.isArray(parsed.steps)
        ? (parsed.steps as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
      chefTip: String(parsed.chefTip ?? ""),
      tags: Array.isArray(parsed.tags)
        ? (parsed.tags as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
    };

    return Response.json({ success: true, data: recipe });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Generation failed";
    return Response.json({ success: false, error: message });
  }
}
