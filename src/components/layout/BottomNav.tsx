"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Package, MapPin, Heart, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { clsx } from "clsx";

const tabs = [
  { href: "/items", icon: Package, key: "items" },
  { href: "/locations", icon: MapPin, key: "locations" },
  { href: "/", icon: null, key: "home", isCenter: true },
  { href: "/favorites", icon: Heart, key: "favorites" },
  { href: "/settings", icon: Settings, key: "settings" },
];

function useVirtualKeyboard() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  return keyboardOpen;
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const keyboardOpen = useVirtualKeyboard();
  const [rippleKey, setRippleKey] = useState(0);
  const [rippleActive, setRippleActive] = useState(false);

  const fireRipple = useCallback(() => {
    setRippleKey((k) => k + 1);
    setRippleActive(true);
    setTimeout(() => setRippleActive(false), 600);
  }, []);

  return (
    <motion.nav
      animate={{ y: keyboardOpen ? 120 : 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/90 backdrop-blur-xl border-t border-[var(--card-border)] pb-[env(safe-area-inset-bottom,0px)]"
    >
          <div className="flex items-center justify-around px-2 h-16 max-w-lg mx-auto">
            {tabs.map((tab) => {
              const isActive =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(tab.href);

              if (tab.isCenter) {
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={fireRipple}
                  className="flex items-center justify-center -mt-10"
                >
                  <motion.div
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    className={clsx(
                      "relative w-20 h-20 rounded-full overflow-hidden",
                        "shadow-2xl shadow-[#7dc0ff]/50",
                        "border-4 border-[var(--background)]",
                        "transition-all duration-300",
                        isActive && "ring-2 ring-[#7dc0ff]/60 ring-offset-2 ring-offset-[var(--background)]",
                      )}
                    >
                      <Image
                        src="/icons/icon.png"
                        alt="Homearch"
                        fill
                        className="object-cover"
                      />
                      {/* Ripple */}
                      <AnimatePresence>
                        {rippleActive && (
                          <motion.span
                            key={rippleKey}
                            initial={{ scale: 0, opacity: 0.55 }}
                            animate={{ scale: 4, opacity: 0 }}
                            exit={{}}
                            transition={{ duration: 0.55, ease: "easeOut" }}
                            className="absolute inset-0 rounded-full bg-white pointer-events-none"
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Link>
                );
              }

              const Icon = tab.icon!;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center justify-center gap-1 flex-1 py-1"
                >
                  <motion.div
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    className="relative flex flex-col items-center gap-0.5"
                  >
                    <Icon
                      className={clsx(
                        "h-5 w-5 transition-colors duration-200",
                        isActive ? "text-[#7dc0ff]" : "text-[var(--muted)]",
                      )}
                    />
                    <span
                      className={clsx(
                        "text-[10px] font-medium transition-colors duration-200",
                        isActive ? "text-[#7dc0ff]" : "text-[var(--muted)]",
                      )}
                    >
                      {t(
                        tab.key as
                          | "items"
                          | "locations"
                          | "home"
                          | "favorites"
                          | "settings",
                      )}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#7dc0ff]"
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.nav>
  );
}
