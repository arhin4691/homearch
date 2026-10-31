import type { PipelineStage } from "mongoose";

export function inventoryUpdatePipeline(
  fields: Record<string, unknown>,
  expressions: Record<string, unknown> = {},
): PipelineStage[] {
  const literals = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, { $literal: value }]),
  );
  return [
    { $set: { ...literals, ...expressions } },
    {
      $set: {
        lowStockCycle: {
          $cond: [
            {
              $and: [
                { $ne: [{ $ifNull: ["$minimumQuantity", null] }, null] },
                { $lt: ["$quantity", "$minimumQuantity"] },
              ],
            },
            { $ifNull: ["$lowStockCycle", 0] },
            { $add: [{ $ifNull: ["$lowStockCycle", 0] }, 1] },
          ],
        },
      },
    },
  ];
}
