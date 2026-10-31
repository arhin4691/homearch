"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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
const SCROLL_STATE_KEY = "items-scroll-state";

interface Item {
  id: string;
  name: string;
  category: string;
  quantity?: number;
  imageUrl?: string;
  hasExpiry?: boolean;
  expiryDate?: string;
  isFavorite?: boolean;
  location?: { name: string } | null;
}

interface ItemsPageData {
  items: Item[];
  hasMore: boolean;
}

interface ScrollState {
  id: string;
  offset: number;
  scrollY: number;
  pages: number;
}

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
  const tRetry = useTranslations("invite");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [restoredFilters] = useState(readFilterState);
  const [scrollState] = useState<ScrollState | null>(() => {
    if (typeof window === "undefined" || !readFilterState()) return null;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(SCROLL_STATE_KEY) ?? "null");
      if (saved && typeof saved.id === "string" && typeof saved.offset === "number" && typeof saved.scrollY === "number" && typeof saved.pages === "number") return saved;
    } catch (error) {
      console.error("Failed to restore item scroll position", error);
    }
    return null;
  });
  const [restoring, setRestoring] = useState(!!scrollState);
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
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

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

  const {
    data,
    isPending,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
  } = useInfiniteQuery({
    queryKey: ["items", user?.id, user?.familyId, debouncedSearch, category, filter, showFavorites, sort],
    enabled: !!user,
    initialPageParam: 1,
    gcTime: 30 * 60 * 1000,
    queryFn: async ({ pageParam, signal }): Promise<ItemsPageData> => {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (category) params.set("category", category);
        if (filter) params.set("filter", filter);
        if (showFavorites) params.set("favorite", "true");
        if (sort !== "name_asc") params.set("sort", sort);
        params.set("page", String(pageParam));
        params.set("limit", String(PAGE_SIZE));
        const res = await fetch(`/api/items?${params}`, { signal });
        if (!res.ok) throw new Error("Failed to load items");
        return (await res.json()).data;
    },
    getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.length + 1 : undefined,
  });
  const items = data?.pages.flatMap((result) => result.items) ?? [];
  const fetching = isPending || (search !== debouncedSearch);

  useEffect(() => {
    if (error) showToast(t("loadError"), "error");
  }, [error, showToast, t]);

  useEffect(() => {
    if (restoring && scrollState && data && !error && !isFetching &&
        data.pages.length < scrollState.pages && hasNextPage) {
      void fetchNextPage();
    }
  }, [restoring, scrollState, data, error, isFetching, hasNextPage, fetchNextPage]);

  useEffect(() => {
    if (!restoring || !scrollState || fetching || isFetching) return;
    if (!error && data && data.pages.length < scrollState.pages && hasNextPage) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`item-${scrollState.id}`);
      window.scrollTo({
        top: element
          ? window.scrollY + element.getBoundingClientRect().top - scrollState.offset
          : scrollState.scrollY,
        behavior: "instant",
      });
      window.sessionStorage.removeItem(SCROLL_STATE_KEY);
      window.sessionStorage.removeItem(RETURN_FROM_ITEM_KEY);
      setRestoring(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [restoring, scrollState, fetching, isFetching, data, error, hasNextPage]);

  useEffect(() => {
    if (!restoring && restoredFilters) {
      window.sessionStorage.removeItem(RETURN_FROM_ITEM_KEY);
    }
  }, [restoring, restoredFilters]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetching && !fetching && !restoring && !error) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetching, restoring, error, fetchNextPage]);

  const toggleFavorite = async (id: string) => {
    try {
      const res = await fetch(`/api/items/${id}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to update favorite");
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch {
      showToast(t("updateFailed"), "error");
    }
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
      ) : error && !data ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <p className="text-[var(--muted)] text-sm">{t("loadError")}</p>
          <button onClick={() => void refetch()} className="text-primary text-sm font-medium">
            {tRetry("retry")}
          </button>
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
              <div id={`item-${item.id}`} key={item.id}>
                <ItemCard
                  item={item}
                  onFavoriteToggle={toggleFavorite}
                  onItemClick={() => {
                    const element = document.getElementById(`item-${item.id}`);
                    window.sessionStorage.setItem(SCROLL_STATE_KEY, JSON.stringify({
                      id: item.id,
                      offset: element?.getBoundingClientRect().top ?? 0,
                      scrollY: window.scrollY,
                      pages: data?.pages.length ?? 1,
                    }));
                    window.sessionStorage.setItem(RETURN_FROM_ITEM_KEY, "1");
                  }}
                  view={view}
                />
              </div>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <button onClick={() => void (hasNextPage ? fetchNextPage() : refetch())} className="block mx-auto py-4 text-primary text-sm font-medium">
              {tRetry("retry")}
            </button>
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
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["items"] })}
      />
    </AppShell>
  );
}
