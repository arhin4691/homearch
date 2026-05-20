"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Package, MapPin, Heart, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";

const tabs = [
  { href: "/items", icon: Package, key: "items" },
  { href: "/locations", icon: MapPin, key: "locations" },
  { href: "/", icon: null, key: "home", isCenter: true },
  { href: "/favorites", icon: Heart, key: "favorites" },
  { href: "/settings", icon: Settings, key: "settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/90 backdrop-blur-xl border-t border-[var(--card-border)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around px-2 h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);

          if (tab.isCenter) {
            return (
              <Link key={tab.href} href={tab.href} className="flex items-center justify-center -mt-6">
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  className={clsx(
                    "w-14 h-14 rounded-2xl shadow-lg shadow-[#7dc0ff]/40 flex items-center justify-center overflow-hidden",
                    "transition-all duration-200",
                    isActive
                      ? "bg-[#5aabff] scale-105"
                      : "bg-[#7dc0ff] hover:bg-[#5aabff]"
                  )}
                >
                  <Image src="/icons/icon.png" alt="HomeArch" width={32} height={32} className="rounded-xl" />
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
              <motion.div whileTap={{ scale: 0.9 }} className="relative flex flex-col items-center gap-0.5">
                <Icon
                  className={clsx(
                    "h-5 w-5 transition-colors duration-200",
                    isActive ? "text-[#7dc0ff]" : "text-[var(--muted)]"
                  )}
                />
                <span
                  className={clsx(
                    "text-[10px] font-medium transition-colors duration-200",
                    isActive ? "text-[#7dc0ff]" : "text-[var(--muted)]"
                  )}
                >
                  {t(tab.key as "items" | "locations" | "home" | "favorites" | "settings")}
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
    </nav>
  );
}
