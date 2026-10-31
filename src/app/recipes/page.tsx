"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CheckCircle2,
  Clock,
  Flame,
  Tag,
  Trash2,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FridgeChefModal } from "@/components/FridgeChefModal";
import { RecipeDetailModal, type RecipeDetail } from "@/components/RecipeDetailModal";
import { useToast } from "@/components/ui/Toast";
import { clsx } from "clsx";
import { AssistantPanel } from "@/components/AssistantPanel";
import { Modal } from "@/components/ui/Modal";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Medium:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface Recipe extends RecipeDetail {
  createdAt: string;
}

const PAGE_SIZE = 12;

export default function RecipesPage() {
  const t = useTranslations("fridgeChef");
  const assistant = useTranslations("assistant");
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showToast } = useToast();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchRecipes = useCallback(
    async (pg: number, replace: boolean) => {
      if (!user) return;
      if (pg === 1) setFetching(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        params.set("page", String(pg));
        params.set("limit", String(PAGE_SIZE));
        const res = await fetch(`/api/recipes?${params}`);
        if (res.ok) {
          const json = await res.json();
          const incoming = json.data.recipes ?? [];
          setRecipes((prev) => (replace ? incoming : [...prev, ...incoming]));
          setHasMore(json.data.hasMore);
          setPage(pg);
        } else {
          showToast(t("generateFailed"), "error");
        }
      } catch {
        showToast(t("generateFailed"), "error");
      } finally {
        setFetching(false);
        setLoadingMore(false);
      }
    },
    [user, search, showToast, t],
  );

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => fetchRecipes(1, true), 300);
    return () => clearTimeout(timer);
  }, [fetchRecipes, showSaved]);

  const deleteRecipe = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecipes((prev) => prev.filter((r) => r.id !== id));
        showToast(t("deleted"), "success");
      } else {
        showToast(t("deleteFailed"), "error");
      }
    } catch {
      showToast(t("deleteFailed"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <AssistantPanel key={`${user?.id ?? ""}:${user?.familyId ?? ""}`} onRecipes={() => setShowModal(true)} onSavedRecipes={() => setShowSaved(true)} />
      {user?.familyId && (
      <>
      <Modal open={showSaved} onClose={() => setShowSaved(false)} title={assistant("savedRecipes")} size="lg">
      <div className="mb-4">
        <Input
          placeholder={t("searchPlaceholder")}
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Recipe list */}
      {fetching ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center text-3xl">
            🍽️
          </div>
          <p className="text-[var(--muted)] text-sm">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {recipes.map((recipe) => (
                <motion.div
                  key={recipe.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={clsx(
                    "p-4 rounded-2xl bg-[var(--card)] border transition-colors",
                    recipe.isUsed
                      ? "border-green-500/40"
                      : "border-[var(--card-border)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3" onClick={() => { setShowSaved(false); setSelectedRecipe(recipe); }} style={{ cursor: "pointer" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {recipe.isUsed && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        <h3 className="font-semibold text-[var(--foreground)] text-sm leading-tight">
                          {recipe.recipeName}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLOR[recipe.difficulty] ?? DIFFICULTY_COLOR.Medium}`}
                        >
                          {recipe.difficulty}
                        </span>
                        {recipe.isUsed && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            {t("used")}
                          </span>
                        )}
                      </div>

                      {/* Time badges */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {recipe.prepTime && (
                          <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                            <Clock className="h-3 w-3" />
                            {recipe.prepTime}
                          </span>
                        )}
                        {recipe.cookingTime && (
                          <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                            <Flame className="h-3 w-3" />
                            {recipe.cookingTime}
                          </span>
                        )}
                      </div>

                      {/* Ingredients used */}
                      {recipe.ingredientsUsed.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {recipe.ingredientsUsed.slice(0, 4).map((ing) => (
                            <span
                              key={ing}
                              className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs"
                            >
                              {ing}
                            </span>
                          ))}
                          {recipe.ingredientsUsed.length > 4 && (
                            <span className="px-2 py-0.5 bg-[var(--background)] border border-[var(--card-border)] rounded-full text-xs text-[var(--muted)]">
                              +{recipe.ingredientsUsed.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tags */}
                      {recipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {recipe.tags.map((tag) => (
                            <span
                              key={tag}
                              className="flex items-center gap-0.5 text-xs text-[#7dc0ff]"
                            >
                              <Tag className="h-2.5 w-2.5" />#{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRecipe(recipe.id); }}
                      disabled={deletingId === recipe.id}
                      className="flex-shrink-0 p-2 rounded-xl text-[var(--muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    >
                      {deletingId === recipe.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                onClick={() => fetchRecipes(page + 1, false)}
                loading={loadingMore}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      </Modal>

      <FridgeChefModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => fetchRecipes(1, true)}
      />

      <RecipeDetailModal
        recipe={selectedRecipe}
        onClose={() => { setSelectedRecipe(null); setShowSaved(true); }}
      />
      </>
      )}
    </AppShell>
  );
}
