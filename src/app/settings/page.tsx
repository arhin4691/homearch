"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { User, Lock, Palette, Globe, Users, Key, Plus, Trash2, Copy, LogOut, QrCode, Fingerprint, UserPlus, Camera, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarFileId, setAvatarFileId] = useState<string | undefined>(undefined);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [family, setFamily] = useState<any | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [showMyQr, setShowMyQr] = useState(false);
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
      showToast(t("profileUpdated"), "success");
      refreshUser();
    } catch {
      showToast(t("profileFailed"), "error");
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
      showToast(t("passwordChanged"), "success");
      passwordForm.reset();
      setShowPasswordModal(false);
    } catch (e: any) {
      showToast(e.message ?? t("passwordFailed"), "error");
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

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    try {
      const authRes = await fetch("/api/imagekit/auth");
      const auth = await authRes.json();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);
      formData.append("folder", "/homearch/avatars");
      formData.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!);
      formData.append("signature", auth.data.signature);
      formData.append("expire", auth.data.expire.toString());
      formData.append("token", auth.data.token);
      const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const result = await uploadRes.json();
      setAvatarUrl(result.url);
      setAvatarFileId(result.fileId);
    } catch {
      showToast("Image upload failed", "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(t("copied"), "success");
  };

  return (
    <AppShell>
      <h1 className="mt-2 text-4xl font-bold text-[var(--foreground)] mb-6">{t("title")}</h1>

      <div className="flex flex-col gap-4">
        {/* Profile */}
        <Section icon={<User className="h-4 w-4 text-[#7dc0ff]" />} title={t("profile")}>
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="flex flex-col gap-4">
            {/* Circle Avatar — click to upload */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                className="relative w-50 h-50 rounded-full overflow-hidden border-2 border-[#7dc0ff]/40 bg-[#7dc0ff]/10 flex items-center justify-center group cursor-pointer"
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={user?.name ?? ""} fill className="object-cover"/>
                ) : (
                  <span className="text-3xl font-bold text-[#7dc0ff]">
                    {user?.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
                {/* Hover/loading overlay */}
                <div className={`absolute inset-0 bg-black/40 rounded-full flex items-center justify-center transition-opacity ${avatarUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  {avatarUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>
              <p className="text-xs text-[var(--muted)]">{t("changeAvatar")}</p>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
              />
            </div>
            <Input label={t("name")} error={profileForm.formState.errors.name?.message} {...profileForm.register("name")} />
            <Input label={t("email")} value={user?.email ?? ""} disabled />
            <Input label={t("userCode")} value={user?.userCode ?? ""} readOnly />
            <Button type="submit" loading={saving} size="sm">{t("save")}</Button>
          </form>

          {/* Change Password trigger */}
          <div className="mt-3 pt-3 border-t border-[var(--card-border)]">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 text-sm text-[#7dc0ff] font-medium hover:underline"
            >
              <Lock className="h-3.5 w-3.5" />
              {t("changePasswordBtn")}
            </button>
          </div>
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

        {/* Friends */}
        <Section icon={<UserPlus className="h-4 w-4 text-pink-400" />} title={t("friends")}>
          <div className="flex flex-col gap-3">
            {user?.userCode && (
              <div className="p-3 bg-[var(--background)] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--muted)]">{t("userCode")}</p>
                  <p className="font-mono font-semibold text-[var(--foreground)]">{user.userCode}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyToClipboard(user.userCode!)} className="p-2 rounded-lg hover:bg-[var(--card)]">
                    <Copy className="h-4 w-4 text-[var(--muted)]" />
                  </button>
                  <button onClick={() => setShowMyQr(true)} className="p-2 rounded-lg hover:bg-[var(--card)]">
                    <QrCode className="h-4 w-4 text-[var(--muted)]" />
                  </button>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => router.push("/friends")}
            >
              {t("friendList")}
            </Button>
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
                <p className="text-xs text-[var(--muted)] mb-2">{t("membersCount", { count: family.members?.length ?? 0 })}</p>
                {(family.members ?? []).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-[#7dc0ff]/20 flex items-center justify-center text-xs font-bold text-[#7dc0ff] flex-shrink-0">
                      {m.avatarUrl ? (
                        <Image src={m.avatarUrl} alt={m.name} width={28} height={28} className="object-cover w-full h-full" />
                      ) : (
                        m.name?.[0]?.toUpperCase()
                      )}
                    </div>
                    <span className="text-sm text-[var(--foreground)]">{m.name}</span>
                    {m.id === family.ownerId && (
                      <span className="text-xs text-[#7dc0ff] ml-1">{t("owner")}</span>
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

        {/* API Keys ??owner only */}
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

        {/* Biometric */}
        <BiometricSection />

        {/* Logout */}
        <button
          onClick={async () => { await logout(); router.replace("/login"); }}
          className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-500 font-medium"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>

      {/* Family QR Modal */}
      <Modal open={showQr} onClose={() => setShowQr(false)} title={t("familyQR")}>
        <div className="flex flex-col items-center gap-4 py-4">
          {family?.familyCode && (
            <div className="p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={`${appUrl}/join-family?code=${family.familyCode}`}
                size={200}
              />
            </div>
          )}
          <p className="text-sm text-[var(--muted)] text-center">{t("familyQRSubtitle")}</p>
        </div>
      </Modal>

      {/* My User QR Modal */}
      <Modal open={showMyQr} onClose={() => setShowMyQr(false)} title={t("myQR")}>
        <div className="flex flex-col items-center gap-4 py-4">
          {user?.userCode && (
            <div className="p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={`${appUrl}/invite/friend?code=${user.userCode}`}
                size={200}
              />
            </div>
          )}
          <p className="text-sm font-mono text-[var(--foreground)]">{user?.userCode}</p>
          <button
            onClick={() => copyToClipboard(`${appUrl}/invite/friend?code=${user?.userCode}`)}
            className="flex items-center gap-2 text-sm text-[#7dc0ff] font-medium"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("inviteLink")}
          </button>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); passwordForm.reset(); }}
        title={t("changePassword")}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowPasswordModal(false); passwordForm.reset(); }} fullWidth>
              {t("cancel")}
            </Button>
            <Button onClick={passwordForm.handleSubmit(savePassword)} loading={saving} fullWidth>
              {t("save")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("currentPassword")}
            type="password"
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register("currentPassword")}
          />
          <Input
            label={t("newPassword")}
            type="password"
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register("newPassword")}
          />
        </div>
      </Modal>

      {/* Create API Key Modal */}
      <Modal
        open={showCreateKey}
        onClose={() => { setShowCreateKey(false); setNewApiKey(""); setNewKeyName(""); }}
        title={t("newApiKey")}
        footer={
          newApiKey ? (
            <Button onClick={() => { setShowCreateKey(false); setNewApiKey(""); }} fullWidth>{t("done")}</Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowCreateKey(false)} fullWidth>{t("cancel")}</Button>
              <Button onClick={createApiKey} fullWidth>{t("create")}</Button>
            </div>
          )
        }
      >
        {newApiKey ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--muted)]">{t("apiKeyCopyNote")}</p>
            <div className="flex items-center gap-2 p-3 bg-[var(--background)] rounded-xl">
              <code className="text-xs font-mono text-[var(--foreground)] flex-1 break-all">{newApiKey}</code>
              <button onClick={() => copyToClipboard(newApiKey)}>
                <Copy className="h-4 w-4 text-[var(--muted)]" />
              </button>
            </div>
          </div>
        ) : (
          <Input
            label={t("apiKeyName")}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t("apiKeyNamePlaceholder")}
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
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const [available, setAvailable] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check platform authenticator availability
    if (
      typeof window !== "undefined" &&
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setAvailable)
        .catch(() => setAvailable(false));
    }
    setEnrolled(localStorage.getItem("biometric_enrolled") === "true");
  }, []);

  // Only render on HTTPS or localhost (WebAuthn requirement)
  const isSecureContext = typeof window !== "undefined" && window.isSecureContext;
  if (!available || !isSecureContext) return null;

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
      showToast(t("biometricEnrolled"), "success");
    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        showToast(t("biometricFailed"), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const revoke = () => {
    localStorage.removeItem("biometric_enrolled");
    setEnrolled(false);
    showToast(t("biometricRemoved"), "success");
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="h-4 w-4 text-[#7dc0ff]" />
        <h2 className="font-semibold text-[var(--foreground)]">Face ID / Touch ID</h2>
      </div>
      {enrolled ? (
        <button
          onClick={revoke}
          className="text-sm text-red-500 font-medium hover:underline"
        >
          {t("disableBiometric")}
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
          {t("enableBiometric")}
        </button>
      )}
    </div>
  );
}

function CreateFamilyForm({ onCreated }: { onCreated: (f: any) => void }) {
  const t = useTranslations("settings");
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
      <Button onClick={create} loading={creating} size="sm">{t("create")}</Button>
    </div>
  );
}

