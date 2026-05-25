"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Heart,
  MapPin,
  Tag,
  Calendar,
  Clock,
  Minus,
  Plus,
  Package,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { CategoryBadge, ExpiryBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface ItemDetail {
  id: string;
  name: string;
  category: string;
  quantity: number;
  imageUrl?: string;
  hasExpiry: boolean;
  expiryDate?: string;
  bestBeforeDate?: string;
  hashTags: string[];
  isFavorite: boolean;
  location?: { id: string; name: string } | null;
  uploader?: { name: string; avatarUrl?: string } | null;
  createdAt: string;
  updatedAt: string;
}

function getDays(date?: string) {
  if (!date) return null;
  return Math.ceil(
    (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export default function ItemDetailPage() {
  const t = useTranslations("items");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { showToast } = useToast();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const fetchItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/items/${id}`);
      if (res.ok) setItem((await res.json()).data);
      else router.replace("/items");
    } catch {
      router.replace("/items");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const toggleFavorite = async () => {
    const res = await fetch(`/api/items/${id}/favorite`, { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      setItem((prev) =>
        prev ? { ...prev, isFavorite: json.data.isFavorite } : prev,
      );
    }
  };

  const adjustQty = async (delta: number) => {
    if (adjusting) return;
    setAdjusting(true);
    try {
      const res = await fetch(`/api/items/${id}/quantity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      if (res.ok) {
        const json = await res.json();
        setItem((prev) =>
          prev ? { ...prev, quantity: json.data.quantity } : prev,
        );
      }
    } finally {
      setAdjusting(false);
    }
  };

  const deleteItem = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/items/${id}`, { method: "DELETE" });
      showToast("Item deleted", "success");
      router.replace("/items");
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!item) return null;

  const days = item.hasExpiry ? getDays(item.expiryDate) : null;

  return (
    <AppShell>
      {/* Back & actions */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)]"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--foreground)]" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFavorite}
            className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)]"
          >
            <Heart
              className={`h-4 w-4 ${item.isFavorite ? "fill-red-500 text-red-500" : "text-[var(--foreground)]"}`}
            />
          </button>
          <button
            onClick={() => router.push(`/items/${id}/edit`)}
            className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)]"
          >
            <Edit className="h-4 w-4 text-[var(--foreground)]" />
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="p-2 rounded-xl bg-red-500/10 border border-red-500/30"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Image */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full h-56 rounded-2xl overflow-hidden bg-[var(--card)] border border-[var(--card-border)] mb-5"
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            📦
          </div>
        )}
      </motion.div>

      {/* Name & badges */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          {item.name}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge label={item.category} />
          {days !== null && <ExpiryBadge daysUntilExpiry={days} />}
        </div>
      </motion.div>

      {/* Details */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Quantity control */}
        <div className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-[var(--background)] flex items-center justify-center flex-shrink-0">
            <Package className="h-4 w-4 text-[#7dc0ff]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted)]">Quantity</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustQty(-1)}
              disabled={adjusting || (item.quantity ?? 1) <= 0}
              className="w-8 h-8 rounded-lg bg-[var(--background)] border border-[var(--card-border)] flex items-center justify-center disabled:opacity-40 hover:border-[#7dc0ff] transition-colors"
            >
              <Minus className="h-3.5 w-3.5 text-[var(--foreground)]" />
            </button>
            <span
              className={`w-10 text-center text-lg font-bold tabular-nums ${(item.quantity ?? 1) <= 2 ? "text-orange-500" : "text-[var(--foreground)]"}`}
            >
              {item.quantity ?? 1}
            </span>
            <button
              onClick={() => adjustQty(+1)}
              disabled={adjusting}
              className="w-8 h-8 rounded-lg bg-[var(--background)] border border-[var(--card-border)] flex items-center justify-center hover:border-[#7dc0ff] transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--foreground)]" />
            </button>
          </div>
        </div>

        {item.location && (
          <DetailRow
            icon={<MapPin className="h-4 w-4 text-purple-500" />}
            label="Location"
            value={item.location.name}
          />
        )}
        {item.hasExpiry && item.expiryDate && (
          <DetailRow
            icon={<Calendar className="h-4 w-4 text-red-500" />}
            label={t("expires")}
            value={new Date(item.expiryDate).toLocaleDateString()}
          />
        )}
        {item.hasExpiry && item.bestBeforeDate && (
          <DetailRow
            icon={<Clock className="h-4 w-4 text-orange-500" />}
            label={t("bestBefore")}
            value={new Date(item.bestBeforeDate).toLocaleDateString()}
          />
        )}
        {item.uploader && (
          <DetailRow
            icon={<span className="text-base">👤</span>}
            label={t("addedBy")}
            value={item.uploader.name}
          />
        )}
      </div>

      {/* Tags */}
      {item.hashTags.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">
              {t("hashTags")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.hashTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-[#7dc0ff]/10 text-[#7dc0ff] rounded-full text-xs font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Item"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDelete(false)}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deleteItem}
              loading={deleting}
              fullWidth
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-[var(--foreground)]">{t("deleteConfirm")}</p>
      </Modal>
    </AppShell>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-[var(--background)] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--muted)]">{label}</p>
        <p className="text-sm font-medium text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}
