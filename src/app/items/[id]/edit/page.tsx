"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useToast } from "@/components/ui/Toast";
import { ITEM_CATEGORIES } from "@/lib/constants";

const schema = z.object({
  name: z.string().min(1).max(100),
  category: z.string(),
  quantity: z.number().int().min(0).default(1),
  locationId: z.string().optional(),
  hasExpiry: z.boolean(),
  expiryDate: z.string().optional(),
  bestBeforeDate: z.string().optional(),
  hashTags: z.array(z.string()).default([]),
  imageUrl: z.string().optional(),
  imageFileId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function toDateInput(date?: string) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export default function EditItemPage() {
  const t = useTranslations("items");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { showToast } = useToast();
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [creatingLocation, setCreatingLocation] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { hasExpiry: true, hashTags: [], category: "Other", quantity: 1 },
  });

  const hasExpiry = watch("hasExpiry");
  const tags = watch("hashTags");

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((d) => setLocations(d.data ?? []));
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const item = d.data;
        reset({
          name: item.name,
          category: item.category,
          quantity: item.quantity ?? 1,
          locationId: item.location?.id ?? "",
          hasExpiry: item.hasExpiry,
          expiryDate: toDateInput(item.expiryDate),
          bestBeforeDate: toDateInput(item.bestBeforeDate),
          hashTags: item.hashTags,
          imageUrl: item.imageUrl,
        });
      });
  }, [id, reset]);

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/^#/, "");
      if (!tags.includes(tag)) setValue("hashTags", [...tags, tag]);
      setTagInput("");
    }
  };

  const createLocation = async () => {
    if (!newLocationName.trim()) return;
    setCreatingLocation(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocationName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create location");
      const json = await res.json();
      const newLoc = { id: json.data.id, name: json.data.name };
      setLocations((prev) => [newLoc, ...prev]);
      setValue("locationId", newLoc.id);
      setNewLocationName("");
      setShowNewLocation(false);
    } catch {
      // silently ignore
    } finally {
      setCreatingLocation(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        locationId: data.locationId || null,
        expiryDate: data.hasExpiry && data.expiryDate ? new Date(data.expiryDate).toISOString() : null,
        bestBeforeDate: data.hasExpiry && data.bestBeforeDate ? new Date(data.bestBeforeDate).toISOString() : null,
      };
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Item updated!", "success");
      router.push(`/items/${id}`);
    } catch (e: any) {
      showToast(e.message ?? "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)]">
          <ArrowLeft className="h-4 w-4 text-[var(--foreground)]" />
        </button>
        <h1 className="text-xl font-bold text-[var(--foreground)]">{t("editItem")}</h1>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <Controller
          control={control}
          name="imageUrl"
          render={({ field }) => (
            <ImageUpload
              label={t("image")}
              value={field.value}
              folder="/homearch/items"
              onChange={(url, fileId) => { field.onChange(url); setValue("imageFileId", fileId); }}
              onClear={() => { field.onChange(undefined); setValue("imageFileId", undefined); }}
            />
          )}
        />

        <Input label={t("name")} error={errors.name?.message} {...register("name")} />

        {/* Quantity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--foreground)]">Quantity</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { const v = watch("quantity"); setValue("quantity", Math.max(0, (v ?? 1) - 1)); }}
              className="w-9 h-9 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center text-lg font-bold text-[var(--foreground)] hover:border-[#7dc0ff] transition-colors"
            >−</button>
            <input
              type="number"
              min="0"
              className="w-20 text-center bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20 transition-colors"
              {...register("quantity", { valueAsNumber: true })}
            />
            <button
              type="button"
              onClick={() => { const v = watch("quantity"); setValue("quantity", (v ?? 1) + 1); }}
              className="w-9 h-9 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center text-lg font-bold text-[var(--foreground)] hover:border-[#7dc0ff] transition-colors"
            >+</button>
          </div>
        </div>

        <Select label={t("category")} {...register("category")}>
          {ITEM_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{t(`categories.${cat}` as any)}</option>
          ))}
        </Select>

        {/* Location with inline creation */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--foreground)]">{t("location")}</label>
            <button
              type="button"
              onClick={() => setShowNewLocation((v) => !v)}
              className="flex items-center gap-1 text-xs text-[#7dc0ff] font-medium hover:underline"
            >
              <Plus className="h-3 w-3" />
              New location
            </button>
          </div>
          <Select {...register("locationId")}>
            <option value="">{t("noLocation")}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </Select>
          <AnimatePresence>
            {showNewLocation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 overflow-hidden"
              >
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createLocation(); } }}
                  placeholder="Location name…"
                  className="flex-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={createLocation}
                  disabled={creatingLocation || !newLocationName.trim()}
                  className="px-4 py-2 bg-[#7dc0ff] text-white rounded-xl text-sm font-medium hover:bg-[#5aabff] disabled:opacity-50 transition-colors"
                >
                  {creatingLocation ? "…" : "Add"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
          <label className="text-sm font-medium text-[var(--foreground)]">{t("hasExpiry")}</label>
          <Controller
            control={control}
            name="hasExpiry"
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={`relative w-11 h-6 rounded-full transition-colors ${field.value ? "bg-[#7dc0ff]" : "bg-[var(--card-border)]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${field.value ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            )}
          />
        </div>

        {hasExpiry && (
          <div className="flex flex-col gap-4">
            <Input label={t("expiryDate")} type="date" {...register("expiryDate")} />
            <Input label={t("bestBeforeDate")} type="date" {...register("bestBeforeDate")} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[var(--foreground)]">{t("hashTags")}</label>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder={t("hashTagsPlaceholder")}
            className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-[#7dc0ff]/10 text-[#7dc0ff] rounded-full text-xs font-medium">
                  #{tag}
                  <button type="button" onClick={() => setValue("hashTags", tags.filter((t) => t !== tag))}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" loading={saving} fullWidth size="lg">Save Changes</Button>
      </motion.form>
    </AppShell>
  );
}
