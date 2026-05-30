import { useEffect } from "react";

// Tracks how many overlays are currently open so nested modals don't
// prematurely restore scrolling when one of them closes.
let lockCount = 0;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    lockCount++;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar width to prevent layout shift
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPaddingRight;
      }
    };
  }, [active]);
}
