"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { User, Lock, Palette, Globe, Users, Key, Plus, Trash2, Copy, LogOut, QrCode, Fingerprint } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useToast } from "@/components/ui/Toast";

// --- Profile form ---
const profileSchema = z.object({ name: z.string().min(2) });
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { user, loading, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarFileId, setAvatarFileId] = useState<string | undefined>(undefined);
  const [family, setFamily] = useState<any | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [locale, setLocale] = useState("en");
  const [saving, setSaving] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "" },
  });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    profileForm.reset({ name: user.name });
    setAvatarUrl(user.avatarUrl);
    // Read locale from cookie
    const localeCookie = document.cookie.split(";").find((c) => c.trim().startsWith("locale="));
    if (localeCookie) setLocale(localeCookie.split("=")[1].trim());

    if (user.familyId) {
      fetch("/api/family").then((r) => r.json()).then((d) => setFamily(d.data));
      fetch("/api/api-keys").then((r) => r.json()).then((d) => setApiKeys(d.data ?? []));
    }
  }, [user]);

  const saveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      const payload: any = { name: data.name };
      if (avatarUrl) payload.avatarUrl = avatarUrl;
      if (avatarFileId) payload.avatarFileId = avatarFileId;
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      showToast("Profile updated", "success");
      refreshUser();
    } catch {
      showToast("Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (data: PasswordForm) => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Password changed", "success");
      passwordForm.reset();
    } catch (e: any) {
      showToast(e.message ?? "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const changeLocale = (newLocale: string) => {
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
    setLocale(newLocale);
    window.location.reload();
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    const json = await res.json();
    if (res.ok) {
      setNewApiKey(json.data.key);
      setApiKeys((prev) => [...prev, { id: json.data.id, name: newKeyName }]);
      setNewKeyName("");
    }
  };

  const deleteApiKey = async (id: string) => {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied!", "success");
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-[var(--foreground)] mb-6">{t("title")}</h1>

      <div className="flex flex-col gap-4">
        {/* Profile */}
        <Section icon={<User className="h-4 w-4 text-[#7dc0ff]" />} title={t("profile")}>
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="flex flex-col gap-4">
            <ImageUpload
              value={avatarUrl}
              folder="/homearch/avatars"
              onChange={(url, fid) => { setAvatarUrl(url); setAvatarFileId(fid); }}
              onClear={() => { setAvatarUrl(undefined); setAvatarFileId(undefined); }}
              label="Avatar"
            />
            <Input label={t("name")} error={profileForm.formState.errors.name?.message} {...profileForm.register("name")} />
            <Input label="Email" value={user?.email ?? ""} disabled />
            <Input label="User Code" value={user?.userCode ?? ""} readOnly />
            <Button type="submit" loading={saving} size="sm">{t("save")}</Button>
          </form>
        </Section>

        {/* Password */}
        <Section icon={<Lock className="h-4 w-4 text-purple-500" />} title={t("changePassword")}>
          <form onSubmit={passwordForm.handleSubmit(savePassword)} className="flex flex-col gap-4">
            <Input label={t("currentPassword")} type="password" error={passwordForm.formState.errors.currentPassword?.message} {...passwordForm.register("currentPassword")} />
            <Input label={t("newPassword")} type="password" error={passwordForm.formState.errors.newPassword?.message} {...passwordForm.register("newPassword")} />
            <Button type="submit" loading={saving} size="sm">{t("save")}</Button>
          </form>
        </Section>

        {/* Theme */}
        <Section icon={<Palette className="h-4 w-4 text-orange-500" />} title={t("theme")}>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setTheme(opt)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                  theme === opt
                    ? "bg-[#7dc0ff] text-white border-[#7dc0ff]"
                    : "bg-[var(--card)] text-[var(--foreground)] border-[var(--card-border)]"
                }`}
              >
                {t(opt as any)}
              </button>
            ))}
          </div>
        </Section>

        {/* Language */}
        <Section icon={<Globe className="h-4 w-4 text-green-500" />} title={t("language")}>
          <div className="flex gap-2">
            {[{ code: "en", label: "English" }, { code: "zh-HK", label: "繁體中文" }].map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLocale(lang.code)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  locale === lang.code
                    ? "bg-[#7dc0ff] text-white border-[#7dc0ff]"
                    : "bg-[var(--card)] text-[var(--foreground)] border-[var(--card-border)]"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Family */}
        <Section icon={<Users className="h-4 w-4 text-blue-400" />} title={t("family")}>
          {user?.familyId && family ? (
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-[var(--background)] rounded-xl">
                <p className="text-xs text-[var(--muted)]">{t("familyName")}</p>
                <p className="font-semibold text-[var(--foreground)]">{family.name}</p>
              </div>
              <div className="p-3 bg-[var(--background)] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--muted)]">{t("familyCode")}</p>
                  <p className="font-mono font-semibold text-[var(--foreground)]">{family.familyCode}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyToClipboard(family.familyCode)} className="p-2 rounded-lg hover:bg-[var(--card)]">
                    <Copy className="h-4 w-4 text-[var(--muted)]" />
                  </button>
                  <button onClick={() => setShowQr(true)} className="p-2 rounded-lg hover:bg-[var(--card)]">
                    <QrCode className="h-4 w-4 text-[var(--muted)]" />
                  </button>
                </div>
              </div>
              <div className="p-3 bg-[var(--background)] rounded-xl">
                <p className="text-xs text-[var(--muted)] mb-2">Members ({family.members?.length ?? 0})</p>
                {(family.members ?? []).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="w-7 h-7 rounded-full bg-[#7dc0ff]/20 flex items-center justify-center text-xs font-bold text-[#7dc0ff]">
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-[var(--foreground)]">{m.name}</span>
                    {m.id === family.ownerId && (
                      <span className="text-xs text-[#7dc0ff] ml-1">Owner</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button onClick={() => router.push("/join-family")} variant="outline" size="sm" fullWidth>
                {t("joinFamily")}
              </Button>
              <CreateFamilyForm onCreated={(f) => setFamily(f)} />
            </div>
          )}
        </Section>

        {/* API Keys — owner only */}
        {family?.ownerId === user?.id && (
          <Section icon={<Key className="h-4 w-4 text-yellow-500" />} title={t("apiKeys")}>
            <div className="flex flex-col gap-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-xl">
                  <span className="text-sm font-medium text-[var(--foreground)]">{key.name}</span>
                  <button onClick={() => deleteApiKey(key.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowCreateKey(true)}
                className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-[var(--card-border)] text-[var(--muted)] text-sm hover:border-[#7dc0ff] hover:text-[#7dc0ff] transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t("createApiKey")}
              </button>
            </div>
          </Section>
        )}

        {/* Logout */}
        <BiometricSection />
        <button
          onClick={async () => { await logout(); router.replace("/login"); }}
          className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-500 font-medium"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>

      {/* QR Modal */}
      <Modal open={showQr} onClose={() => setShowQr(false)} title="Family QR Code">
        <div className="flex flex-col items-center gap-4 py-4">
          {family?.familyCode && (
            <div className="p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join-family?code=${family.familyCode}`}
                size={200}
              />
            </div>
          )}
          <p className="text-sm text-[var(--muted)] text-center">Share this QR code to invite family members</p>
        </div>
      </Modal>

      {/* Create API Key Modal */}
      <Modal
        open={showCreateKey}
        onClose={() => { setShowCreateKey(false); setNewApiKey(""); setNewKeyName(""); }}
        title="Create API Key"
        footer={
          newApiKey ? (
            <Button onClick={() => { setShowCreateKey(false); setNewApiKey(""); }} fullWidth>Done</Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowCreateKey(false)} fullWidth>Cancel</Button>
              <Button onClick={createApiKey} fullWidth>Create</Button>
            </div>
          )
        }
      >
        {newApiKey ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--muted)]">Copy this key — it won't be shown again:</p>
            <div className="flex items-center gap-2 p-3 bg-[var(--background)] rounded-xl">
              <code className="text-xs font-mono text-[var(--foreground)] flex-1 break-all">{newApiKey}</code>
              <button onClick={() => copyToClipboard(newApiKey)}>
                <Copy className="h-4 w-4 text-[var(--muted)]" />
              </button>
            </div>
          </div>
        ) : (
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. Home Assistant"
          />
        )}
      </Modal>
    </AppShell>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function BiometricSection() {
  const [available, setAvailable] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(setAvailable);
    }
    setEnrolled(localStorage.getItem("biometric_enrolled") === "true");
  }, []);

  if (!available) return null;

  const enroll = async () => {
    setLoading(true);
    try {
      const beginRes = await fetch("/api/auth/passkey/register-begin", { method: "POST" });
      if (!beginRes.ok) throw new Error("Failed to start");
      const { data: options } = await beginRes.json();
      const { startRegistration } = await import("@simplewebauthn/browser");
      const credential = await startRegistration({ optionsJSON: options });
      const finishRes = await fetch("/api/auth/passkey/register-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!finishRes.ok) throw new Error("Registration failed");
      localStorage.setItem("biometric_enrolled", "true");
      setEnrolled(true);
    } catch (e: any) {
      if (e.name !== "NotAllowedError") console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const revoke = () => {
    localStorage.removeItem("biometric_enrolled");
    setEnrolled(false);
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="h-4 w-4 text-[#7dc0ff]" />
        <h2 className="font-semibold text-[var(--foreground)]">Face ID / Touch ID</h2>
      </div>
      <p className="text-sm text-[var(--muted)] mb-3">
        {enrolled ? "Biometric login is enabled for this device." : "Enable biometric login for faster sign-in."}
      </p>
      {enrolled ? (
        <button
          onClick={revoke}
          className="text-sm text-red-500 font-medium hover:underline"
        >
          Remove this device
        </button>
      ) : (
        <button
          onClick={enroll}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-[#7dc0ff] font-medium hover:underline disabled:opacity-60"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            <Fingerprint className="h-3.5 w-3.5" />
          )}
          Enable Biometric Login
        </button>
      )}
    </div>
  );
}

function CreateFamilyForm({ onCreated }: { onCreated: (f: any) => void }) {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onCreated(json.data);
      refreshUser();
      showToast("Family created!", "success");
    } catch (e: any) {
      showToast(e.message ?? "Failed", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Family name"
        className="flex-1 bg-[var(--background)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#7dc0ff]"
      />
      <Button onClick={create} loading={creating} size="sm">Create</Button>
    </div>
  );
}
