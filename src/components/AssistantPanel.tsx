"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChefHat,
  History,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AssistantData {
  familyName: string;
  messages: Message[];
  pending: { id: string; preview: string }[];
  conversations: { id: string; title: string; updatedAt: string }[];
}

function AssistantContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const parts: React.ReactNode[] = [];
  const cells = (line: string) => line.slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
  let text: string[] = [];
  const flushText = () => {
    if (text.length) parts.push(<span key={`text-${parts.length}`} className="whitespace-pre-wrap">{text.join("\n")}</span>);
    text = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith("|") && line.endsWith("|") && /^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[index + 1] ?? "")) {
      flushText();
      const headings = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].startsWith("|") && lines[index].endsWith("|")) {
        rows.push(cells(lines[index]));
        index++;
      }
      index--;
      parts.push(
        <div key={`table-${parts.length}`} className="my-2 max-w-full overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left text-xs">
            <thead><tr>{headings.map((heading, i) => <th key={i} scope="col" className="border-b border-[var(--card-border)] px-2 py-2">{heading}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border-b border-[var(--card-border)] px-2 py-2">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else {
      text.push(line);
    }
  }
  flushText();
  return <>{parts}</>;
}

function failureKey(status: number) {
  if (status === 401) return "unauthorized" as const;
  if (status === 403) return "noFamily" as const;
  if (status === 409) return "stale" as const;
  if (status === 422) return "invalid" as const;
  if (status === 502 || status === 503) return "aiUnavailable" as const;
  return "failure" as const;
}

export function AssistantPanel({
  onRecipes,
  onSavedRecipes,
}: {
  onRecipes: () => void;
  onSavedRecipes: () => void;
}) {
  const t = useTranslations("assistant");
  const chef = useTranslations("fridgeChef");
  const common = useTranslations("common");
  const { user, loading } = useAuth();
  const [data, setData] = useState<AssistantData | null>(null);
  const [conversation, setConversation] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    const response = await fetch(
      `/api/assistant?conversation=${encodeURIComponent(id)}`,
      { signal, cache: "no-store" },
    );
    if (!response.ok) throw new Error(t(failureKey(response.status)));
    const json = await response.json();
    if (!signal?.aborted) setData(json.data);
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    if (!user?.familyId) return () => controller.abort();
    fetch("/api/assistant?conversation=new", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Assistant load failed");
        const json = await response.json();
        if (!controller.signal.aborted) setData(json.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(t("failure"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingData(false);
      });
    return () => controller.abort();
  }, [user?.familyId, user?.id, t]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [data?.messages, data?.pending, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !data) return;
    setBusy(true);
    setError("");
    setNotice("");
    setMessage("");
    setData((previous) =>
      previous
        ? {
            ...previous,
            messages: [
              ...previous.messages,
              { role: "user", content: trimmed },
            ],
          }
        : previous,
    );
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          conversation
            ? { message: trimmed, conversation, stream: true }
            : { message: trimmed, newConversation: true, stream: true },
        ),
      });
      if (!response.ok || !response.body)
        throw new Error(t(failureKey(response.status)));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      let shown = 0;
      let appended = false;
      let id: string | null = null;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const renderNext = () => {
        const characters = Array.from(reply);
        if (shown >= characters.length) return;
        shown = reducedMotion
          ? characters.length
          : Math.min(
              shown + Math.max(3, Math.ceil((characters.length - shown) / 100)),
              characters.length,
            );
        const partial = characters.slice(0, shown).join("");
        setData((previous) =>
          previous
            ? {
                ...previous,
                messages: [
                  ...previous.messages.slice(0, -1),
                  { role: "assistant", content: partial },
                ],
              }
            : previous,
        );
      };
      timer = setInterval(renderNext, 20);
      const processLine = (line: string) => {
        const event: unknown = JSON.parse(line);
        if (!event || typeof event !== "object" || !("type" in event))
          throw new Error(t("failure"));
        if (
          event.type === "delta" &&
          "text" in event &&
          typeof event.text === "string"
        ) {
          if (!appended) {
            appended = true;
            setData((previous) =>
              previous
                ? {
                    ...previous,
                    messages: [
                      ...previous.messages,
                      { role: "assistant", content: "" },
                    ],
                  }
                : previous,
            );
          }
          reply += event.text;
          if (reducedMotion) renderNext();
        } else if (
          event.type === "done" &&
          "conversation" in event &&
          typeof event.conversation === "string"
        ) {
          id = event.conversation;
        } else if (
          event.type === "error" &&
          "status" in event &&
          typeof event.status === "number"
        ) {
          throw new Error(t(failureKey(event.status)));
        } else {
          throw new Error(t("failure"));
        }
      };
      for (;;) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line) processLine(line);
        if (chunk.done) break;
      }
      if (buffer) processLine(buffer);
      if (!id || !appended) throw new Error(t("failure"));
      setConversation(id);
      while (shown < Array.from(reply).length)
        await new Promise((resolve) => setTimeout(resolve, 20));
      await load(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("failure"));
    } finally {
      if (timer) clearInterval(timer);
      setBusy(false);
    }
  };

  const selectConversation = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await load(id);
      setConversation(id);
      setHistoryOpen(false);
    } catch {
      setError(t("failure"));
    } finally {
      setBusy(false);
    }
  };

  const newConversation = () => {
    if (busy) return;
    setConversation(null);
    setData((previous) =>
      previous ? { ...previous, messages: [], pending: [] } : previous,
    );
    setMessage("");
    setError("");
    setNotice("");
    setHistoryOpen(false);
  };

  const deleteConversation = async (id: string) => {
    if (busy || !window.confirm(t("deleteConversationConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/assistant?conversation=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Conversation deletion failed");
      setData((previous) =>
        previous
          ? {
              ...previous,
              conversations: previous.conversations.filter(
                (entry) => entry.id !== id,
              ),
              ...(conversation === id ? { messages: [], pending: [] } : {}),
            }
          : previous,
      );
      if (conversation === id) setConversation(null);
    } catch {
      setError(t("failure"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (id: string) => {
    if (busy || !conversation) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirm: true }),
      });
      if (!response.ok) {
        setError(t(failureKey(response.status)));
      } else {
        const result = await response.json();
        setNotice(
          t(result.data.imageCleanupFailed ? "imageCleanupFailed" : "success"),
        );
      }
      await load(conversation);
    } catch {
      setError(t("failure"));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user)
    return (
      <p className="py-4 text-sm text-[var(--muted)]">{common("loading")}</p>
    );
  if (!user.familyId)
    return (
      <section className="my-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="my-3">{t("noFamily")}</p>
        <Link href="/settings" className="text-[#7dc0ff] underline">
          {t("settings")}
        </Link>
      </section>
    );

  return (
    <section className="relative flex h-[calc(100dvh-10rem)] min-h-0 flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card)] shadow-xl shadow-black/5 lg:h-[calc(100dvh-2rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <h1 className="bg-gradient-to-r from-[#7dc0ff] via-[#7dc0ff] to-purple-500 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            {t("title")}
          </h1>
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 font-mono text-[0.55rem] tracking-widest text-indigo-400">
            BETA
          </span>
        </div>
        <div>
          {data && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t("family", { name: data.familyName })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-label={t("historyTitle")}
            aria-expanded={historyOpen}
            className="rounded-xl p-2.5 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={newConversation}
            aria-label={t("newChat")}
            title={t("newChat")}
            className="rounded-xl p-2.5 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </div>
      </header>

      {historyOpen && (
        <aside
          className="absolute inset-y-0 left-0 z-20 flex w-[min(85%,20rem)] flex-col border-r border-[var(--card-border)] bg-[var(--card)] p-4 shadow-2xl"
          aria-label={t("historyTitle")}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("historyTitle")}</h2>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              aria-label={chef("close")}
              className="rounded-lg p-2 hover:bg-[var(--background)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={newConversation}
            className="mt-4"
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            {t("newChat")}
          </Button>
          <div 
          className="mt-4 flex-1 space-y-1 overflow-y-auto"
          >
            {data?.conversations.length === 0 && (
              <p className="p-2 text-sm text-[var(--muted)]">
                {t("noConversations")}
              </p>
            )}
            {data?.conversations.map((entry) => (
              <div
                key={entry.id}
                className={`group flex items-center rounded-xl ${conversation === entry.id ? "bg-[#7dc0ff]/15" : "hover:bg-[var(--background)]"}`}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => selectConversation(entry.id)}
                  className="min-w-0 flex-1 truncate px-3 py-3 text-left text-sm"
                >
                  {entry.title}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => deleteConversation(entry.id)}
                  aria-label={t("deleteConversation")}
                  title={t("deleteConversation")}
                  className="rounded-lg p-2 text-[var(--muted)] hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 max-h-[calc(100dvh-8rem)]"
        aria-live="polite"
      >
        {loadingData && (
          <p role="status" className="text-sm text-[var(--muted)]">
            {common("loading")}123
          </p>
        )}
        {data?.messages.length === 0 && (
          <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center sm:py-14">
            <span className="mb-4 rounded-2xl bg-gradient-to-br from-[#7dc0ff]/20 to-purple-500/20 p-4 text-[#7dc0ff]">
              <Sparkles className="h-8 w-8" />
            </span>
            <p className="text-lg font-semibold">{t("emptyHistory")}</p>
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-5"
        >
          {data?.messages.map((entry, index) => (
            <div
              key={index}
              className={`flex gap-2 ${entry.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {entry.role === "assistant" && (
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7dc0ff] to-purple-500 text-white">
                  <ChefHat className="h-4 w-4" />
                </span>
              )}
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${entry.role === "user" ? "rounded-br-sm bg-[#7dc0ff] text-slate-950" : "rounded-bl-sm border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)]"}`}
              >
                <span className="mb-1 block text-xs font-semibold opacity-70">
                  {entry.role === "user" ? t("you") : t("title")}
                </span>
                {entry.role === "assistant" && entry.content
                  ? <AssistantContent content={entry.content} />
                  : entry.content || (busy ? "…" : "")}
              </div>
            </div>
          ))}
          {busy && data?.messages.at(-1)?.role === "user" && (
            <p role="status" className="flex items-center gap-2 pl-10 text-sm text-[var(--muted)]">
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              {t("thinking")}
            </p>
          )}
          {data?.pending.map((proposal) => (
            <div
              key={proposal.id}
              className="ml-10 rounded-2xl border border-amber-500/50 bg-amber-500/5 p-4"
            >
              <h2 className="font-semibold">{t("pendingTitle")}</h2>
              <pre className="my-3 whitespace-pre-wrap break-words font-sans text-sm">
                {proposal.preview}
              </pre>
              <Button disabled={busy} onClick={() => confirm(proposal.id)}>
                {busy ? t("confirming") : t("confirm")}
              </Button>
            </div>
          ))}
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-green-600">
              {notice}
            </p>
          )}
        </div>
      </div>

      {data && (
        <div className="border-t border-[var(--card-border)] bg-[var(--card)] px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => send(t("inventoryPrompt"))}
                className="shrink-0 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs hover:bg-[var(--background)] disabled:opacity-50"
              >
                {t("inventoryQuick")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => send(t("advicePrompt"))}
                className="shrink-0 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs hover:bg-[var(--background)] disabled:opacity-50"
              >
                {t("adviceQuick")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onRecipes}
                className="shrink-0 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs hover:bg-[var(--background)] disabled:opacity-50"
              >
                {t("recipesQuick")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSavedRecipes}
                className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs hover:bg-[var(--background)] disabled:opacity-50"
              >
                <BookOpen className="h-3 w-3" />
                {t("savedRecipes")}
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send(message);
              }}
              className="flex items-center gap-2"
            >
              <Input
                aria-label={t("placeholder")}
                placeholder={t("placeholder")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={busy}
              />
              <Button
                type="submit"
                disabled={busy || !message.trim()}
                aria-label={t("send")}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-2 text-center text-[10px] text-[var(--muted)]">
              {t("privacy")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
