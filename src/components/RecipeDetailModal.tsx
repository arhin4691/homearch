"use client";

import { useTranslations } from "next-intl";
import {
  Clock,
  Flame,
  Lightbulb,
  ListOrdered,
  ShoppingBasket,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Medium:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export interface RecipeDetail {
  id: string;
  recipeName: string;
  difficulty: string;
  prepTime: string;
  cookingTime: string;
  ingredientsUsed: string[];
  pantryAdditions: string[];
  steps: string[];
  chefTip: string;
  tags: string[];
  isUsed: boolean;
}

interface RecipeDetailModalProps {
  recipe: RecipeDetail | null;
  onClose: () => void;
}

export function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  const t = useTranslations("fridgeChef");

  if (!recipe) return null;

  return (
    <Modal open={!!recipe} onClose={onClose} title={recipe.recipeName} size="lg">
      <div className="flex flex-col gap-5">
        {/* Header badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLOR[recipe.difficulty] ?? DIFFICULTY_COLOR.Medium}`}
          >
            {recipe.difficulty}
          </span>
          {recipe.prepTime && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]">
              <Clock className="h-3 w-3" />
              {t("prepTime")}: {recipe.prepTime}
            </span>
          )}
          {recipe.cookingTime && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]">
              <Flame className="h-3 w-3" />
              {t("cookingTime")}: {recipe.cookingTime}
            </span>
          )}
          {recipe.isUsed && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3" />
              {t("used")}
            </span>
          )}
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#7dc0ff]/10 text-[#7dc0ff] rounded-full text-xs font-medium"
              >
                <Tag className="h-3 w-3" />#{tag}
              </span>
            ))}
          </div>
        )}

        {/* Ingredients used */}
        <div className="p-4 bg-[var(--card)] rounded-xl border border-[var(--card-border)]">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
            {t("ingredientsUsed")}
          </p>
          <div className="flex flex-wrap gap-2">
            {recipe.ingredientsUsed.map((ing) => (
              <span
                key={ing}
                className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs font-medium"
              >
                {ing}
              </span>
            ))}
          </div>
        </div>

        {/* Pantry additions */}
        {recipe.pantryAdditions.length > 0 && (
          <div className="p-4 bg-[var(--card)] rounded-xl border border-[var(--card-border)]">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShoppingBasket className="h-3.5 w-3.5" />
              {t("pantryAdditions")}
            </p>
            <div className="flex flex-wrap gap-2">
              {recipe.pantryAdditions.map((item) => (
                <span
                  key={item}
                  className="px-2.5 py-1 bg-[var(--background)] border border-[var(--card-border)] rounded-full text-xs text-[var(--foreground)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        <div>
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" />
            {t("steps")}
          </p>
          <ol className="flex flex-col gap-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#7dc0ff] text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-[var(--foreground)] leading-relaxed">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Chef tip */}
        {recipe.chefTip && (
          <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {recipe.chefTip}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
