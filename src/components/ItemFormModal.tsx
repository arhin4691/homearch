"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, MapPin, Loader2, ScanLine, ImagePlus, CheckCircle2, AlertTriangle } from "lucide-react";
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

type AddStep = "choose" | "barcode-scan" | "barcode-load" | "barcode-photo" | "form";

function toDateInput(date?: string) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

/** Map Open Food Facts category tags to our ITEM_CATEGORIES */
function mapOffCategory(tags: string[]): string {
  const joined = tags.join(" ").toLowerCase();
  if (/beverage|drink|juice|water|soda|tea|coffee|milk|yogurt|smoothie/.test(joined)) return "Drinks";
  if (/food|snack|meal|cereal|bread|meat|fish|fruit|vegetable|dairy|cheese|chocolate|candy|sweet|condiment|sauce|spice|herb|nut|seed|grain|legume|pasta|rice|biscuit|pastry/.test(joined)) return "Food";
  if (/medicine|drug|supplement|vitamin|pharmacy|capsule|tablet/.test(joined)) return "Medicine";
  if (/electronic|battery|device|computer|phone/.test(joined)) return "Electronics";
  if (/beauty|cosmetic|shampoo|soap|perfume|skincare|makeup|personal-care|toothpaste/.test(joined)) return "Beauty";
  if (/household|cleaning|detergent|laundry|kitchen|toilet|bathroom/.test(joined)) return "Household";
  if (/cloth|apparel|wear|shirt|pants|shoe/.test(joined)) return "Clothing";
  return "Other";
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

  // ── Barcode / step state ─────────────────────────────────────────────────
  const [addStep, setAddStep] = useState<AddStep>(isEdit ? "form" : "choose");
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
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

  const analyzeImage = useCallback(async (url: string) => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const { name, category, hashTags } = json.data;
        if (name) setValue("name", name);
        if (category) setValue("category", category);
        if (Array.isArray(hashTags) && hashTags.length > 0) setValue("hashTags", hashTags);
      } else {
        showToast(t("aiBypassedToast"), "info");
      }
    } catch {
      showToast(t("aiBypassedToast"), "info");
    } finally {
      setAiLoading(false);
    }
  }, [setValue, showToast, t]);

  // ── 3-step barcode lookup ─────────────────────────────────────────────────
  const handleBarcodeScanned = useCallback(
    async (barcode: string) => {
      setScannedBarcode(barcode);
      setAddStep("barcode-load");

      // Step 0 — already in this family's inventory? Treat the scan as a
      // restock: bump the existing item's quantity and save immediately,
      // no manual form needed.
      try {
        const ownRes = await fetch(
          `/api/items?barcode=${encodeURIComponent(barcode)}&paginate=false`,
        );
        if (ownRes.ok) {
          const ownJson = await ownRes.json();
          const existing = ownJson.data?.items?.[0];
          if (existing) {
            const newQuantity = (existing.quantity ?? 1) + 1;
            const bumpRes = await fetch(`/api/items/${existing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ quantity: newQuantity }),
            });
            if (bumpRes.ok) {
              showToast(t("restockedExisting", { name: existing.name }), "success");
              onClose();
              onSuccess?.({ ...existing, quantity: newQuantity });
              return;
            }
          }
        }
      } catch {
        /* fall through to dictionary/OFF lookup */
      }

      // Step 1 — internal ProductDictionary
      try {
        const res = await fetch(`/api/dictionary?barcode=${encodeURIComponent(barcode)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const { name, category, hashTags, imageUrl } = json.data;
            if (name) setValue("name", name);
            if (category) setValue("category", category);
            if (Array.isArray(hashTags) && hashTags.length > 0) setValue("hashTags", hashTags);
            if (imageUrl) setValue("imageUrl", imageUrl);
            setAddStep("form");
            showToast(t("foundInLibrary"), "success");
            return;
          }
        }
      } catch {
        /* fall through to Step 2 */
      }

      // Step 2 — Open Food Facts HK
      try {
        const offRes = await fetch(
          `https://hk.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
        );
        if (offRes.ok) {
          const ct = offRes.headers.get("content-type") ?? "";
          if (ct.includes("json")) {
            const offData = await offRes.json();
            if (offData.status === 1 && offData.product) {
              const p = offData.product;
              const name: string = p.product_name_zh ?? p.product_name_hk ?? p.product_name ?? "";
              const imageUrl: string = p.image_front_url ?? p.image_url ?? "";
              const keywords: string[] = (p._keywords ?? []).slice(0, 5);
              const category = mapOffCategory(p.categories_tags ?? []);
              if (name) setValue("name", name);
              setValue("category", category);
              if (keywords.length > 0) setValue("hashTags", keywords);
              if (imageUrl) setValue("imageUrl", imageUrl);
              setAddStep("form");
              showToast(t("foundOnline"), "success");
              return;
            }
          }
        }
      } catch {
        /* fall through to Step 3 */
      }

      // Step 3 — AI Vision fallback
      setAddStep("barcode-photo");
    },
    [setValue, showToast, t, onClose, onSuccess],
  );

  const handleBarcodePhotoUpload = useCallback(
    async (url: string, fileId: string) => {
      setValue("imageUrl", url);
      setValue("imageFileId", fileId);
      await analyzeImage(url);
      setAddStep("form");
    },
    [analyzeImage, setValue],
  );

  // Load locations when modal opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/locations?limit=9999")
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

  // Reset step + form when modal opens or closes
  useEffect(() => {
    if (open) {
      setAddStep(isEdit ? "form" : "choose");
      setScannedBarcode(null);
    } else {
      reset({ hasExpiry: true, hashTags: [], category: "Other", quantity: 1 });
      setTagInput("");
      setLocationSearch("");
      setScannedBarcode(null);
    }
  }, [open, isEdit, reset]);

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
        barcode: scannedBarcode || undefined,
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

  // ── Lazy-loaded BarcodeScanner (SSR-safe) ────────────────────────────────
  const [ScannerComponent, setScannerComponent] = useState<React.ComponentType<{
    onScan: (c: string) => void;
    onError?: (e: string) => void;
  }> | null>(null);

  useEffect(() => {
    if (addStep === "barcode-scan" && !ScannerComponent) {
      import("@/components/ui/BarcodeScanner").then((m) =>
        setScannerComponent(() => m.BarcodeScanner),
      );
    }
  }, [addStep, ScannerComponent]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t("editItem") : t("addItem")}
      size="lg"
    >
      {/* ── Step: choose ── */}
      {!isEdit && addStep === "choose" && (
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-[var(--muted)] text-center">{t("howToAdd")}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAddStep("barcode-scan")}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-[var(--card-border)] hover:border-[#7dc0ff] bg-[var(--card)] transition-all hover:bg-[#7dc0ff]/5 group"
            >
              <div className="p-3 rounded-xl bg-[#7dc0ff]/10 group-hover:bg-[#7dc0ff]/20 transition-colors">
                <ScanLine className="h-7 w-7 text-[#7dc0ff]" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">{t("scanBarcode")}</span>
            </button>
            <button
              type="button"
              onClick={() => setAddStep("form")}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-[var(--card-border)] hover:border-[#7dc0ff] bg-[var(--card)] transition-all hover:bg-[#7dc0ff]/5 group"
            >
              <div className="p-3 rounded-xl bg-[#7dc0ff]/10 group-hover:bg-[#7dc0ff]/20 transition-colors">
                <ImagePlus className="h-7 w-7 text-[#7dc0ff]" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">{t("uploadPhoto")}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Step: barcode-scan ── */}
      {!isEdit && addStep === "barcode-scan" && (
        <div className="flex flex-col gap-4">
          {ScannerComponent ? (
            <ScannerComponent
              onScan={handleBarcodeScanned}
              onError={(err) => showToast(t("scannerError") + ": " + err, "error")}
            />
          ) : (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-[#7dc0ff] animate-spin" />
            </div>
          )}
          <Button type="button" variant="ghost" fullWidth onClick={() => setAddStep("choose")}>
            {t("cancel")}
          </Button>
        </div>
      )}

      {/* ── Step: barcode-load ── */}
      {!isEdit && addStep === "barcode-load" && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="h-8 w-8 text-[#7dc0ff] animate-spin" />
          <p className="text-sm font-medium text-[var(--foreground)]">{t("lookingUp")}</p>
          {scannedBarcode && <p className="text-xs text-[var(--muted)]">{scannedBarcode}</p>}
        </div>
      )}

      {/* ── Step: barcode-photo (Step-3 AI fallback) ── */}
      {!isEdit && addStep === "barcode-photo" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-400/40 bg-amber-400/10">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--foreground)]">{t("notFoundAnywhere")}</p>
          </div>
          <AnimatePresence>
            {aiLoading && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#7dc0ff]/40 bg-[#7dc0ff]/10"
              >
                <Loader2 className="h-4 w-4 text-[#7dc0ff] animate-spin flex-shrink-0" />
                <span className="text-sm font-medium text-[#7dc0ff]">{t("aiAnalyzing")}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUpload
                label={t("takeProductPhoto")}
                value={field.value}
                folder="/homearch/items"
                cropToSquare
                onChange={(url, fileId) => handleBarcodePhotoUpload(url, fileId)}
                onClear={() => {
                  field.onChange(undefined);
                  setValue("imageFileId", undefined);
                }}
              />
            )}
          />
          <Button type="button" variant="ghost" fullWidth onClick={() => setAddStep("form")}>
            {t("skipToManual")}
          </Button>
        </div>
      )}

      {/* ── Step: form ── */}
      {(isEdit || addStep === "form") && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Barcode badge */}
          {scannedBarcode && !isEdit && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#7dc0ff]/40 bg-[#7dc0ff]/10">
              <CheckCircle2 className="h-4 w-4 text-[#7dc0ff] flex-shrink-0" />
              <span className="text-xs text-[#7dc0ff] font-medium">
                {t("barcodeScanned", { barcode: scannedBarcode })}
              </span>
              <button
                type="button"
                onClick={() => setAddStep("barcode-scan")}
                className="ml-auto text-xs text-[var(--muted)] hover:text-[#7dc0ff] transition-colors"
              >
                {t("scanAnother")}
              </button>
            </div>
          )}

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
                  analyzeImage(url);
                }}
                onClear={() => {
                  field.onChange(undefined);
                  setValue("imageFileId", undefined);
                }}
              />
            )}
          />

          {/* AI Loading Banner */}
          <AnimatePresence>
            {aiLoading && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#7dc0ff]/40 bg-[#7dc0ff]/10"
              >
                <Loader2 className="h-4 w-4 text-[#7dc0ff] animate-spin flex-shrink-0" />
                <span className="text-sm font-medium text-[#7dc0ff]">{t("aiAnalyzing")}</span>
              </motion.div>
            )}
          </AnimatePresence>

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
                      <p className="text-xs text-[var(--muted)] px-4 py-3">{t("noLocation")}</p>
                    )}
                    {filteredLocations.length === 0 && locationSearch.trim() && (
                      <p className="text-xs text-[var(--muted)] px-4 py-2">No match found</p>
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
                        (l) => l.name.toLowerCase() === locationSearch.trim().toLowerCase(),
                      ) && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={createLocationFromSearch}
                          disabled={creatingLocation}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#7dc0ff] hover:bg-[#7dc0ff]/5 transition-colors border-t border-[var(--card-border)] disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                          {creatingLocation ? "Creating…" : `Create "${locationSearch.trim()}"`}
                        </button>
                      )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Expiry toggle */}
          <div className="flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
            <label className="text-sm font-medium text-[var(--foreground)]">{t("hasExpiry")}</label>
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
            <label className="text-sm font-medium text-[var(--foreground)]">{t("hashTags")}</label>
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
                      onClick={() => setValue("hashTags", tags.filter((t) => t !== tag))}
                      className="ml-0.5 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button
            type="submit"
            loading={saving}
            disabled={saving || aiLoading}
            fullWidth
            size="lg"
          >
            {isEdit ? t("saveChanges") : t("addItem")}
          </Button>
        </form>
      )}
    </Modal>
  );
}

