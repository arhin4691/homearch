"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ItemCard } from "@/components/ItemCard";

export default function FavoritesPage() {
  const t = useTranslations("favorites");
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchFavorites = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const res = await fetch("/api/items?favorite=true");
      if (res.ok) setItems((await res.json()).data);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { fetchFavorites(); }, [user]);

  const toggleFavorite = async (id: string) => {
    await fetch(`/api/items/${id}/favorite`, { method: "POST" });
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <Heart className="h-5 w-5 text-red-500 fill-red-500" />
        <h1 className="text-xl font-bold text-[var(--foreground)]">{t("title")}</h1>
      </div>

      {fetching ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center py-20 gap-4"
        >
          <div className="text-5xl">💝</div>
          <p className="text-[var(--muted)] text-sm">{t("noFavorites")}</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onFavoriteToggle={toggleFavorite} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
