"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { applyCloseFocus, startCloseFocusLoop } from "@/lib/cameraFocus";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (err: string) => void;
}

/** Shared list of formats we care about — built lazily since the enum only
 *  exists once the html5-qrcode module has been dynamically imported. */
function buildFormats(F: any) {
  return [
    F.EAN_13,
    F.EAN_8,
    F.UPC_A,
    F.UPC_E,
    F.CODE_128,
    F.CODE_39,
    F.CODE_93,
    F.ITF,
    F.CODABAR,
    F.QR_CODE,
  ];
}

/** Downscales very large photos before handing them to the zxing decoder —
 *  huge camera images are a common cause of "No MultiFormat Readers were
 *  able to detect the code" failures. Returns the original file untouched
 *  if it's already small or if resizing fails for any reason. */
async function resizeImageFile(file: File, maxDim: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    return blob ? new File([blob], file.name, { type: "image/jpeg" }) : file;
  } finally {
    bitmap.close?.();
  }
}

export function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const containerId = useRef(
    `barcode-cam-${Math.random().toString(36).slice(2)}`,
  );
  const fileContainerId = useRef(
    `barcode-file-${Math.random().toString(36).slice(2)}`,
  );
  const scannerRef = useRef<any>(null);
  const doneRef = useRef(false);
  /** True only after scanner.start() has fully resolved — guards cleanup stop() call */
  const startedRef = useRef(false);
  /** Stops the recurring focus-nudge interval started once the camera is running */
  const stopFocusLoopRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [started, setStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const t = useTranslations("camera");

  // useEffect(() => {
  //   let active = true;

  //   import("html5-qrcode").then(async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
  //     if (!active) return;

  //     const formats = buildFormats(Html5QrcodeSupportedFormats);

  //     const scanner = new Html5Qrcode(containerId.current, {
  //       formatsToSupport: formats,
  //       experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  //       verbose: false,
  //     });
  //     scannerRef.current = scanner;

  //     const onSuccess = (code: string) => {
  //       if (doneRef.current) return;
  //       doneRef.current = true;
  //       startedRef.current = false;
  //       stopFocusLoopRef.current?.();
  //       stopFocusLoopRef.current = null;
  //       scanner
  //         .stop()
  //         .catch(() => {})
  //         .finally(() => {
  //           if (active) onScan(code);
  //         });
  //     };
  //     const onFrameError = () => {
  //       /* per-frame non-fatal errors — ignore */
  //     };
  //     const scanConfig = { fps: 10, qrbox: { width: 300, height: 150 } };

  //     // Build a prioritized list of camera configs to try. Requesting a
  //     // hard-coded `facingMode: "environment"` fails with
  //     // "NotFoundError: Requested device not found" on many laptops/desktops
  //     // (and some mobile browsers) that don't expose an "environment"
  //     // camera, even though a usable camera exists. Enumerating real devices
  //     // via getCameras() first (which internally just asks for any camera)
  //     // is far more reliable, falling back to facingMode constraints only
  //     // if enumeration itself isn't available.
  //     const candidates: Array<string | MediaTrackConstraints> = [];
  //     try {
  //       const cameras = await Html5Qrcode.getCameras();
  //       if (active && cameras && cameras.length > 0) {
  //         const back = cameras.find((c) => /back|rear|environment/i.test(c.label));
  //         if (back) candidates.push(back.id);
  //         const rest = cameras.filter((c) => c.id !== back?.id).map((c) => c.id);
  //         // On phones the last enumerated camera is often the main/back one.
  //         candidates.push(...rest.reverse());
  //       }
  //     } catch {
  //       // Permission not granted yet or enumeration unsupported — fall
  //       // through to facingMode-based attempts below.
  //     }
  //     candidates.push({ facingMode: "environment" });
  //     candidates.push({ facingMode: "user" });

  //     let lastErr: unknown = null;
  //     for (const candidate of candidates) {
  //       if (!active) return;
  //       try {
  //         await scanner.start(candidate, scanConfig, onSuccess, onFrameError);
  //         lastErr = null;
  //         if (active) {
  //           startedRef.current = true;
  //           setStarted(true);
  //           // One-shot nudge isn't enough on iPhones when a barcode is held
  //           // very close to the lens — keep re-applying focus constraints
  //           // periodically to force continuous AF to keep re-searching.
  //           stopFocusLoopRef.current = startCloseFocusLoop(scanner);
  //         }
  //         break;
  //       } catch (err) {
  //         lastErr = err;
  //       }
  //     }

  //     if (!active) return;

  //     if (lastErr !== null) {
  //       const msg = (lastErr as any)?.message ?? String(lastErr);
  //       setCameraError(msg);
  //       onError?.(msg);
  //     }
  //   });

  //   return () => {
  //     active = false;
  //     stopFocusLoopRef.current?.();
  //     stopFocusLoopRef.current = null;
  //     // Only call stop() if the scanner actually started successfully
  //     if (!doneRef.current && scannerRef.current && startedRef.current) {
  //       doneRef.current = true;
  //       startedRef.current = false;
  //       scannerRef.current.stop().catch(() => {});
  //     }
  //   };
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  useEffect(() => {
    let active = true;

    import("html5-qrcode").then(
      async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
        if (!active) return;

        const formats = buildFormats(Html5QrcodeSupportedFormats);

        const scanner = new Html5Qrcode(containerId.current, {
          formatsToSupport: formats,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        scannerRef.current = scanner;

        const onSuccess = (code: string) => {
          if (doneRef.current) return;
          doneRef.current = true;
          startedRef.current = false;
          stopFocusLoopRef.current?.();
          stopFocusLoopRef.current = null;
          scanner
            .stop()
            .catch(() => {})
            .finally(() => {
              if (active) onScan(code);
            });
        };

        const onFrameError = () => {
        };

        const scanConfig = { fps: 10, qrbox: { width: 300, height: 150 } };
        const candidates: Array<string | MediaTrackConstraints> = [];

        try {
          const cameras = await Html5Qrcode.getCameras();

          if (active && cameras && cameras.length > 0) {
            const validCameras = cameras.filter(
              (c) => c.label && c.label.trim().length > 0,
            );

            if (validCameras.length > 0) {
              const backCameras = validCameras.filter((c) =>
                /back|rear|environment/i.test(c.label),
              );

              const ultraWideRegex =
                /ultra[\s_-]?wide|0\.5x|back\s+1|macro|dual|triple/i;

              const ultraWide = backCameras.filter((c) =>
                ultraWideRegex.test(c.label),
              );
              const normalBack = backCameras.filter(
                (c) => !ultraWideRegex.test(c.label),
              );

              ultraWide.forEach((c) => candidates.push(c.id));
              normalBack.forEach((c) => candidates.push(c.id));
            }
          }
        } catch (err) {
          console.warn(
            "無法列舉鏡頭或被權限拒絕，將啟用原生存取限制機制:",
            err,
          );
        }

        if (candidates.length === 0) {
          candidates.push({ facingMode: "environment" });
        } else {
          candidates.push({ facingMode: "environment" });
        }

        candidates.push({ facingMode: "user" });

        console.log("最終鏡頭嘗試順序 (Candidates):", candidates);

        let lastErr: unknown = null;

        for (const candidate of candidates) {
          if (!active) return;
          try {
            await scanner.start(candidate, scanConfig, onSuccess, onFrameError);
            lastErr = null;

            if (active) {
              startedRef.current = true;
              setStarted(true);

              setTimeout(() => {
                if (active && typeof stopFocusLoopRef.current !== "function") {
                  stopFocusLoopRef.current = startCloseFocusLoop(scanner);
                  console.log("近距離對焦優化循環已成功啟動");
                }
              }, 250);
            }
            break; 
          } catch (err) {
            lastErr = err;
            console.warn(
              "此鏡頭 Candidate 啟動失敗，嘗試下一個:",
              candidate,
              err,
            );
          }
        }

        if (!active) return;

        if (lastErr !== null) {
          const msg = (lastErr as any)?.message ?? String(lastErr);
          setCameraError(msg);
          onError?.(msg);
        }
      },
    );

    return () => {
      active = false;
      if (stopFocusLoopRef.current) {
        stopFocusLoopRef.current();
        stopFocusLoopRef.current = null;
      }
    };
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } =
        await import("html5-qrcode");
      const scanner = new Html5Qrcode(fileContainerId.current, {
        formatsToSupport: buildFormats(Html5QrcodeSupportedFormats),
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });

      // Try the original file first, then fall back to a downscaled copy —
      // large camera photos are the most common cause of decode failures.
      const candidates = [file];
      try {
        const resized = await resizeImageFile(file, 1000);
        if (resized !== file) candidates.push(resized);
      } catch {
        /* resizing unsupported/failed — original file is still tried */
      }

      let lastErr: unknown = null;
      for (const candidate of candidates) {
        try {
          const result = await scanner.scanFile(candidate, false);
          onScan(result);
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr;
    } catch {
      onError?.(t("noBarcodeInImage"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Camera viewport — tapping re-nudges the focus, which helps on
          devices whose autofocus gets stuck after zooming in close. */}
      <div
        id={containerId.current}
        onClick={() =>
          scannerRef.current && applyCloseFocus(scannerRef.current)
        }
        role={started ? "button" : undefined}
        title={started ? t("tapToFocus") : undefined}
        className="w-full rounded-xl overflow-hidden bg-[var(--card)] cursor-pointer"
        style={{ minHeight: 240 }}
      />
      {!started && !cameraError && (
        <p className="text-sm text-[var(--muted)] text-center">
          {t("startingCamera")}
        </p>
      )}
      {cameraError && (
        <p className="text-sm text-red-400 text-center px-2">
          {t("cameraUnavailable")}
        </p>
      )}

      {/* Scanning tips — usually more effective at improving success rate
          than tweaking decoder parameters. */}
      {started && !cameraError && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[#7dc0ff]/30 bg-[#7dc0ff]/5">
          <Lightbulb className="h-4 w-4 text-[#7dc0ff] flex-shrink-0 mt-0.5" />
          <ul className="text-xs text-[var(--muted)] space-y-1 list-disc list-inside">
            <li>{t("tipFlat")}</li>
            <li>{t("tipLighting")}</li>
            <li>{t("tipTilt")}</li>
            <li>{t("tapToFocus")}</li>
          </ul>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <hr className="flex-1 border-[var(--card-border)]" />
        <span className="text-xs text-[var(--muted)]"> OR </span>
        <hr className="flex-1 border-[var(--card-border)]" />
      </div>

      {/* File upload */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--card-border)] text-sm text-[var(--muted)] hover:border-[#7dc0ff] hover:text-[#7dc0ff] transition-colors"
      >
        <Upload className="h-4 w-4" />
        {t("uploadBarcodeImage")}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
          e.target.value = "";
        }}
      />

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <hr className="flex-1 border-[var(--card-border)]" />
        <span className="text-xs text-[var(--muted)]"> OR </span>
        <hr className="flex-1 border-[var(--card-border)]" />
      </div>

      {/* Manual entry fallback — always available so users never get stuck
          when the barcode is damaged or won't scan. */}
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manualCode.trim();
          if (code) onScan(code);
        }}
      >
        <label className="text-xs text-[var(--muted)]">
          {t("manualEntryLabel")}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t("manualEntryPlaceholder")}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[#7dc0ff]"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#7dc0ff] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#6bb0f0] transition-colors"
          >
            {t("manualEntrySubmit")}
          </button>
        </div>
      </form>

      {/* Hidden container used by scanFile */}
      <div
        id={fileContainerId.current}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
