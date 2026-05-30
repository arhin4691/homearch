"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { ItemFormModal } from "@/components/ItemFormModal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";

const PAGE_SIZE = 6;
type ViewMode = "grid" | "list";
type SortOption =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "qty_asc"
  | "qty_desc";
type FilterOption = "" | "expired" | "expiring";

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
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("items-view") as ViewMode) ?? "grid";
    }
    return "grid";
  });
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState<string>(
    searchParams.get("category") ?? "",
  );
  const [filter, setFilter] = useState<FilterOption>(
    (searchParams.get("filter") as FilterOption) ?? "",
  );
  const [sort, setSort] = useState<SortOption>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Auto-open modal when ?new=1 is in the URL
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowAddModal(true);
      router.replace("/items");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const fetchItems = useCallback(
    async (pg: number, replace: boolean) => {
      if (!user) return;
      if (pg === 1) setFetching(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (category) params.set("category", category);
        if (filter) params.set("filter", filter);
        if (sort !== "newest") params.set("sort", sort);
        params.set("page", String(pg));
        params.set("limit", String(PAGE_SIZE));
        const res = await fetch(`/api/items?${params}`);
        if (res.ok) {
          const json = await res.json();
          const incoming = json.data.items ?? [];
          setItems((prev) => (replace ? incoming : [...prev, ...incoming]));
          setHasMore(json.data.hasMore);
          setPage(pg);
        }
      } catch {
        showToast(t("loadError"), "error");
      } finally {
        setFetching(false);
        setLoadingMore(false);
      }
    },
    [user, search, category, filter, sort, showToast, t],
  );

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
      { threshold: 0.1 },
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
            item.id === id
              ? { ...item, isFavorite: json.data.isFavorite }
              : item,
          ),
        );
      }
    } catch {}
  };

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "newest", label: t("sortNewest") },
    { value: "oldest", label: t("sortOldest") },
    { value: "name_asc", label: t("sortNameAsc") },
    { value: "name_desc", label: t("sortNameDesc") },
    { value: "qty_asc", label: t("sortQtyAsc") },
    { value: "qty_desc", label: t("sortQtyDesc") },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="mt-2 text-4xl font-bold text-[var(--foreground)]">
          {t("title")}
        </h1>
        <button
          onClick={() => {
            const next: ViewMode = view === "grid" ? "list" : "grid";
            setView(next);
            localStorage.setItem("items-view", next);
          }}
          className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)]"
        >
          {view === "grid" ? (
            <List className="h-4 w-4" />
          ) : (
            <LayoutGrid className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Search + Sort row */}
      <div
        className="flex items-center gap-2 mb-4 backdrop-blur-sm bg-[var(--background)]/50 ps-3 pe-3 pt-3 pb-3 rounded-xl shadow-md shadow-[#7dc0ff]/20"
        style={{ position: "sticky", top: 10, zIndex: 1 }}
      >
        <div className="flex-1">
          <Input
            placeholder={t("searchPlaceholder")}
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Sort dropdown */}
        <div className="relative flex-shrink-0" ref={sortRef}>
          <button
            onClick={() => setSortOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] text-xs font-medium"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {SORT_OPTIONS.find((o) => o.value === sort)?.label}
            </span>
            <ChevronDown
              className={clsx(
                "h-3 w-3 transition-transform",
                sortOpen && "rotate-180",
              )}
            />
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full mt-1 z-30 bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-xl overflow-hidden min-w-[160px]"
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSort(opt.value);
                      setSortOpen(false);
                    }}
                    className={clsx(
                      "w-full px-4 py-2.5 text-sm text-left transition-colors",
                      sort === opt.value
                        ? "text-[#7dc0ff] font-semibold bg-[#7dc0ff]/8"
                        : "text-[var(--foreground)] hover:bg-[var(--background)]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Active filter banner */}
      <AnimatePresence>
        {filter && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div
              className={clsx(
                "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium",
                filter === "expired"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
              )}
            >
              <span>
                {filter === "expired"
                  ? t("filterExpired")
                  : t("filterExpiring")}
              </span>
              <button onClick={() => setFilter("")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category + quick-filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        <button
          onClick={() => setCategory("")}
          className={clsx(
            "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            category === "" && !filter
              ? "bg-[#7dc0ff] text-white"
              : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]",
          )}
        >
          {t("filterAll")}
        </button>
        <button
          onClick={() => setFilter(filter === "expired" ? "" : "expired")}
          className={clsx(
            "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            filter === "expired"
              ? "bg-red-500 text-white"
              : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]",
          )}
        >
          {t("filterExpired")}
        </button>
        <button
          onClick={() => setFilter(filter === "expiring" ? "" : "expiring")}
          className={clsx(
            "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            filter === "expiring"
              ? "bg-orange-500 text-white"
              : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]",
          )}
        >
          {t("filterExpiring")}
        </button>
        {ITEM_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(category === cat ? "" : cat)}
            className={clsx(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              category === cat
                ? "bg-[#7dc0ff] text-white"
                : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]",
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
          <div
            className={
              view === "grid"
                ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                : "flex flex-col gap-3"
            }
          >
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onFavoriteToggle={toggleFavorite}
                view={view}
              />
            ))}
          </div>

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
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-28 right-5 w-16 h-16 bg-[#7dc0ff] hover:bg-[#5aabff] text-white rounded-4xl shadow-xl shadow-[#7dc0ff]/40 flex items-center justify-center transition-all active:scale-95 z-30"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <ItemFormModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchItems(1, true)}
      />
    </AppShell>
  );
}
