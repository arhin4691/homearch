"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({ familyCode: z.string().min(1, "Code required") });

export default function JoinFamilyPage() {
  const t = useTranslations("joinFamily");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { refreshUser } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { familyCode: "" } });

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) setValue("familyCode", code);
  }, [searchParams, setValue]);

  const onSubmit = async (data: { familyCode: string }) => {
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(t("requestSent"), "success");
      router.push("/");
    } catch (e: any) {
      showToast(e.message ?? "Failed to send request", "error");
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-[var(--card)] border border-[var(--card-border)]">
          <ArrowLeft className="h-4 w-4 text-[var(--foreground)]" />
        </button>
        <h1 className="text-xl font-bold text-[var(--foreground)]">{t("title")}</h1>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-[#7dc0ff]/10 flex items-center justify-center">
          <Users className="h-10 w-10 text-[#7dc0ff]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("subtitle")}</h2>
          <p className="text-sm text-[var(--muted)] mt-1">{t("description")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-8">
        <Input
          label={t("codeLabel")}
          placeholder="XXXX-XXXX"
          error={errors.familyCode?.message}
          {...register("familyCode")}
        />
        <Button type="submit" loading={isSubmitting} fullWidth size="lg">
          {t("sendRequest")}
        </Button>
      </form>
    </AppShell>
  );
}
