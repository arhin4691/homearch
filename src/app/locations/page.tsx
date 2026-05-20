"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useToast } from "@/components/ui/Toast";

interface Location {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  itemCount?: number;
}

export default function LocationsPage() {
  const t = useTranslations("locations");
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showToast } = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    imageFileId: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchLocations = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const res = await fetch("/api/locations");
      if (res.ok) setLocations((await res.json()).data);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const openEdit = (loc: Location) => {
    setForm({
      name: loc.name,
      description: loc.description ?? "",
      imageUrl: loc.imageUrl ?? "",
      imageFileId: "",
    });
    setEditTarget(loc);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const method = editTarget ? "PATCH" : "POST";
      const url = editTarget
        ? `/api/locations/${editTarget.id}`
        : "/api/locations";
      const payload: any = { name: form.name, description: form.description };
      if (form.imageUrl) payload.imageUrl = form.imageUrl;
      if (form.imageFileId) payload.imageFileId = form.imageFileId;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      showToast(
        editTarget ? "Location updated" : "Location created",
        "success",
      );
      setShowCreate(false);
      setEditTarget(null);
      fetchLocations();
    } catch {
      showToast("Failed to save location", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteLocation = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await fetch(`/api/locations/${deleteTarget.id}`, { method: "DELETE" });
      showToast("Location deleted", "success");
      setDeleteTarget(null);
      fetchLocations();
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const isOpen = showCreate || !!editTarget;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          {t("title")}
        </h1>
        {user?.familyId && (
          <button
            onClick={() => {
              setForm({
                name: "",
                description: "",
                imageUrl: "",
                imageFileId: "",
              });
              setShowCreate(true);
            }}
            className="p-2.5 rounded-xl bg-[#7dc0ff] text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {fetching ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="text-5xl">🗂️</div>
          <p className="text-[var(--muted)] text-sm">{t("noLocations")}</p>
          {user?.familyId && (
            <Button
              onClick={() => setShowCreate(true)}
              variant="outline"
              size="sm"
            >
              {t("addFirst")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {locations.map((loc) => (
            <motion.div
              key={loc.id}
              whileTap={{ scale: 0.96 }}
              className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden cursor-pointer hover:border-[#7dc0ff]/50 hover:shadow-md hover:shadow-[#7dc0ff]/10 transition-all"
              onClick={() => router.push(`/locations/${loc.id}`)}
            >
              <div className="relative w-full aspect-square bg-[var(--card-border)]">
                {loc.imageUrl ? (
                  <Image src={loc.imageUrl} alt={loc.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">📍</div>
                )}
                {/* Edit/Delete buttons */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(loc); }}
                    className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full"
                  >
                    <Edit className="h-3.5 w-3.5 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(loc); }}
                    className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
                {loc.itemCount !== undefined && loc.itemCount > 0 && (
                  <div className="absolute bottom-2 left-2">
                    <span className="text-xs bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-full font-medium">
                      {loc.itemCount} {loc.itemCount === 1 ? "item" : "items"}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-[var(--foreground)] truncate text-sm">{loc.name}</p>
                {loc.description && (
                  <p className="text-xs text-[var(--muted)] truncate mt-0.5">{loc.description}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={isOpen}
        onClose={() => {
          setShowCreate(false);
          setEditTarget(null);
        }}
        title={editTarget ? t("editLocation") : t("addLocation")}
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                setEditTarget(null);
              }}
              fullWidth
            >
              Cancel
            </Button>
            <Button onClick={save} loading={saving} fullWidth>
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <ImageUpload
            value={form.imageUrl}
            folder="/homearch/locations"
            onChange={(url, fileId) =>
              setForm((p) => ({ ...p, imageUrl: url, imageFileId: fileId }))
            }
            onClear={() =>
              setForm((p) => ({ ...p, imageUrl: "", imageFileId: "" }))
            }
          />
          <Input
            label={t("name")}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Kitchen, Bedroom"
          />
          <Input
            label={t("description")}
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Optional description"
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Location"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deleteLocation}
              loading={saving}
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
