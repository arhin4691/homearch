"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Loader2,
  Clock,
  Flame,
  Lightbulb,
  ListOrdered,
  ShoppingBasket,
  Tag,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface RecipeData {
  recipeName: string;
  difficulty: string;
  prepTime: string;
  cookingTime: string;
  ingredientsUsed: string[];
  pantryAdditions: string[];
  steps: string[];
  chefTip: string;
  tags: string[];
}

type Stage = "idle" | "generating" | "result" | "confirming";

interface FridgeChefModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Medium:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function FridgeChefModal({
  open,
  onClose,
  onSaved,
}: FridgeChefModalProps) {
  const t = useTranslations("fridgeChef");
  const { showToast } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [saving, setSaving] = useState(false);
  const [isUseNearExpiry, setIsUseNearExpiry] = useState(true);

  const handleClose = () => {
    setStage("idle");
    setRecipe(null);
    setSaving(false);
    onClose();
  };

  const generate = async () => {
    setStage("generating");
    try {
      const res = await fetch("/api/fridge-chef", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useNearExpiry: isUseNearExpiry }),
      });
      const json = await res.json();
      if (json.success) {
        setRecipe(json.data);
        setStage("result");
      } else if (json.error === "NO_FOOD_ITEMS") {
        showToast(t("noFood"), "info");
        setStage("idle");
      } else {
        showToast(t("generateFailed"), "error");
        setStage("idle");
      }
    } catch {
      showToast(t("generateFailed"), "error");
      setStage("idle");
    }
  };

  const saveRecipe = async (markUsed: boolean) => {
    if (!recipe) return;
    setSaving(true);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...recipe, isUsed: markUsed }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      if (markUsed) {
        // deduct ingredients via PATCH markUsed
        await fetch(`/api/recipes/${json.data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markUsed: true }),
        });
        showToast(t("cooked"), "success");
      } else {
        showToast(t("saved"), "success");
      }

      onSaved?.();
      handleClose();
    } catch {
      showToast(t("saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const title =
    stage === "idle"
      ? t("title")
      : stage === "generating"
        ? t("generating")
        : stage === "confirming"
          ? t("confirmTitle")
          : (recipe?.recipeName ?? t("title"));

  return (
    <Modal open={open} onClose={handleClose} title={title} size="lg">
      {/* ── Idle ── */}
      {stage === "idle" && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-20 h-20 rounded-3xl bg-[#7dc0ff]/10 flex items-center justify-center">
            <ChefHat className="h-10 w-10 text-[#7dc0ff]" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[var(--foreground)]">
              {t("title")}
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">{t("subtitle")}</p>
          </div>
          <div className="flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl w-full">
            <label className="text-sm font-medium text-[var(--foreground)]">
              {t("isUseNearExpiry")}
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={isUseNearExpiry}
              onClick={() => setIsUseNearExpiry((v) => !v)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7dc0ff] ${
                isUseNearExpiry ? "bg-[#7dc0ff]" : "bg-[var(--card-border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  isUseNearExpiry ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <Button onClick={generate} size="lg" fullWidth>
            <ChefHat className="h-4 w-4 mr-2" />
            {t("generate")}
          </Button>
        </div>
      )}

      {/* ── Generating ── */}
      {stage === "generating" && (
        <div className="flex flex-col items-center gap-6 py-16">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-[#7dc0ff]/10 flex items-center justify-center animate-pulse">
              <ChefHat className="h-10 w-10 text-[#7dc0ff]" />
            </div>
            <div className="flex items-center justify-center w-full h-full mt-5">
              <Loader2 className="h-6 w-6 text-[#7dc0ff] animate-spin" />
            </div>
          </div>
          <p className="text-sm font-medium text-[#7dc0ff]">
            {t("generating")}
          </p>
        </div>
      )}

      {/* ── Result ── */}
      {stage === "result" && recipe && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5"
          >
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

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => setStage("confirming")}
                size="lg"
                fullWidth
                disabled={saving}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t("confirm")}
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={() => saveRecipe(false)}
                  variant="outline"
                  size="md"
                  fullWidth
                  loading={saving}
                >
                  {t("save")}
                </Button>
                <Button
                  onClick={generate}
                  variant="secondary"
                  size="md"
                  fullWidth
                  disabled={saving}
                >
                  {t("regenerate")}
                </Button>
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  size="md"
                  fullWidth
                  disabled={saving}
                >
                  {t("close")}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Confirming ── */}
      {stage === "confirming" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 py-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[var(--foreground)]">
              {t("confirmTitle")}
            </p>
            <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
              {t("confirmDesc")}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={() => saveRecipe(true)}
              size="lg"
              fullWidth
              loading={saving}
            >
              {t("confirmYes")}
            </Button>
            <Button
              onClick={() => setStage("result")}
              variant="secondary"
              size="md"
              fullWidth
              disabled={saving}
            >
              {t("confirmNo")}
            </Button>
          </div>
        </motion.div>
      )}
    </Modal>
  );
}
