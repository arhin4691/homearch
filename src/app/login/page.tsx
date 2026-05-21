"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, AtSign, Lock, Home, Fingerprint, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import Image from "next/image";

const schema = z.object({
  emailOrUsername: z.string().min(1, "Email or username required"),
  password: z.string().min(1, "Password required"),
  rememberMe: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { login, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [showBiometricEnroll, setShowBiometricEnroll] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: true },
  });

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(
        setBiometricAvailable,
      );
    }
    setBiometricEnrolled(localStorage.getItem("biometric_enrolled") === "true");
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await login(data.emailOrUsername, data.password, data.rememberMe);
      if (biometricAvailable && !biometricEnrolled) {
        setShowBiometricEnroll(true);
      } else {
        router.replace("/");
      }
    } catch (e: any) {
      showToast(e.message || t("invalidCredentials"), "error");
    } finally {
      setLoading(false);
    }
  };

  const loginWithBiometric = async () => {
    setBiometricLoading(true);
    try {
      const beginRes = await fetch("/api/auth/passkey/login-begin", {
        method: "POST",
      });
      if (!beginRes.ok) throw new Error("Failed to get challenge");
      const { data: options } = await beginRes.json();

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const credential = await startAuthentication({ optionsJSON: options });

      const finishRes = await fetch("/api/auth/passkey/login-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!finishRes.ok) {
        const err = await finishRes.json().catch(() => ({}));
        throw new Error(err.error || "Biometric login failed");
      }

      await refreshUser();
      router.replace("/");
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        showToast("Biometric cancelled", "error");
      } else {
        showToast(e.message || "Biometric login failed", "error");
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const enrollBiometric = async () => {
    setEnrollLoading(true);
    try {
      const beginRes = await fetch("/api/auth/passkey/register-begin", {
        method: "POST",
      });
      if (!beginRes.ok) throw new Error("Failed to start registration");
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
      setBiometricEnrolled(true);
      showToast("Face ID / Touch ID enabled!", "success");
    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        showToast(e.message || "Failed to enable biometric", "error");
      }
    } finally {
      setEnrollLoading(false);
      setShowBiometricEnroll(false);
      router.replace("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      {/* Biometric enroll prompt */}
      <AnimatePresence>
        {showBiometricEnroll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="bg-[var(--card)] rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setShowBiometricEnroll(false);
                  router.replace("/");
                }}
                className="absolute top-4 right-4 p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#7dc0ff]/10 flex items-center justify-center">
                  <Fingerprint className="h-8 w-8 text-[#7dc0ff]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                    Enable Face ID / Touch ID?
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    Sign in instantly next time using your device biometric.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    onClick={enrollBiometric}
                    loading={enrollLoading}
                    fullWidth
                  >
                    Enable Biometric Login
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowBiometricEnroll(false);
                      router.replace("/");
                    }}
                    fullWidth
                  >
                    Not now
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg mb-2 relative">
            <Image
              src="/icons/icon.png"
              alt="Homearch"
              width={100}
              height={100}
              className="absolute"
            />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {t("loginTitle")}
          </h1>
          <p className="text-sm text-[var(--muted)]">{t("loginSubtitle")}</p>
        </div>

        {/* Prominent biometric button when already enrolled */}
        {biometricAvailable && biometricEnrolled && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={loginWithBiometric}
            disabled={biometricLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-[#7dc0ff]/10 border border-[#7dc0ff]/30 text-[#7dc0ff] font-semibold mb-5 hover:bg-[#7dc0ff]/15 transition-colors disabled:opacity-60"
          >
            {biometricLoading ? (
              <div className="w-5 h-5 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Fingerprint className="h-5 w-5" />
            )}
            Sign in with Face ID / Touch ID
          </motion.button>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label={t("emailOrUsername")}
            type="text"
            placeholder="email@example.com or username"
            leftIcon={<AtSign className="h-4 w-4" />}
            error={errors.emailOrUsername?.message}
            autoComplete="username"
            {...register("emailOrUsername")}
          />
          <Input
            label={t("password")}
            type="password"
            placeholder="••••••••"
            leftIcon={<Lock className="h-4 w-4" />}
            error={errors.password?.message}
            autoComplete="current-password"
            {...register("password")}
          />

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-[#7dc0ff] cursor-pointer"
              {...register("rememberMe")}
            />
            <span className="text-sm text-[var(--muted)]">
              Keep me signed in for 30 days
            </span>
          </label>

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
            className="mt-1"
          >
            {t("login")}
          </Button>
        </form>

        {/* Subtle biometric option when available but not yet enrolled */}
        {biometricAvailable && !biometricEnrolled && (
          <button
            onClick={loginWithBiometric}
            disabled={biometricLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 mt-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-60"
          >
            <Fingerprint className="h-4 w-4" />
            Use Face ID / Touch ID
          </button>
        )}

        <p className="text-center text-sm text-[var(--muted)] mt-6">
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="text-[#7dc0ff] font-medium hover:underline"
          >
            {t("register")}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
