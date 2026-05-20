"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, X, Bell, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Notification {
  id: string;
  type: "FAMILY_INVITE" | "EXPIRY_ALERT" | "ITEM_ADDED" | "LOW_STOCK";
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "READ";
  title: string;
  message: string;
  metadata?: { itemId?: string; familyId?: string; requesterId?: string };
  createdAt: string;
}

const typeIcon: Record<Notification["type"], string> = {
  FAMILY_INVITE: "👨‍👩‍👧",
  EXPIRY_ALERT: "⏰",
  ITEM_ADDED: "📦",
  LOW_STOCK: "⚠️",
};

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setItems(d.data ?? []))
      .finally(() => setFetching(false));
  }, [user]);

  const respond = async (id: string, action: "accept" | "decline" | "read") => {
    const res = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      if (action === "accept") showToast("Family joined!", "success");
      setItems((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, status: action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "READ" }
            : n
        )
      );
    }
  };

  const handleNotificationClick = async (item: Notification) => {
    // Mark as read if pending
    if (item.status === "PENDING" && item.type !== "FAMILY_INVITE") {
      await respond(item.id, "read");
    }
    // Navigate to related content
    if (item.metadata?.itemId) {
      router.push(`/items/${item.metadata.itemId}`);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-5 w-5 text-[#7dc0ff]" />
        <h1 className="text-xl font-bold text-[var(--foreground)]">{t("title")}</h1>
      </div>

      {fetching ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="text-5xl">🔔</div>
          <p className="text-[var(--muted)] text-sm">{t("noNotifications")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isClickable = !!item.metadata?.itemId;
            return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => isClickable && handleNotificationClick(item)}
              className={`p-4 rounded-2xl border transition-colors ${
                item.status === "PENDING"
                  ? "bg-[#7dc0ff]/5 border-[#7dc0ff]/30"
                  : "bg-[var(--card)] border-[var(--card-border)] opacity-60"
              } ${isClickable ? "cursor-pointer hover:border-[#7dc0ff]/50" : ""}`}
            >
              <div className="flex gap-3">
                <span className="text-2xl flex-shrink-0">{typeIcon[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--foreground)]">{item.title}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{item.message}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {isClickable && (
                  <div className="flex-shrink-0 self-center">
                    <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
                  </div>
                )}
              </div>

              {item.type === "FAMILY_INVITE" && item.status === "PENDING" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); respond(item.id, "accept"); }}
                    className="flex-1"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t("accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); respond(item.id, "decline"); }}
                    className="flex-1"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {t("decline")}
                  </Button>
                </div>
              )}

              {item.status !== "PENDING" && (
                <div className="mt-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.status === "ACCEPTED" ? "bg-green-500/10 text-green-500" :
                    item.status === "DECLINED" ? "bg-red-500/10 text-red-500" :
                    "bg-[var(--card-border)] text-[var(--muted)]"
                  }`}>
                    {item.status}
                  </span>
                </div>
              )}
            </motion.div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
