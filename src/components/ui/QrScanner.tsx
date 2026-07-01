"use client";

import { useEffect, useRef, useState } from "react";
import { applyCloseFocus } from "@/lib/cameraFocus";

interface QrScannerProps {
  onScan: (code: string) => void;
  onError?: (err: string) => void;
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const containerId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<any>(null);
  const runningRef = useRef(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let active = true;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!active) return;

      const scanner = new Html5Qrcode(containerId.current);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (!runningRef.current) return;
            runningRef.current = false;
            scanner.stop().catch(() => {}).finally(() => {
              if (active) onScan(decodedText);
            });
          },
          () => { /* per-frame errors — ignore */ }
        )
        .then(() => {
          if (active) {
            runningRef.current = true;
            setStarted(true);
            applyCloseFocus(scanner);
          }
        })
        .catch((err: any) => {
          if (onError) onError(err?.message ?? String(err));
        });
    });

    return () => {
      active = false;
      if (runningRef.current && scannerRef.current) {
        runningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        id={containerId.current}
        onClick={() => scannerRef.current && applyCloseFocus(scannerRef.current)}
        role={started ? "button" : undefined}
        title={started ? "Tap to refocus" : undefined}
        className="w-full rounded-xl overflow-hidden cursor-pointer"
        style={{ minHeight: 260 }}
      />
      {!started && (
        <p className="text-sm text-[var(--muted)]">Starting camera…</p>
      )}
    </div>
  );
}
