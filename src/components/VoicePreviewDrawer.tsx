"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Loader2, CalendarClock, Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export type VoiceItemStatus = "NEW" | "RESTOCK" | "CONSUME" | "NOT_FOUND";

export interface VoicePreviewItem {
  tempId: string;
  name: string;
  category: string;
  action: "ADD" | "REMOVE";
  quantity: number;
  hasExpiry: boolean;
  expiryDate: string | null;
  matchedItemId: string | null;
  currentQuantity: number;
  status: VoiceItemStatus;
}

interface VoicePreviewDrawerProps {
  open: boolean;
  items: VoicePreviewItem[];
  onClose: () => void;
  onApplied?: () => void;
}

function todayHK(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
}

function addDays(dateStr: string | null, days: number): string {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date(`${todayHK()}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().split("T")[0];
}

function pendingQuantity(item: VoicePreviewItem): number {
  if (item.status === "NOT_FOUND") return 0;
  if (item.action === "ADD") return item.currentQuantity + item.quantity;
  return Math.max(item.currentQuantity - item.quantity, 0);
}

export function VoicePreviewDrawer({ open, items, onClose, onApplied }: VoicePreviewDrawerProps) {
  const t = useTranslations("items");
  const { showToast } = useToast();
  const [editable, setEditable] = useState<VoicePreviewItem[]>([]);
  const [applying, setApplying] = useState(false);
  const [mounted, setMounted] = useState(false);

  useBodyScrollLock(open);

  // Render via a portal (mounted only on the client) so the drawer always
  // overlays any parent modal instead of being clipped/positioned by it.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync local editable copy whenever a fresh preview list is opened.
  useEffect(() => {
    if (open) setEditable(items.map((i) => ({ ...i })));
  }, [open, items]);

  const statusMeta: Record<VoiceItemStatus, { label: string; className: string }> = {
    NEW: { label: `🆕 ${t("voiceBadgeNew")}`, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    RESTOCK: { label: `➕ ${t("voiceBadgeRestock")}`, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    CONSUME: { label: `➖ ${t("voiceBadgeConsume")}`, className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
    NOT_FOUND: { label: `⚠️ ${t("voiceBadgeNotFound")}`, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };

  const updateItem = (tempId: string, patch: Partial<VoicePreviewItem>) => {
    setEditable((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i)));
  };

  const bumpQuantity = (tempId: string, delta: number) => {
    setEditable((prev) =>
      prev.map((i) =>
        i.tempId === tempId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i,
      ),
    );
  };

  const removeCard = (tempId: string) => {
    setEditable((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const handleConfirm = async () => {
    if (editable.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch("/api/ai/voice-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editable.map((i) => ({
            matchedItemId: i.matchedItemId,
            name: i.name,
            category: i.category,
            action: i.action,
            quantity: i.quantity,
            hasExpiry: i.hasExpiry,
            expiryDate: i.expiryDate,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t("voiceApplyFailed"));
      showToast(t("voiceApplySuccess"), "success");
      onApplied?.();
    } catch (e: any) {
      showToast(e.message ?? t("voiceApplyFailed"), "error");
    } finally {
      setApplying(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !applying && onClose()}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-lg bg-[var(--background)] rounded-t-4xl shadow-4xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Handle + header */}
            <div className="flex flex-col items-center pt-3 pb-2 px-5 border-b border-[var(--card-border)] flex-shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-[var(--card-border)] mb-3" />
              <div className="flex items-center justify-between w-full">
                <div>
                  <h2 className="text-lg font-bold text-[var(--foreground)]">{t("voicePreviewTitle")}</h2>
                  <p className="text-xs text-[var(--muted)]">{t("voicePreviewSubtitle")}</p>
                </div>
                <button
                  onClick={() => !applying && onClose()}
                  className="p-2 rounded-xl hover:bg-[var(--card)] text-[var(--muted)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {editable.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-10">{t("voiceEmptyList")}</p>
              ) : (
                editable.map((item) => {
                  const meta = statusMeta[item.status];
                  const pending = pendingQuantity(item);
                  return (
                    <div
                      key={item.tempId}
                      className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[var(--foreground)]">{item.name}</span>
                          <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-medium", meta.className)}>
                            {meta.label}
                          </span>
                        </div>
                        <button
                          onClick={() => removeCard(item.tempId)}
                          className="p-1 rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {item.status === "NOT_FOUND" && (
                        <p className="text-xs text-red-500">{t("voiceNotFoundHint")}</p>
                      )}

                      {/* Quantity stepper */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--muted)]">{t("quantity")}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => bumpQuantity(item.tempId, -1)}
                            className="w-7 h-7 rounded-lg bg-[var(--background)] border border-[var(--card-border)] flex items-center justify-center text-[var(--foreground)]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-[var(--foreground)]">{item.quantity}</span>
                          <button
                            onClick={() => bumpQuantity(item.tempId, 1)}
                            className="w-7 h-7 rounded-lg bg-[var(--background)] border border-[var(--card-border)] flex items-center justify-center text-[var(--foreground)]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Current -> Pending */}
                      {item.status !== "NEW" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--muted)]">
                            {t("voiceCurrentQty")}: <span className="font-medium text-[var(--foreground)]">{item.currentQuantity}</span>
                          </span>
                          <span className="text-[var(--muted)]">
                            {t("voicePendingQty")}: <span className="font-semibold text-[#7dc0ff]">{pending}</span>
                          </span>
                        </div>
                      )}

                      {/* Expiry */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {item.hasExpiry && item.expiryDate ? item.expiryDate : t("voiceNoExpiry")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => updateItem(item.tempId, { hasExpiry: true, expiryDate: addDays(item.expiryDate, 3) })}
                            className="px-2.5 py-1 rounded-full text-[0.7rem] font-medium bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] hover:border-[#7dc0ff]"
                          >
                            {t("voicePlus3Days")}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.tempId, { hasExpiry: true, expiryDate: addDays(item.expiryDate, 7) })}
                            className="px-2.5 py-1 rounded-full text-[0.7rem] font-medium bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] hover:border-[#7dc0ff]"
                          >
                            {t("voicePlus1Week")}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.tempId, { hasExpiry: false, expiryDate: null })}
                            className={clsx(
                              "px-2.5 py-1 rounded-full text-[0.7rem] font-medium border flex items-center gap-1",
                              !item.hasExpiry
                                ? "bg-[#7dc0ff]/10 border-[#7dc0ff] text-[#7dc0ff]"
                                : "bg-[var(--background)] border-[var(--card-border)] text-[var(--foreground)] hover:border-[#7dc0ff]",
                            )}
                          >
                            <Ban className="h-3 w-3" />
                            {t("voiceNeverExpire")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-[var(--card-border)] bg-[var(--card)] flex-shrink-0">
              <Button
                fullWidth
                size="lg"
                disabled={editable.length === 0 || applying}
                onClick={handleConfirm}
                className="rounded-2xl"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("voiceApplying")}
                  </>
                ) : (
                  t("voiceConfirmApply")
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
