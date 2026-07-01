/** Shared helpers for nudging getUserMedia camera tracks to focus at short
 *  distances — needed because many devices default to a focus mode/range
 *  tuned for arm's-length photos, which makes it hard to hold a QR/barcode
 *  right up to the lens. Both are best-effort: unsupported browsers/devices
 *  simply no-op instead of throwing. */

interface FocusCapableScanner {
  getRunningTrackCapabilities: () => MediaTrackCapabilities;
  applyVideoConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
}

type ExtendedCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  focusDistance?: { min: number; max: number; step?: number };
};

/** Prefers continuous autofocus (handles both near and far well on most
 *  hardware); if the device only exposes manual focus, pins it to the
 *  nearest supported distance so close-up scanning is possible at all. */
export async function applyCloseFocus(scanner: FocusCapableScanner): Promise<void> {
  try {
    const capabilities = scanner.getRunningTrackCapabilities() as ExtendedCapabilities;
    const advanced: Record<string, unknown> = {};

    if (capabilities.focusMode?.includes("continuous")) {
      advanced.focusMode = "continuous";
    } else if (capabilities.focusMode?.includes("manual") && capabilities.focusDistance) {
      advanced.focusMode = "manual";
      advanced.focusDistance = capabilities.focusDistance.min;
    }

    if (Object.keys(advanced).length > 0) {
      await scanner.applyVideoConstraints({ advanced: [advanced] });
    }
  } catch {
    /* focus constraints unsupported on this device/browser — ignore */
  }
}
