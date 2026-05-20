"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Bell, Package, MapPin, AlertTriangle, TrendingUp, Plus, RefreshCw, ScanLine, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface DashboardData {
  stats: {
    totalItems: number;
    totalLocations: number;
    expiredItems: number;
    expiringItems: number;
    unreadCount: number;
  };
  expiringList: {
    id: string;
    name: string;
    category: string;
    imageUrl?: string;
    expiryDate?: string;
    bestBeforeDate?: string;
  }[];
  recentItems: {
    id: string;
    name: string;
    category: string;
    imageUrl?: string;
    hasExpiry: boolean;
    expiryDate?: string;
    location?: { name: string } | null;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const { user, loading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/items?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppShell>
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest font-medium">Dashboard</p>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Hi, {user.name.split(" ")[0]} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => router.push("/notifications")}
            className="relative p-2.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)]"
          >
            <Bell className="h-5 w-5 text-[var(--foreground)]" />
            {data?.stats.unreadCount ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {data.stats.unreadCount > 9 ? "9+" : data.stats.unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="mb-6">
        <Input
          placeholder="Search items, categories, #tags..."
          leftIcon={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      {/* ── Quick actions ──────────────────────────────── */}
      {user.familyId && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          <QuickAction icon={<Plus className="h-4 w-4" />} label="Add Item" onClick={() => router.push("/items/new")} primary />
          <QuickAction icon={<MapPin className="h-4 w-4" />} label="Add Location" onClick={() => router.push("/locations")} />
          <QuickAction icon={<ScanLine className="h-4 w-4" />} label="Scan" onClick={() => router.push("/items/new")} />
          <QuickAction icon={<Star className="h-4 w-4" />} label="Favorites" onClick={() => router.push("/favorites")} />
        </div>
      )}

      {/* ── Family setup prompt ────────────────────────── */}
      {!user.familyId && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#7dc0ff]/10 border border-[#7dc0ff]/30 rounded-2xl p-5 mb-6"
        >
          <p className="font-semibold text-[var(--foreground)] mb-1">Set up your family</p>
          <p className="text-sm text-[var(--muted)] mb-3">Create or join a family to start tracking items.</p>
          <Button onClick={() => router.push("/settings")} size="sm" variant="outline">Go to Settings</Button>
        </motion.div>
      )}

      {data && (
        /* ── Desktop two-column layout ─────────────────── */
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Package className="h-5 w-5 text-[#7dc0ff]" />}
                label={t("totalItems")}
                value={data.stats.totalItems}
                color="bg-[#7dc0ff]/10"
                onClick={() => router.push("/items")}
              />
              <StatCard
                icon={<MapPin className="h-5 w-5 text-purple-500" />}
                label={t("totalLocations")}
                value={data.stats.totalLocations}
                color="bg-purple-500/10"
                onClick={() => router.push("/locations")}
              />
              <StatCard
                icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
                label="Expired"
                value={data.stats.expiredItems}
                color="bg-red-500/10"
                alert={data.stats.expiredItems > 0}
                onClick={() => router.push("/items?filter=expired")}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
                label="Expiring soon"
                value={data.stats.expiringItems}
                color="bg-orange-500/10"
                alert={data.stats.expiringItems > 0}
                onClick={() => router.push("/items?filter=expiring")}
              />
            </div>

            {/* Recent items */}
            {data.recentItems.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[var(--foreground)]">{t("recentItems")}</h2>
                  <button onClick={() => router.push("/items")} className="text-xs text-[#7dc0ff] font-medium">{t("viewAll")}</button>
                </div>
                <div className="flex flex-col gap-3">
                  {data.recentItems.map((item) => (
                    <ItemCard key={item.id} item={item} view="list" />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column (desktop: expiring items) */}
          <div className="mt-6 lg:mt-0 flex flex-col gap-6">
            {data.expiringList.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[var(--foreground)]">{t("expiringItems")}</h2>
                  <button onClick={() => router.push("/items?filter=expiring")} className="text-xs text-[#7dc0ff] font-medium">{t("viewAll")}</button>
                </div>
                <div className="flex flex-col gap-3">
                  {data.expiringList.map((item) => (
                    <ItemCard key={item.id} item={{ ...item, hasExpiry: true }} view="list" />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Mobile FAB — hidden on desktop (sidebar has Add Item button) */}
      {user.familyId && (
        <button
          onClick={() => router.push("/items/new")}
          className="lg:hidden fixed bottom-24 right-4 w-14 h-14 bg-[#7dc0ff] hover:bg-[#5aabff] text-white rounded-2xl shadow-lg shadow-[#7dc0ff]/40 flex items-center justify-center transition-all active:scale-95 z-30"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  alert = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`${color} rounded-2xl p-4 text-left w-full transition-opacity hover:opacity-80 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="mb-2">{icon}</div>
      <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-xs text-[var(--muted)] mt-0.5">{label}</p>
      {alert && value > 0 && (
        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500" />
      )}
    </motion.button>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
        primary
          ? "bg-[#7dc0ff] text-white shadow-md shadow-[#7dc0ff]/30 hover:bg-[#5aabff]"
          : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] hover:bg-[var(--background)]"
      }`}
    >
      {icon}
      {label}
    </motion.button>
  );
}
