"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export function LandscapeOverlay() {
  const [isLandscape, setIsLandscape] = useState(false);
  const t = useTranslations("common");

  useBodyScrollLock(isLandscape);

  useEffect(() => {
    const check = () => {
      const landscape = window.matchMedia("(orientation: landscape)").matches;
      const mobile = window.innerWidth < 1024;
      setIsLandscape(landscape && mobile);
    };
    check();
    const mqOrientation = window.matchMedia("(orientation: landscape)");
    mqOrientation.addEventListener("change", check);
    window.addEventListener("resize", check);
    return () => {
      mqOrientation.removeEventListener("change", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  if (!isLandscape) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-[#0f1117] text-white"
    >
      <RotateCcw className="h-14 w-14 text-[#7dc0ff] animate-spin [animation-direction:reverse] [animation-duration:2s]" />
      <p className="text-lg font-semibold text-center px-8">
        {t("rotateDevice")}
      </p>
    </div>
  );
}
