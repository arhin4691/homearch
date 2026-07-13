import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Item } from "@/models/Item";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/constants";

/** Today's date in Hong Kong local time, formatted as YYYY-MM-DD. */
function getHongKongDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildSystemPrompt(today: string): string {
  return `You are a Hong Kong Cantonese (廣東話) speech-transcript parsing expert for a refrigerator/pantry inventory app. The input text is a raw transcript from Cantonese speech recognition, which may contain informal wording, homophone typos, mixed Chinese/English, or missing punctuation. Your task is to infer the correct items and normalize their names.

Today's date is ${today}. Use this to calculate all relative dates.

Rules for extraction:
1. Item Name: Extract and correct the item name into standard Traditional Chinese (zh-HK). Correct STT homophone typos (e.g., if input is "雞旦", output "雞蛋"). Do NOT translate to English, but maintain standard Hong Kong terminology (e.g., "牛肉", "菠蘿包", "維他奶").
2. Quantity: Convert Cantonese numbers and measure words to integers. "一個" -> 1, "兩樽"/"廿樽" -> 2/20, "半打" -> 6, "一打" -> 12, "幾樽" (a few) -> 3. Words like "一盒", "一包", "一枝", "一罐" count as 1 unless a number precedes them.
3. Action:
   - "ADD": "買咗", "買咗返嚟", "入貨", "加", "擺入雪櫃", "放咗入去", "剩返", or if just listing received items.
   - "REMOVE": "用咗", "食咗", "飲咗", "清咗", "掉咗", "扔咗", "冇晒", "食完".
4. Expiry Date (YYYY-MM-DD):
   - "今日" -> Today, "聽日" -> Today+1, "後日" -> Today+2, "下個禮拜" -> Today+7, "一個月後" -> Today+30.
   - Smart defaults if none mentioned: Fresh meat/seafood/veg/fruit -> Today+3 days; Beverages/dairy/bread -> Today+7 days; Seasoning/canned/non-perishable -> hasExpiry: false, expiryDate: null.
5. Category: Must be exactly one of: Food, Drinks, Medicine, Electronics, Household, Clothing, Beauty, Documents, Tools, Other.
6. Format: Output ONLY a valid JSON array.

Example 1:
Input: "今日買咗兩打雞蛋，同埋飲咗半枝可樂，仲有扔咗啲發霉菜"
Output:
[
  {"name": "雞蛋", "quantity": 24, "action": "ADD", "hasExpiry": true, "expiryDate": "2026-07-16", "category": "Food"},
  {"name": "可樂", "quantity": 1, "action": "REMOVE", "hasExpiry": false, "expiryDate": null, "category": "Drinks"},
  {"name": "菜", "quantity": 1, "action": "REMOVE", "hasExpiry": false, "expiryDate": null, "category": "Food"}
]`;
}

interface RawAIItem {
  name?: unknown;
  quantity?: unknown;
  action?: unknown;
  hasExpiry?: unknown;
  expiryDate?: unknown;
  category?: unknown;
}

function normalizeCategory(raw: unknown): ItemCategory {
  const value = typeof raw === "string" ? raw.trim() : "";
  const lower = value.toLowerCase();
  if (/beverage|drink/.test(lower)) return "Drinks";
  if (/food|meat|fish|vegetable|fruit|dairy|snack/.test(lower)) return "Food";
  const exact = (ITEM_CATEGORIES as readonly string[]).find(
    (c) => c.toLowerCase() === lower,
  );
  return (exact as ItemCategory | undefined) ?? "Other";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      return apiError("Cloudflare credentials not configured", 500);
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return apiError("text is required", 400);

    await connectDB();
    const user = (await User.findById(session.userId).lean()) as any;
    if (!user?.familyId) return apiError("Not in a family", 403);

    const today = getHongKongDateString();

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
            { role: "system", content: buildSystemPrompt(today) },
            { role: "user", content: text },
          ],
          max_tokens: 1024,
        }),
      },
    );

    if (!cfRes.ok) {
      const errText = await cfRes.text();
      return apiError(`AI request failed: ${cfRes.status} ${errText}`, 502);
    }

    const cfData = await cfRes.json();
    console.log(cfData.result?.response);
    const raw: string = cfData.result?.response ?? "";

    const jsonMatch = JSON.stringify(raw).match(/\[[\s\S]*\]/);
    const cleaned = jsonMatch ? jsonMatch[0] : raw.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return apiError("Failed to parse AI response", 502);
    }

    const rawItems: RawAIItem[] = Array.isArray(parsed)
      ? (parsed as RawAIItem[])
      : Array.isArray((parsed as any)?.items)
        ? ((parsed as any).items as RawAIItem[])
        : [];

    if (rawItems.length === 0) {
      return apiSuccess({ items: [], todayHK: today });
    }

    const normalized = rawItems
      .map((raw) => {
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!name) return null;
        const action = raw.action === "REMOVE" ? "REMOVE" : "ADD";
        const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
        const expiryDateRaw =
          typeof raw.expiryDate === "string" && DATE_RE.test(raw.expiryDate)
            ? raw.expiryDate
            : null;
        const hasExpiry = raw.hasExpiry !== false && !!expiryDateRaw;
        const category = normalizeCategory(raw.category);
        return {
          name,
          action: action as "ADD" | "REMOVE",
          quantity,
          hasExpiry,
          expiryDate: hasExpiry ? expiryDateRaw : null,
          category,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const preview = await Promise.all(
      normalized.map(async (it, idx) => {
        const escaped = it.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existing = (await Item.findOne({
          familyId: user.familyId,
          name: { $regex: `^${escaped}$`, $options: "i" },
        })
          .select("name quantity")
          .lean()) as any;

        const status: "NEW" | "RESTOCK" | "CONSUME" | "NOT_FOUND" = existing
          ? it.action === "ADD"
            ? "RESTOCK"
            : "CONSUME"
          : it.action === "ADD"
            ? "NEW"
            : "NOT_FOUND";

        return {
          tempId: `${Date.now()}-${idx}`,
          name: it.name,
          category: it.category,
          action: it.action,
          quantity: it.quantity,
          hasExpiry: it.hasExpiry,
          expiryDate: it.expiryDate,
          matchedItemId: existing ? existing._id.toString() : null,
          currentQuantity: existing ? (existing.quantity ?? 1) : 0,
          status,
        };
      }),
    );

    return apiSuccess({ items: preview, todayHK: today });
  } catch (e) {
    console.error(e);
    return apiError("Internal server error", 500);
  }
}
