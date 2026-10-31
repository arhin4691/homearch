"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export type VoiceItemStatus = "NEW" | "RESTOCK" | "CONSUME" | "NOT_FOUND" | "AMBIGUOUS";

export interface VoicePreviewItem {
  tempId: string;
  name: string;
  category: string | null;
  action: "ADD" | "REMOVE";
  quantity: number;
  hasExpiry: boolean | null;
  expiryDate: string | null;
  matchedItemId: string | null;
  currentQuantity: number;
  status: VoiceItemStatus;
  candidates: { id: string; quantity: number; location: string | null }[];
}

interface VoiceOperation {
  itemId: string;
  name: string;
  category: string;
  locationName?: string | null;
  action: "ADD" | "REMOVE";
  beforeQuantity: number;
  afterQuantity: number;
  createsItem: boolean;
  hasExpiry?: boolean;
  expiryDate?: string | null;
}

interface VoicePreviewDrawerProps {
  open: boolean;
  items: VoicePreviewItem[];
  onClose: () => void;
  onApplied?: () => void;
}

export function VoicePreviewDrawer({ open, items, onClose, onApplied }: VoicePreviewDrawerProps) {
  const t = useTranslations("items");
  const common = useTranslations("common");
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [editable, setEditable] = useState<VoicePreviewItem[]>(() => items.map((item) => ({ ...item })));
  const [prepared, setPrepared] = useState<{ id: string; operations: VoiceOperation[] } | null>(null);
  const [applying, setApplying] = useState(false);
  useBodyScrollLock(open);

  const update = (id: string, patch: Partial<VoicePreviewItem>) =>
    setEditable((previous) => previous.map((item) => item.tempId === id ? { ...item, ...patch } : item));
  const invalid = editable.some((item) =>
    item.status === "NOT_FOUND" || item.status === "AMBIGUOUS" ||
    (item.action === "REMOVE" && item.quantity > item.currentQuantity) ||
    (item.status === "NEW" && (!item.category || item.hasExpiry === null || (item.hasExpiry && !item.expiryDate))),
  );

  const prepare = async () => {
    setApplying(true);
    try {
      const response = await fetch("/api/ai/voice-prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: editable.map((item) => ({
          matchedItemId: item.matchedItemId, name: item.name, category: item.category,
          action: item.action, quantity: item.quantity, hasExpiry: item.hasExpiry,
          expiryDate: item.expiryDate,
        })) }),
      });
      if (!response.ok) throw new Error(t("voiceReviewFailed"));
      const json = await response.json();
      setPrepared(json.data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("voiceReviewFailed"), "error");
    } finally {
      setApplying(false);
    }
  };

  const commit = async () => {
    if (!prepared) return;
    setApplying(true);
    try {
      const response = await fetch("/api/ai/voice-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prepared.id, confirm: true }),
      });
      if (!response.ok) throw new Error(t("voiceApplyFailed"));
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      showToast(t("voiceApplySuccess"), "success");
      onApplied?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("voiceApplyFailed"), "error");
      setPrepared(null);
    } finally {
      setApplying(false);
    }
  };

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button aria-label={common("cancel")} className="absolute inset-0 bg-black/50" onClick={() => !applying && onClose()} />
      <section role="dialog" aria-modal="true" aria-label={t("voicePreviewTitle")} className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-4xl bg-[var(--background)] shadow-2xl sm:max-w-lg">
        <div className="border-b border-[var(--card-border)] p-4">
          <h2 className="text-lg font-bold">{prepared ? t("voiceFinalReview") : t("voicePreviewTitle")}</h2>
          <p className="text-xs text-[var(--muted)]">{prepared ? t("voiceFinalReviewHint") : t("voicePreviewSubtitle")}</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {prepared ? prepared.operations.map((operation) => (
            <div key={operation.itemId} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-sm">
              <p className="font-semibold">{operation.name} · {operation.action === "ADD" ? t("voiceBadgeRestock") : t("voiceBadgeConsume")}</p>
              <p>{t("voiceCurrentQty")}: {operation.beforeQuantity} → {t("voicePendingQty")}: {operation.afterQuantity}</p>
              <p>{t("category")}: {operation.category}</p>
              {operation.createsItem && <p>{t("expiryDate")}: {operation.hasExpiry ? operation.expiryDate?.slice(0, 10) : t("voiceNoExpiry")}</p>}
              {!operation.createsItem && <p className="text-xs text-[var(--muted)]">{t("location")}: {operation.locationName ?? t("noLocation")} · ID: {operation.itemId}</p>}
            </div>
          )) : editable.map((item) => (
            <div key={item.tempId} className="space-y-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
              <div className="flex justify-between gap-2">
                <p className="font-semibold">{item.name} · {item.action === "ADD" ? t("voiceBadgeRestock") : t("voiceBadgeConsume")}</p>
                <button onClick={() => setEditable((previous) => previous.filter((entry) => entry.tempId !== item.tempId))} aria-label={common("delete")}>×</button>
              </div>
              {item.status === "NOT_FOUND" && <p className="text-sm text-red-500">{t("voiceNotFoundHint")}</p>}
              {item.candidates.length > 1 && (
                <Select label={t("voiceChooseMatch")} value={item.matchedItemId ?? ""} onChange={(event) => {
                  const candidate = item.candidates.find((entry) => entry.id === event.target.value);
                  update(item.tempId, candidate
                    ? { matchedItemId: candidate.id, currentQuantity: candidate.quantity, status: item.action === "ADD" ? "RESTOCK" : "CONSUME" }
                    : { matchedItemId: null, currentQuantity: 0, status: "AMBIGUOUS" });
                }}>
                  <option value="">{t("voiceChooseMatch")}</option>
                  {item.candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.location ?? t("noLocation")} · {candidate.quantity} · {candidate.id.slice(-6)}</option>
                  ))}
                </Select>
              )}
              <Input type="number" label={t("quantity")} min={1} max={100000} value={item.quantity}
                onChange={(event) => update(item.tempId, { quantity: Number(event.target.value) })} />
              {item.matchedItemId && <p className="text-sm">{t("voiceCurrentQty")}: {item.currentQuantity} → {t("voicePendingQty")}: {item.action === "ADD" ? item.currentQuantity + item.quantity : item.currentQuantity - item.quantity}</p>}
              {item.action === "REMOVE" && item.matchedItemId && item.quantity > item.currentQuantity && <p className="text-sm text-red-500">{t("voiceInsufficient")}</p>}
              {item.status === "NEW" && (
                <>
                  <Select label={t("category")} value={item.category ?? ""} onChange={(event) => update(item.tempId, { category: event.target.value || null })}>
                    <option value="">{t("voiceChooseCategory")}</option>
                    {ITEM_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </Select>
                  <Select label={t("expiryDate")} value={item.hasExpiry === null ? "" : item.hasExpiry ? "yes" : "no"} onChange={(event) => {
                    const value = event.target.value;
                    update(item.tempId, { hasExpiry: value === "" ? null : value === "yes", expiryDate: value === "yes" ? item.expiryDate : null });
                  }}>
                    <option value="">{t("voiceChooseExpiry")}</option>
                    <option value="yes">{t("voiceHasExpiry")}</option>
                    <option value="no">{t("voiceNeverExpire")}</option>
                  </Select>
                  {item.hasExpiry && <Input label={t("expiryDate")} type="date" value={item.expiryDate ?? ""} onChange={(event) => update(item.tempId, { expiryDate: event.target.value || null })} />}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-[var(--card-border)] p-4">
          <Button variant="secondary" disabled={applying} onClick={() => prepared ? setPrepared(null) : onClose()}>{prepared ? common("back") : common("cancel")}</Button>
          <Button fullWidth loading={applying} disabled={!prepared && (editable.length === 0 || invalid || editable.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000))} onClick={prepared ? commit : prepare}>
            {prepared ? t("voiceConfirmApply") : t("voiceReview")}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
