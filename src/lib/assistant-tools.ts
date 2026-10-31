import { z } from "zod";
import { ITEM_CATEGORIES } from "@/lib/constants";

const name = z.string().trim().min(1).max(100);
const quantity = z.number().int().min(0).max(100000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

export const toolSchemas = {
  list_inventory: z.object({}).strict(),
  search_inventory: z.object({
    name: name.optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    expiry: z.enum(["expired", "expiring"]).optional(),
  }).strict().refine((value) => value.name || value.category || value.expiry),
  add_item: z.object({
    name, category: z.enum(ITEM_CATEGORIES), quantity, hasExpiry: z.boolean(),
    expiryDate: date.optional(),
  }).strict().refine((value) => value.hasExpiry === !!value.expiryDate),
  update_item: z.object({
    name,
    location: name.optional(),
    newName: name.optional(),
    quantity: quantity.optional(),
    minimumQuantity: quantity.nullable().optional(),
    expiryDate: date.nullable().optional(),
  }).strict().refine((value) =>
    value.newName !== undefined || value.quantity !== undefined ||
    value.minimumQuantity !== undefined || value.expiryDate !== undefined),
  deduct_item: z.object({
    name, location: name.optional(), quantity: quantity.min(1),
  }).strict(),
  increase_item: z.object({
    name, location: name.optional(), quantity: quantity.min(1),
  }).strict(),
  delete_item: z.object({ name, location: name.optional() }).strict(),
  suggestions: z.object({}).strict(),
  shopping_list: z.object({}).strict(),
  recipes: z.object({}).strict(),
};

const stringProperty = { type: "string" };
const quantityProperty = { type: "integer", minimum: 0, maximum: 100000 };
const itemName = { type: "string", description: "Exact item name supplied by the user; never invent it." };
const location = { type: "string", description: "Exact location name only if the user specified one." };

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return { name, description, parameters: { type: "object", properties, required, additionalProperties: false } };
}

export const assistantTools = [
  tool("list_inventory", "List the current household inventory.", {}),
  tool("search_inventory", "Search inventory by name, category or expiry status.", {
    name: itemName, category: { type: "string", enum: ITEM_CATEGORIES },
    expiry: { type: "string", enum: ["expired", "expiring"] },
  }),
  tool("add_item", "Propose adding one new item only when name, category, quantity and expiry information are explicit. If expiry is unknown, ask the user.", {
    name: itemName, category: { type: "string", enum: ITEM_CATEGORIES },
    quantity: quantityProperty, hasExpiry: { type: "boolean" },
    expiryDate: { ...stringProperty, description: "YYYY-MM-DD, required when hasExpiry is true." },
  }, ["name", "category", "quantity", "hasExpiry"]),
  tool("update_item", "Propose changing an existing item. Only include explicitly requested changes.", {
    name: itemName, location, newName: stringProperty, quantity: quantityProperty,
    minimumQuantity: { type: ["integer", "null"], minimum: 0, maximum: 100000 },
    expiryDate: { type: ["string", "null"], description: "YYYY-MM-DD, or null only to clear." },
  }, ["name"]),
  tool("deduct_item", "Propose deducting an explicit positive quantity from an existing item.", {
    name: itemName, location, quantity: { ...quantityProperty, minimum: 1 },
  }, ["name", "quantity"]),
  tool("increase_item", "Propose adding an explicit positive quantity to an existing item's stock. If no item matches, ask for the details needed to create one.", {
    name: itemName, location, quantity: { ...quantityProperty, minimum: 1 },
  }, ["name", "quantity"]),
  tool("delete_item", "Propose deleting an existing item only if explicitly requested.", {
    name: itemName, location,
  }, ["name"]),
  tool("suggestions", "Show low-stock and expiry suggestions based only on actual inventory and ask whether to show a shopping list.", {}),
  tool("shopping_list", "Show a shopping list based on the household's low or out-of-stock inventory, including when the user agrees to see one.", {}),
  tool("recipes", "Open the existing family recipe generator and saved recipes.", {}),
];

export type AssistantToolName = keyof typeof toolSchemas;

export function parseAssistantTool(value: unknown) {
  const envelope = z.object({ name: z.string(), arguments: z.unknown() }).strict().safeParse(value);
  if (!envelope.success || !Object.hasOwn(toolSchemas, envelope.data.name)) return null;
  const name = envelope.data.name as AssistantToolName;
  const result = toolSchemas[name].safeParse(envelope.data.arguments);
  return result.success ? { name, args: result.data } : null;
}
