"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { ItemCard } from "@/components/ItemCard";

interface LocationDetail {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  items: any[];
}

export default function LocationDetailPage() {
  const t = useTranslations("locations");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<LocationDetail | null>(null);

  useEffect(() => {
    fetch(`/api/locations/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => router.replace("/locations"));
  }, [id, router]);

  const toggleFavorite = async (itemId: string) => {
    await fetch(`/api/items/${itemId}/favorite`, { method: "POST" });
    const res = await fetch(`/api/locations/${id}`);
    if (res.ok) setData((await res.json()).data);
  };

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)]">
          <ArrowLeft className="h-4 w-4 text-[var(--foreground)]" />
        </button>
        <h1 className="text-xl font-bold text-[var(--foreground)]">{data.name}</h1>
      </div>

      {data.imageUrl && (
        <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-5">
          <Image src={data.imageUrl} alt={data.name} fill sizes="(max-width: 768px) 100vw, 800px" className="object-cover" />
        </div>
      )}

      {data.description && (
        <p className="text-sm text-[var(--muted)] mb-5">{data.description}</p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Package className="h-4 w-4 text-[var(--muted)]" />
        <span className="text-sm text-[var(--muted)]">{data.items.length} {data.items.length === 1 ? "item" : "items"}</span>
      </div>

      {data.items.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <div className="text-4xl">📦</div>
          <p className="text-[var(--muted)] text-sm">No items here yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data.items.map((item) => (
            <ItemCard key={item.id} item={item} onFavoriteToggle={toggleFavorite} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
