"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { ItemFormModal } from "@/components/ItemFormModal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";

const PAGE_SIZE = 6;
type ViewMode = "grid" | "list";
type SortOption =
  | "name_asc"
  | "name_desc"
  | "qty_asc"
  | "qty_desc"
  | "expiry_asc"
  | "created_desc"
  | "updated_desc";
type FilterOption = "" | "expired" | "expiring";

const FILTER_STATE_KEY = "items-filter-state";
const RETURN_FROM_ITEM_KEY = "items-return-from-detail";

interface ItemsFilterState {
  search: string;
  category: string;
  filter: FilterOption;
  showFavorites: boolean;
  sort: SortOption;
}

function readFilterState(): ItemsFilterState | null {
  if (
    typeof window === "undefined" ||
    window.sessionStorage.getItem(RETURN_FROM_ITEM_KEY) !== "1"
  ) {
    return null;
  }

  const params = new URLSearchParams(
    window.sessionStorage.getItem(FILTER_STATE_KEY) ?? "",
  );
  const filter = params.get("filter");
  const sort = params.get("sort");

  return {
    search: params.get("q") ?? "",
    category: params.get("category") ?? "",
    filter: filter === "expired" || filter === "expiring" ? filter : "",
    showFavorites: params.get("favorite") === "true",
    sort:
      sort === "name_desc" ||
      sort === "qty_asc" ||
      sort === "qty_desc" ||
      sort === "expiry_asc" ||
      sort === "created_desc" ||
      sort === "updated_desc"
        ? sort
        : "name_asc",
  };
}

export default function ItemsPage() {
  const t = useTranslations("items");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const [restoredFilters] = useState(readFilterState);

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
  const [search, setSearch] = useState(
    restoredFilters?.search ?? searchParams.get("q") ?? "",
  );
  const [category, setCategory] = useState<string>(
    restoredFilters?.category ?? searchParams.get("category") ?? "",
  );
  const [filter, setFilter] = useState<FilterOption>(
    restoredFilters?.filter ??
      ((searchParams.get("filter") as FilterOption) ?? ""),
  );
  const [showFavorites, setShowFavorites] = useState(
    restoredFilters?.showFavorites ?? false,
  );
  const [sort, setSort] = useState<SortOption>(
    restoredFilters?.sort ?? "name_asc",
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (restoredFilters) {
      window.sessionStorage.removeItem(RETURN_FROM_ITEM_KEY);
    }
  }, [restoredFilters]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (category) params.set("category", category);
    if (filter) params.set("filter", filter);
    if (showFavorites) params.set("favorite", "true");
    if (sort !== "name_asc") params.set("sort", sort);
    window.sessionStorage.setItem(FILTER_STATE_KEY, params.toString());
  }, [search, category, filter, showFavorites, sort]);

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
        if (showFavorites) params.set("favorite", "true");
        if (sort !== "name_asc") params.set("sort", sort);
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
    [user, search, category, filter, showFavorites, sort, showToast, t],
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
    { value: "name_asc", label: t("sortNameAsc") },
    { value: "name_desc", label: t("sortNameDesc") },
    { value: "qty_asc", label: t("sortQtyAsc") },
    { value: "qty_desc", label: t("sortQtyDesc") },
    { value: "expiry_asc", label: t("sortExpiryAsc") },
    { value: "created_desc", label: t("sortDateAdded") },
    { value: "updated_desc", label: t("sortRecentlyUpdated") },
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
        <Dropdown
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
          leadingIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          labelClassName="hidden sm:inline"
          className="flex-shrink-0"
        />
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
        <button
          onClick={() => setShowFavorites((f) => !f)}
          className={clsx(
            "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            showFavorites
              ? "bg-red-500 text-white"
              : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)]",
          )}
        >
          {t("filterFavorites")}
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
                onItemClick={() =>
                  window.sessionStorage.setItem(RETURN_FROM_ITEM_KEY, "1")
                }
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
