"use client";

import { useEffect, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { ITEM_CATEGORIES } from "@/lib/constants";

const schema = z.object({
  name: z.string().min(1, "Name required").max(100),
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

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  /** If provided, loads the item and switches to edit mode */
  itemId?: string;
  onSuccess?: (item: any) => void;
}

export function ItemFormModal({
  open,
  onClose,
  itemId,
  onSuccess,
}: ItemFormModalProps) {
  const t = useTranslations("items");
  const tN = useTranslations("notifications");
  const { showToast } = useToast();
  const isEdit = !!itemId;

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationComboRef = useRef<HTMLDivElement>(null);

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

  // Load locations when modal opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.data?.locations ?? []))
      .catch(() => {});
  }, [open]);

  // Load item data for edit mode
  useEffect(() => {
    if (!open || !itemId) return;
    fetch(`/api/items/${itemId}`)
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
          hashTags: item.hashTags ?? [],
          imageUrl: item.imageUrl,
          imageFileId: item.imageFileId,
        });
        if (item.location?.name) setLocationSearch(item.location.name);
      })
      .catch(() => {});
  }, [open, itemId, reset]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      reset({ hasExpiry: true, hashTags: [], category: "Other", quantity: 1 });
      setTagInput("");
      setLocationSearch("");
    }
  }, [open, reset]);

  // Close location dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationComboRef.current && !locationComboRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredLocations = locations.filter((loc) =>
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
  );

  const createLocationFromSearch = async () => {
    if (!locationSearch.trim() || creatingLocation) return;
    setCreatingLocation(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: locationSearch.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create location");
      const json = await res.json();
      const newLoc = { id: json.data.id, name: json.data.name };
      setLocations((prev) => [newLoc, ...prev]);
      setValue("locationId", newLoc.id);
      setLocationSearch(newLoc.name);
      setShowLocationDropdown(false);
    } catch (e: any) {
      showToast(e.message ?? "Failed to create location", "error");
    } finally {
      setCreatingLocation(false);
    }
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/^#/, "");
      if (!tags.includes(tag)) setValue("hashTags", [...tags, tag]);
      setTagInput("");
    }
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        locationId: data.locationId || "",
        expiryDate:
          data.hasExpiry && data.expiryDate
            ? new Date(data.expiryDate).toISOString()
            : null,
        bestBeforeDate:
          data.hasExpiry && data.bestBeforeDate
            ? new Date(data.bestBeforeDate).toISOString()
            : null,
      };
      const res = isEdit
        ? await fetch(`/api/items/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      showToast(isEdit ? tN("itemUpdated") : tN("itemAdded"), "success");
      onClose();
      onSuccess?.(result.data);
    } catch (e: any) {
      showToast(e.message ?? "Failed to save item", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t("editItem") : t("addItem")}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Image */}
        <Controller
          control={control}
          name="imageUrl"
          render={({ field }) => (
            <ImageUpload
              label={t("image")}
              value={field.value}
              folder="/homearch/items"
              cropToSquare
              onChange={(url, fileId) => {
                field.onChange(url);
                setValue("imageFileId", fileId);
              }}
              onClear={() => {
                field.onChange(undefined);
                setValue("imageFileId", undefined);
              }}
            />
          )}
        />

        <Input
          label={t("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        {/* Quantity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--foreground)]">
            {t("quantity")}
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setValue("quantity", Math.max(0, (watch("quantity") ?? 1) - 1))}
              className="w-9 h-9 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center text-lg font-bold text-[var(--foreground)] hover:border-[#7dc0ff] transition-colors"
            >
              −
            </button>
            <input
              type="number"
              min="0"
              className="w-20 text-center bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20 transition-colors"
              {...register("quantity", { valueAsNumber: true })}
            />
            <button
              type="button"
              onClick={() => setValue("quantity", (watch("quantity") ?? 1) + 1)}
              className="w-9 h-9 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center text-lg font-bold text-[var(--foreground)] hover:border-[#7dc0ff] transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <Select label={t("category")} {...register("category")}>
          {ITEM_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`categories.${cat}` as any)}
            </option>
          ))}
        </Select>

        {/* Location searchable combobox */}
        <div className="flex flex-col gap-1.5" ref={locationComboRef}>
          <label className="text-sm font-medium text-[var(--foreground)]">
            {t("location")}
          </label>
          <div className="relative">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)] pointer-events-none" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => {
                  setLocationSearch(e.target.value);
                  setValue("locationId", "");
                  setShowLocationDropdown(true);
                }}
                onFocus={() => setShowLocationDropdown(true)}
                placeholder={t("noLocation")}
                className="w-full pl-9 pr-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20 transition-colors"
              />
            </div>
            <AnimatePresence>
              {showLocationDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-20 top-full mt-1 w-full bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-xl overflow-hidden"
                  style={{ maxHeight: 220, overflowY: "auto" }}
                >
                  {filteredLocations.length === 0 && !locationSearch.trim() && (
                    <p className="text-xs text-[var(--muted)] px-4 py-3">
                      {t("noLocation")}
                    </p>
                  )}
                  {filteredLocations.length === 0 && locationSearch.trim() && (
                    <p className="text-xs text-[var(--muted)] px-4 py-2">
                      No match found
                    </p>
                  )}
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setValue("locationId", loc.id);
                        setLocationSearch(loc.name);
                        setShowLocationDropdown(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors text-left"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[var(--muted)] flex-shrink-0" />
                      {loc.name}
                    </button>
                  ))}
                  {locationSearch.trim() &&
                    !filteredLocations.some(
                      (l) =>
                        l.name.toLowerCase() === locationSearch.trim().toLowerCase(),
                    ) && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={createLocationFromSearch}
                        disabled={creatingLocation}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#7dc0ff] hover:bg-[#7dc0ff]/5 transition-colors border-t border-[var(--card-border)] disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                        {creatingLocation
                          ? "Creating…"
                          : `Create "${locationSearch.trim()}"`}
                      </button>
                    )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Expiry toggle */}
        <div className="flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
          <label className="text-sm font-medium text-[var(--foreground)]">
            {t("hasExpiry")}
          </label>
          <Controller
            control={control}
            name="hasExpiry"
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  field.value ? "bg-[#7dc0ff]" : "bg-[var(--card-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    field.value ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            )}
          />
        </div>

        <AnimatePresence>
          {hasExpiry && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-4 overflow-hidden"
            >
              <Controller
                control={control}
                name="expiryDate"
                render={({ field }) => (
                  <DatePicker
                    label={t("expiryDate")}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.expiryDate?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="bestBeforeDate"
                render={({ field }) => (
                  <DatePicker
                    label={t("bestBeforeDate")}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hashtags */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[var(--foreground)]">
            {t("hashTags")}
          </label>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder={t("hashTagsPlaceholder")}
            className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20 transition-colors"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#7dc0ff]/10 text-[#7dc0ff] rounded-full text-xs font-medium"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() =>
                      setValue("hashTags", tags.filter((t) => t !== tag))
                    }
                    className="ml-0.5 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" loading={saving} fullWidth size="lg">
          {isEdit ? t("saveChanges") : t("addItem")}
        </Button>
      </form>
    </Modal>
  );
}
