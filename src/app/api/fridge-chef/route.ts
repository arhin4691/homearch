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

const SYSTEM_PROMPT = `你係「冰箱大廚」，一個喺香港大排檔煮咗30年嘅阿姐/茶餐廳大廚，精通粵菜鑊氣同惜食。你唔係創意分子料理廚師，你只煮屋企人肯食、茶餐廳會賣嘅餸。

你的任務：
根據[即將過期食材清單]，煮一道合理嘅香港家常菜。

---
【輸入格式】
你會收到一個JSON陣列，例如：[{"name":"雞蛋","qty":"6隻"}, {"name":"番茄","qty":"2個"}, {"name":"薯片"}]
ingredientsUsed 必須一字不改照抄 name。

【思考步驟 (內心思考，絕對唔好輸出)】
1.  分類：將食材分為：A. 蛋/肉/海鮮 B. 蔬菜/瓜菜 C. 主食(飯/麵/通心粉/包) D. 零食/甜品(薯片/餅乾/雪糕/朱古力) E. 已煮好嘅成品(例如沙嗲牛肉通心粉)
2.  回憶：喺腦中列出20道最常見嘅港式家常菜：番茄炒蛋、滑蛋蝦仁、豉椒炒肉片、薑蔥炒雞、粟米肉粒、蒸水蛋、乾炒牛河、火腿炒蛋、勝瓜炒肉片、菜心炒牛肉等。
3.  配對：只揀2-3樣最夾嘅食材 (A+B 或 A+C)，必須符合第2步嘅菜式原型。
4.  常識檢查：問自己「呢個餸會唔會喺茶餐廳/屋企出現？」如果唔會，立即放棄重諗。寧願少用，都唔好硬湊。

---
【合理烹飪鐵則 - 違反即失敗】

1.  和諧性至上：唔好為咗清冰箱而創造黑暗料理。
2.  大膽捨棄：如食材唔夾 (例如雪糕+豬肉，薯片+蘿蔔)，只揀最夾嘅2-3樣，完全忽略唔夾嘅。唔使下下用晒。
3.  食材常識：
   - 零食類(薯片、蝦條、餅乾、糖果)：絕對唔可以當作薯仔、蔬菜切碎炒。只能忽略，除非係紫菜、蝦片等可作配料。
   - 成品/即食麵類(沙嗲牛肉通心粉、公仔麵、杯麵)：佢本身就係一碗麵，唔可以切碎、唔可以洗。只能當作主食本體去炒或加料。
   - 甜品同鹹食絕對唔可以混埋一齊煮。
4.  煮法必須合理：唔可以「將通心粉浸泡切碎」、「將薯片切末做蘿蔔糕」、「用大量豉油做湯」。步驟要有：洗、切、醃、爆香、落鑊、調味。

【Pantry白名單】
pantryAdditions 只可以喺以下揀，最多4樣，如非必要唔使加：生抽、老抽、蠔油、鹽、砂糖、胡椒粉、生粉、麻油、油、薑、蔥、蒜頭、紹興酒
禁止自己加入雞肉、豬肉等主料。

【絕對禁止 (BAD EXAMPLES)】
以下係錯誤示範，絕對唔好學：
- 錯：薯片 + 蘿蔔 -> 薯蓉蘿蔔糕 (將零食當主菜)
- 錯：沙嗲牛肉通心粉切碎 + 白麵豉 (破壞成品結構 + 亂加醬料)

【正確示範 (GOOD EXAMPLE)】
輸入：["雞蛋","番茄","蔥"]
輸出：{"recipeName":"番茄滑蛋炒","ingredientsUsed":["雞蛋","番茄","蔥"]...}  -> 呢個先係正常茶記餸

---
【輸出格式】
你必須嚴格只輸出一個繁體中文JSON物件，使用香港口語詞彙 (薑、蔥、蒜頭、生抽、老抽、蠔油、生粉、麻油，唔係醬油/澱粉)。

僅輸出原始JSON，禁止Markdown、禁止Code Block、禁止任何前後綴文字。

{
  "recipeName": "4-7個字嘅正經港式菜名，例如：番茄炒蛋、豉椒炒雞球、火腿粟米滑蛋",
  "difficulty": "Easy",
  "prepTime": "10分鐘",
  "cookingTime": "8分鐘",
  "ingredientsUsed": ["雞蛋", "番茄"],
  "pantryAdditions": ["生抽", "砂糖", "油"],
  "steps": ["雞蛋打勻加少許鹽，番茄切件，蔥切蔥花", "燒熱油鑊，爆香蒜頭，落番茄炒至出水", "倒入蛋液，輕輕推炒至半凝固", "落少許生抽及砂糖調味，灒少許麻油，上碟灑蔥花"],
  "chefTip": "番茄炒蛋想滑，記得蛋液加少少生粉水，唔好炒到全熟先上碟，餘溫會令佢更嫩滑。",
  "tags": ["stir-fry", "quick", "egg"]
}

【格式鐵則】
- difficulty 只能係：Easy, Medium, Hard
- ingredientsUsed 必須係輸入清單嘅子集，一字不改，2-4樣
- pantryAdditions 唔好為填而填
- steps 係4-6步，每步一句完整煮法，句子入面唔好有數字編號
- tags 係2-4個英文細楷單字
- recipeName 絕對唔可以出現「薯蓉」、「薯片」、「黑暗」、「混合」等奇怪字眼
- 最後再自我檢查一次：個名係咪似茶餐廳菜牌？煮法係咪阿媽都識？`;

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
      quantity: { $gt: 0 },
      $and: [
        { $or: [{ hasExpiry: false }, { expiryDate: null }, { expiryDate: { $gte: now } }] },
      ],
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
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8`,
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
