"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Modal } from "@/components/ui/Modal";
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

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fetching, setFetching] = useState(false);
  const t = useTranslations("notifications");
  const router = useRouter();
  const { showToast } = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (res.ok) {
        const items: Notification[] = json.data ?? [];
        setNotifications(items);
        setUnreadCount(items.filter((n) => n.status === "PENDING").length);
      }
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  const respond = async (id: string, action: "accept" | "decline" | "read") => {
    const res = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      if (action === "accept") showToast(t("joined"), "success");
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                status:
                  action === "accept"
                    ? "ACCEPTED"
                    : action === "decline"
                    ? "DECLINED"
                    : "READ",
              }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleItemClick = async (item: Notification) => {
    if (item.status === "PENDING" && item.type !== "FAMILY_INVITE") {
      await respond(item.id, "read");
    }
    if (item.metadata?.itemId) {
      setOpen(false);
      router.push(`/items/${item.metadata.itemId}`);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); fetchNotifications(); }}
        className="relative p-2 rounded-xl hover:bg-[var(--card)] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-[var(--muted)]" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("title")}>
        {fetching ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <span className="text-4xl">🔔</span>
            <p className="text-sm text-[var(--muted)]">{t("noNotifications")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {notifications.map((item) => {
              const isClickable = !!item.metadata?.itemId;
              return (
                <div
                  key={item.id}
                  onClick={() => isClickable && handleItemClick(item)}
                  className={`p-3 rounded-2xl border transition-colors ${
                    item.status === "PENDING"
                      ? "bg-[#7dc0ff]/5 border-[#7dc0ff]/30"
                      : "bg-[var(--card)] border-[var(--card-border)] opacity-60"
                  } ${isClickable ? "cursor-pointer hover:border-[#7dc0ff]/50" : ""}`}
                >
                  <div className="flex gap-3 items-start">
                    <span className="text-xl flex-shrink-0">{typeIcon[item.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--foreground)]">{item.title}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{item.message}</p>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isClickable && (
                      <ArrowRight className="h-4 w-4 text-[var(--muted)] flex-shrink-0 self-center" />
                    )}
                  </div>

                  {item.type === "FAMILY_INVITE" && item.status === "PENDING" && (
                    <div className="flex gap-2 mt-2">
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
                    <div className="mt-1.5">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          item.status === "ACCEPTED"
                            ? "bg-green-500/10 text-green-500"
                            : item.status === "DECLINED"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-[var(--card-border)] text-[var(--muted)]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
