"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { clsx } from "clsx";

type ViewMode = "grid" | "list";

export default function ItemsPage() {
  const t = useTranslations("items");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState<string>(searchParams.get("category") ?? "");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      const res = await fetch(`/api/items?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data);
      }
    } catch {
      showToast("Failed to load items", "error");
    } finally {
      setFetching(false);
    }
  }, [user, search, category, showToast]);

  useEffect(() => {
    const t = setTimeout(fetchItems, 300);
    return () => clearTimeout(t);
  }, [fetchItems]);

  const toggleFavorite = async (id: string) => {
    try {
      const res = await fetch(`/api/items/${id}/favorite`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isFavorite: json.data.isFavorite } : item
          )
        );
      }
    } catch {}
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--foreground)]">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)]"
          >
            {view === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder={`${t("title")}...`}
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        <button
          onClick={() => setCategory("")}
          className={clsx(
            "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            category === ""
              ? "bg-[#7dc0ff] text-white"
              : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]"
          )}
        >
          {t("filterAll")}
        </button>
        {ITEM_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(category === cat ? "" : cat)}
            className={clsx(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              category === cat
                ? "bg-[#7dc0ff] text-white"
                : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]"
            )}
          >
            {t(`categories.${cat}` as any)}
          </button>
        ))}
      </div>

      {/* Items */}
      {fetching ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center text-3xl">
            📦
          </div>
          <p className="text-[var(--muted)] text-sm">{t("title")} is empty</p>
        </div>
      ) : (
        <motion.div
          layout
          className={
            view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"
          }
        >
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onFavoriteToggle={toggleFavorite} view={view} />
          ))}
        </motion.div>
      )}

      {user?.familyId && (
        <button
          onClick={() => router.push("/items/new")}
          className="fixed bottom-24 right-4 w-14 h-14 bg-[#7dc0ff] hover:bg-[#5aabff] text-white rounded-2xl shadow-xl shadow-[#7dc0ff]/40 flex items-center justify-center transition-all active:scale-95 z-30"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </AppShell>
  );
}
