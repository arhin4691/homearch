"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { UserPlus, QrCode, Search, Check, X, UserMinus, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface FriendUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  userCode: string;
  email?: string;
}

interface PendingRequest {
  requestId: string;
  user: FriendUser;
}

export default function FriendsPage() {
  const t = useTranslations("friends");
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showToast } = useToast();

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<PendingRequest[]>([]);
  const [fetching, setFetching] = useState(true);

  const [searchCode, setSearchCode] = useState("");
  const [searchResult, setSearchResult] = useState<FriendUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  const [showScanner, setShowScanner] = useState(false);
  const [Scanner, setScanner] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const loadFriends = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/friends");
      const json = await res.json();
      if (res.ok) {
        setFriends(json.data.friends ?? []);
        setIncoming(json.data.incoming ?? []);
        setOutgoing(json.data.outgoing ?? []);
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (user) loadFriends(); }, [user, loadFriends]);

  const searchUser = async () => {
    const code = searchCode.trim().toUpperCase();
    if (!code) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/friends/search?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (res.ok) setSearchResult(json.data);
      else showToast(t("notFound"), "error");
    } catch {
      showToast(t("searchFailed"), "error");
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetCode: string) => {
    setSending(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: targetCode }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(t("requestSent"), "success");
        setSearchResult(null);
        setSearchCode("");
        loadFriends();
      } else {
        showToast(json.error ?? t("sendFailed"), "error");
      }
    } catch {
      showToast(t("sendFailed"), "error");
    } finally {
      setSending(false);
    }
  };

  const respondToRequest = async (requestId: string, action: "accept" | "decline") => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        showToast(action === "accept" ? t("accepted") : t("declined"), "success");
        loadFriends();
      }
    } catch {
      showToast(t("actionFailed"), "error");
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const res = await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
      if (res.ok) {
        showToast(t("removed"), "success");
        loadFriends();
      }
    } catch {
      showToast(t("actionFailed"), "error");
    }
  };

  const openScanner = async () => {
    if (!Scanner) {
      const { QrScanner } = await import("@/components/ui/QrScanner");
      setScanner(() => QrScanner);
    }
    setShowScanner(true);
  };

  const handleQrScan = (text: string) => {
    setShowScanner(false);
    // Extract code from URL or use raw value
    try {
      const url = new URL(text);
      const code = url.searchParams.get("code");
      if (code) {
        setSearchCode(code);
        return;
      }
    } catch {}
    setSearchCode(text.trim().toUpperCase());
  };

  const copyCode = () => {
    if (user?.userCode) {
      navigator.clipboard.writeText(user.userCode);
      showToast(t("codeCopied"), "success");
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--foreground)]">{t("title")}</h1>
      </div>

      {/* My code */}
      {user?.userCode && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--muted)]">{t("myCode")}</p>
            <p className="font-mono font-semibold text-[var(--foreground)]">{user.userCode}</p>
          </div>
          <button onClick={copyCode} className="p-2 rounded-lg hover:bg-[var(--background)]">
            <Copy className="h-4 w-4 text-[var(--muted)]" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 mb-4">
        <p className="text-sm font-medium text-[var(--foreground)] mb-3">{t("addFriend")}</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              placeholder={t("enterCode")}
              onKeyDown={(e) => { if (e.key === "Enter") searchUser(); }}
            />
          </div>
          <button
            onClick={openScanner}
            className="p-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-[var(--muted)] hover:border-[#7dc0ff] hover:text-[#7dc0ff] transition-colors"
          >
            <QrCode className="h-5 w-5" />
          </button>
          <button
            onClick={searchUser}
            disabled={searching || !searchCode.trim()}
            className="p-2.5 rounded-xl bg-[#7dc0ff] text-white hover:bg-[#5aaeee] transition-colors disabled:opacity-60"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {searchResult && (
          <div className="mt-3 p-3 bg-[var(--background)] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#7dc0ff]/20 flex items-center justify-center text-sm font-bold text-[#7dc0ff] flex-shrink-0">
                {searchResult.avatarUrl ? (
                  <Image src={searchResult.avatarUrl} alt={searchResult.name} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  searchResult.name?.[0]?.toUpperCase()
                )}
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{searchResult.name}</p>
                <p className="text-xs text-[var(--muted)] font-mono">{searchResult.userCode}</p>
              </div>
            </div>
            <Button
              size="sm"
              loading={sending}
              onClick={() => sendRequest(searchResult.userCode)}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              {t("addBtn")}
            </Button>
          </div>
        )}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 mb-4">
          <p className="text-sm font-medium text-[var(--foreground)] mb-3">
            {t("incoming")} ({incoming.length})
          </p>
          <div className="flex flex-col gap-2">
            {incoming.map((req) => (
              <div key={req.requestId} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#7dc0ff]/20 flex items-center justify-center text-sm font-bold text-[#7dc0ff] flex-shrink-0">
                    {req.user.avatarUrl ? (
                      <Image src={req.user.avatarUrl} alt={req.user.name} width={36} height={36} className="object-cover w-full h-full" />
                    ) : (
                      req.user.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{req.user.name}</p>
                    <p className="text-xs text-[var(--muted)] font-mono">{req.user.userCode}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToRequest(req.requestId, "accept")}
                    className="p-1.5 rounded-lg bg-[#7dc0ff]/10 text-[#7dc0ff] hover:bg-[#7dc0ff]/20 transition-colors"
                    title={t("accept")}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => respondToRequest(req.requestId, "decline")}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title={t("decline")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 mb-4">
          <p className="text-sm font-medium text-[var(--muted)] mb-3">{t("outgoing")}</p>
          <div className="flex flex-col gap-2">
            {outgoing.map((req) => (
              <div key={req.requestId} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-xl">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-[#7dc0ff]/20 flex items-center justify-center text-sm font-bold text-[#7dc0ff] flex-shrink-0">
                  {req.user.avatarUrl ? (
                    <Image src={req.user.avatarUrl} alt={req.user.name} width={36} height={36} className="object-cover w-full h-full" />
                  ) : (
                    req.user.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[var(--foreground)]">{req.user.name}</p>
                  <p className="text-xs text-[var(--muted)]">{t("pendingLabel")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
        <p className="text-sm font-medium text-[var(--foreground)] mb-3">
          {t("friendsCount", { count: friends.length })}
        </p>
        {fetching ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#7dc0ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : friends.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-4">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#7dc0ff]/20 flex items-center justify-center text-sm font-bold text-[#7dc0ff] flex-shrink-0">
                    {friend.avatarUrl ? (
                      <Image src={friend.avatarUrl} alt={friend.name} width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      friend.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{friend.name}</p>
                    <p className="text-xs text-[var(--muted)] font-mono">{friend.userCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFriend(friend.id)}
                  className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title={t("remove")}
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      <Modal open={showScanner} onClose={() => setShowScanner(false)} title={t("scanQR")}>
        <div className="py-2">
          {Scanner && <Scanner onScan={handleQrScan} onError={() => setShowScanner(false)} />}
          <p className="text-xs text-[var(--muted)] text-center mt-3">{t("scanHint")}</p>
        </div>
      </Modal>
    </AppShell>
  );
}
