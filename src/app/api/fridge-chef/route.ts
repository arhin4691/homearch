// @ts-nocheck
import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiError } from "@/lib/api-response";

// const SYSTEM_PROMPT = `You are "Fridge Chef", a creative 5-star Michelin chef specializing in home cooking, local Hong Kong cuisine, and reducing food waste.
// Given a list of food ingredients that are about expire, must not include the out of stock items and no qty's items, generate ONE delicious, practical home-cooked recipe that utilizes as many of these ingredients as possible.
// Not using all ingredients is acceptable, but do not add any ingredients that are not commonly found in a home kitchen. The recipe should be easy to prepare and cook within 30 minutes, with no hard-to-find ingredients or complex techniques. Focus on flavors that would appeal to a typical Hong Kong household.
// You must strictly output a single JSON object in Traditional Chinese (繁體中文/香港本地生活用語) matching this schema exactly:
// {
//   "recipeName": "Creative Recipe Title",
//   "difficulty": "Easy",
//   "prepTime": "15分鐘",
//   "cookingTime": "10分鐘",
//   "ingredientsUsed": ["Item A", "Item B"],
//   "pantryAdditions": ["生抽", "糖", "油"],
//   "steps": ["第一步說明...", "第二步說明..."],
//   "chefTip": "A friendly cooking or storage tip.",
//   "tags": ["stir-fry", "quick", "beef"]
// }

// Rules:
// - difficulty must be exactly one of: Easy, Medium, Hard
// - tags must be 2-4 single English words
// - steps must be a numbered array of clear instructions
// - Output raw JSON only — no markdown, no code fences, no extra text.`;

const SYSTEM_PROMPT = `You are "Fridge Chef", a practical 5-star Michelin chef specializing in Hong Kong home cooking (港式家常菜) and food waste reduction.

Your goal is to look at a list of expiring ingredients and generate ONE realistic, delicious, and culturally appropriate Hong Kong home-cooked recipe. 

CRITICAL RULES FOR "REASONABLE" COOKING:
- Prioritize culinary harmony: The combination of ingredients MUST make sense in traditional Cantonese or Hong Kong cafe (茶餐廳) food culture. Do NOT create bizarre flavor combinations just to force an ingredient into the dish.
- If certain expiring ingredients do not pair well together in a single dish, choose a subset of ingredients that DO pair well, and ignore the mismatched ones.
- Only use standard household pantry staples (e.g., soy sauce, garlic, ginger, cornstarch, salt, sugar, oil) as extra ingredients.
- pantryAdditions not a must — only include if they are truly needed to make the dish work. Do NOT add unnecessary ingredients just to fill the pantryAdditions array.
Input:
Given a list of food ingredients that are about to expire (excluding out-of-stock and zero-qty items).

Output Format:
You must strictly output a single JSON object in Traditional Chinese (using Hong Kong local terms like 薑、蔥、生抽、生粉, NOT 醬油、淀粉) matching this schema exactly. 

Output raw JSON only — no markdown, no code fences, no leading/trailing text.

{
  "recipeName": "合理、吸引的港式菜名 (e.g., 韭黃肉絲炒麵, 階梯式滑蛋蝦仁)",
  "difficulty": "Easy", 
  "prepTime": "15分鐘",
  "cookingTime": "10分鐘",
  "ingredientsUsed": ["Item A", "Item B"],
  "pantryAdditions": ["生抽", "砂糖", "蒜頭"],
  "steps": ["第一步...", "第二步..."],
  "chefTip": "A friendly cooking or storage tip in HK phrasing.",
  "tags": ["stir-fry", "quick", "egg"]
}

Rules:
- difficulty must be exactly one of: Easy, Medium, Hard
- tags must be 2-4 single English words
- steps must be an array of clear, chronological instructions without numbers inside the string.`;

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

    const randomLimit = Math.floor(Math.random() * 4) + 2;

    let items;
    if (useNearExpiry) {
      // Traditional route: Sorted by expiry, limited by MongoDB
      items = await Item.find(query)
        .sort({ expiryDate: 1, bestBeforeDate: 1 })
        .limit(randomLimit)
        .select("name")
        .lean();
    } else {
      // Random route: Fetch matching items, shuffle them in memory
      const allMatching = await Item.find(query).select("name").lean();

      items = allMatching
        .sort(() => Math.random() - 0.5) // Shuffle randomly
        .slice(0, randomLimit); // Get your 2-5 items
    }
    // const items = await Item.find(query)
    //   .sort(
    //     useNearExpiry
    //       ? { expiryDate: 1, bestBeforeDate: 1 }
    //       : { createdAt: -1 },
    //   )
    //   .limit(Math.floor(Math.random() * 4) + 2) // 2-5
    //   .select("name")
    //   .lean();

    const ingredients = items.map((i) => i.name);

    if (ingredients.length === 0) {
      return Response.json({ success: false, error: "NO_FOOD_ITEMS" });
    }

    const userMessage = `My expiring food ingredients: ${ingredients.join(", ")}. Please generate a recipe using as many of these as possible.`;

    const cfRes = await fetch(
      //   `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`,
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
