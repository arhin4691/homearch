"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, MapPin } from "lucide-react";
import {
  CategoryBadge,
  ExpiryBadge,
  QuantityBadge,
} from "@/components/ui/Badge";

interface ItemCardProps {
  item: {
    id: string;
    name: string;
    category: string;
    quantity?: number;
    imageUrl?: string;
    hasExpiry?: boolean;
    expiryDate?: string | Date;
    isFavorite?: boolean;
    location?: { name: string } | null;
  };
  onFavoriteToggle?: (id: string) => void;
  view?: "grid" | "list";
}

function getDaysUntilExpiry(expiryDate?: string | Date | null): number | null {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function ItemCard({
  item,
  onFavoriteToggle,
  view = "grid",
}: ItemCardProps) {
  const router = useRouter();
  const days = item.hasExpiry ? getDaysUntilExpiry(item.expiryDate) : null;

  if (view === "list") {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => router.push(`/items/${item.id}`)}
        className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--card-border)] rounded-2xl cursor-pointer hover:border-[#7dc0ff]/50 transition-all"
        style={{
          opacity: item.quantity === 0 ? "0.5" : "",
        }}
      >
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--card-border)] flex-shrink-0">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              style={{
                filter:
                  item.quantity === 0
                    ? "grayscale(100%) brightness(50%)"
                    : "none",
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              📦
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--foreground)] truncate">
            {item.name}
            {item.quantity !== undefined && (
              <QuantityBadge quantity={item.quantity} />
            )}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {days !== null && (
              <ExpiryBadge
                daysUntilExpiry={days}
                orgExpDate={item.expiryDate}
              />
            )}
          </div>
          {item.location && (
            <div className="flex items-center gap-1 mt-1">
            <CategoryBadge label={item.category} />
              <MapPin className="h-3 w-3 text-[var(--muted)]" />
              <span className="text-xs text-[var(--muted)] truncate">
                {item.location.name}
              </span>
            </div>
          )}
        </div>
        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle(item.id);
            }}
            className="p-2 flex-shrink-0"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                item.isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-[var(--muted)]"
              }`}
            />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      onClick={() => router.push(`/items/${item.id}`)}
      className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden cursor-pointer hover:border-[#7dc0ff]/50 hover:shadow-md hover:shadow-[#7dc0ff]/10 transition-all"
      style={{
        opacity: item.quantity === 0 ? "0.5" : "",
      }}
    >
      <div className="relative w-full aspect-square bg-[var(--card-border)]">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            className="object-cover"
            style={{
              filter:
                item.quantity === 0
                  ? "grayscale(100%) brightness(50%)"
                  : "none",
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            📦
          </div>
        )}
        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle(item.id);
            }}
            className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm rounded-full"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                item.isFavorite ? "fill-red-500 text-red-500" : "text-white"
              }`}
            />
          </button>
        )}
        {days !== null && days <= 7 && (
          <div className="absolute bottom-2 left-2">
            <ExpiryBadge daysUntilExpiry={days} orgExpDate={item.expiryDate} />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-[var(--foreground)] truncate text-sm">
          {item.name}
          {item.quantity !== undefined && (
            <QuantityBadge quantity={item.quantity} />
          )}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <CategoryBadge label={item.category} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          {item.location && (
            <div className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3 text-[var(--muted)]" />
              <span className="text-xs text-[var(--muted)] truncate max-w-[80px]">
                {item.location.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
