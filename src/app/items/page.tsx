"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, LayoutGrid, List, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { clsx } from "clsx";

const PAGE_SIZE = 6;
type ViewMode = "grid" | "list";

export default function ItemsPage() {
  const t = useTranslations("items");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState<string>(searchParams.get("category") ?? "");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchItems = useCallback(async (pg: number, replace: boolean) => {
    if (!user) return;
    if (pg === 1) setFetching(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      params.set("page", String(pg));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/items?${params}`);
      if (res.ok) {
        const json = await res.json();
        const incoming = json.data.items ?? [];
        setItems((prev) => replace ? incoming : [...prev, ...incoming]);
        setHasMore(json.data.hasMore);
        setPage(pg);
      }
    } catch {
      showToast(t("loadError"), "error");
    } finally {
      setFetching(false);
      setLoadingMore(false);
    }
  }, [user, search, category, showToast, t]);

  // Reset and refetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => fetchItems(1, true), 300);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !fetching) {
          fetchItems(page + 1, false);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetching, page, fetchItems]);

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
        <h1 className="mt-2 text-4xl font-bold text-[var(--foreground)]">{t("title")}</h1>
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
          placeholder={t("searchPlaceholder")}
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
          <p className="text-[var(--muted)] text-sm">{t("empty")}</p>
        </div>
      ) : (
        <>
          <motion.div
            layout
            className={view === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" : "flex flex-col gap-3"}
          >
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onFavoriteToggle={toggleFavorite} view={view} />
            ))}
          </motion.div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      )}

      {user?.familyId && (
        <button
          onClick={() => router.push("/items/new")}
          className="fixed bottom-28 right-10 w-16 h-16 bg-[#7dc0ff] hover:bg-[#5aabff] text-white rounded-4xl shadow-xl shadow-[#7dc0ff]/40 flex items-center justify-center transition-all active:scale-95 z-30"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </AppShell>
  );
}
