"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { useToast } from "@/components/ui/Toast";
import { VoicePreviewDrawer, type VoicePreviewItem } from "@/components/VoicePreviewDrawer";

type RecognitionState = "idle" | "listening" | "processing";

interface VoiceInputButtonProps {
  /** Called after the user successfully commits changes (e.g. to refetch a list). */
  onApplied?: () => void;
  className?: string;
}

export function VoiceInputButton({ onApplied, className }: VoiceInputButtonProps) {
  const t = useTranslations("items");
  const { showToast } = useToast();
  const [state, setState] = useState<RecognitionState>("idle");
  const [previewItems, setPreviewItems] = useState<VoicePreviewItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const parseTranscript = useCallback(
    async (transcript: string) => {
      setState("processing");
      try {
        const res = await fetch("/api/ai/voice-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? t("voiceParseFailed"));

        const parsedItems: VoicePreviewItem[] = json.data?.items ?? [];
        if (parsedItems.length === 0) {
          showToast(t("voiceNoItemsDetected"), "info");
          return;
        }
        setPreviewItems(parsedItems);
        setDrawerOpen(true);
      } catch (e: any) {
        showToast(e.message ?? t("voiceParseFailed"), "error");
      } finally {
        setState("idle");
      }
    },
    [showToast, t],
  );

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor: any =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor) {
      showToast(t("voiceNotSupported"), "error");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "zh-HK";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript: string | undefined = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        parseTranscript(transcript);
      } else {
        showToast(t("voiceNoSpeechDetected"), "info");
        setState("idle");
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        showToast(t("voiceNoSpeechDetected"), "info");
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showToast(t("voiceMicPermissionDenied"), "error");
      } else if (event.error !== "aborted") {
        showToast(t("voiceParseFailed"), "error");
      }
      setState((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognition.onend = () => {
      setState((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;
    setState("listening");
    recognition.start();
  }, [parseTranscript, showToast, t]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleClick = () => {
    if (state === "listening") stopListening();
    else if (state === "idle") startListening();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "processing"}
        className={clsx(
          "flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all group",
          state === "listening"
            ? "border-red-400 bg-red-500/5"
            : "border-[var(--card-border)] hover:border-[#7dc0ff] bg-[var(--card)] hover:bg-[#7dc0ff]/5",
          state === "processing" && "opacity-70 cursor-wait",
          className,
        )}
      >
        <div
          className={clsx(
            "relative p-3 rounded-xl transition-colors",
            state === "listening" ? "bg-red-500/15" : "bg-[#7dc0ff]/10 group-hover:bg-[#7dc0ff]/20",
          )}
        >
          {state === "processing" ? (
            <Loader2 className="h-6 w-6 text-[#7dc0ff] animate-spin" />
          ) : (
            <Mic className={clsx("h-6 w-6", state === "listening" ? "text-red-500 animate-pulse" : "text-[#7dc0ff]")} />
          )}
          {state === "listening" && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
          )}
        </div>
        <span className="text-sm font-semibold text-[var(--foreground)] text-center">
          {state === "listening"
            ? t("voiceListening")
            : state === "processing"
              ? t("voiceProcessing")
              : t("voiceInput")}
        </span>
      </button>

      <VoicePreviewDrawer
        open={drawerOpen}
        items={previewItems}
        onClose={() => setDrawerOpen(false)}
        onApplied={() => {
          setDrawerOpen(false);
          onApplied?.();
        }}
      />
    </>
  );
}
