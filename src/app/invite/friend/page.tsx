"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";

type State = "loading" | "sending" | "sent" | "already" | "error" | "not_found" | "unauthenticated";

export default function InviteFriendPage() {
  const t = useTranslations("invite");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const code = searchParams.get("code") ?? "";
  const [state, setState] = useState<State>("loading");
  const [targetName, setTargetName] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Save invite URL and redirect to login
      sessionStorage.setItem("afterLogin", window.location.href);
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!code) {
      setState("error");
      return;
    }
    sendRequest();
  }, [loading, user, code]);

  const sendRequest = async () => {
    setState("sending");
    try {
      // First look up the target user
      const searchRes = await fetch(`/api/friends/search?code=${encodeURIComponent(code)}`);
      if (searchRes.status === 404) { setState("not_found"); return; }
      if (!searchRes.ok) { setState("error"); return; }
      const searchJson = await searchRes.json();
      setTargetName(searchJson.data.name ?? code);

      // Send friend request
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: code }),
      });

      if (res.status === 409) { setState("already"); return; }
      if (!res.ok) { setState("error"); return; }
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
        {(state === "loading" || state === "sending") && (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-[#7dc0ff] border-t-transparent animate-spin" />
            <p className="text-[var(--muted)]">{t("processing")}</p>
          </>
        )}

        {state === "sent" && (
          <>
            <CheckCircle2 className="w-14 h-14 text-[#7dc0ff]" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">{t("requestSent")}</h2>
            <p className="text-sm text-[var(--muted)]">{t("requestSentDesc", { name: targetName })}</p>
            <Button onClick={() => router.push("/friends")} fullWidth>{t("viewFriends")}</Button>
          </>
        )}

        {state === "already" && (
          <>
            <UserPlus className="w-14 h-14 text-[#7dc0ff]" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">{t("alreadyConnected")}</h2>
            <p className="text-sm text-[var(--muted)]">{t("alreadyConnectedDesc")}</p>
            <Button onClick={() => router.push("/friends")} fullWidth>{t("viewFriends")}</Button>
          </>
        )}

        {state === "not_found" && (
          <>
            <XCircle className="w-14 h-14 text-red-400" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">{t("notFound")}</h2>
            <p className="text-sm text-[var(--muted)]">{t("notFoundDesc")}</p>
            <Button onClick={() => router.push("/")} variant="secondary" fullWidth>{t("goHome")}</Button>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="w-14 h-14 text-red-400" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">{t("error")}</h2>
            <p className="text-sm text-[var(--muted)]">{t("errorDesc")}</p>
            <Button onClick={sendRequest} fullWidth>{t("retry")}</Button>
            <Button onClick={() => router.push("/")} variant="secondary" fullWidth>{t("goHome")}</Button>
          </>
        )}
      </div>
    </div>
  );
}
