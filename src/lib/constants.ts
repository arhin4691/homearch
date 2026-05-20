export const ITEM_CATEGORIES = [
  "Food",
  "Medicine",
  "Electronics",
  "Household",
  "Clothing",
  "Beauty",
  "Documents",
  "Tools",
  "Other",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
