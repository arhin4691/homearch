"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Package, MapPin, Heart, Settings, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { clsx } from "clsx";

const navItems = [
  { href: "/", icon: Home, key: "home", exact: true },
  { href: "/items", icon: Package, key: "items" },
  { href: "/locations", icon: MapPin, key: "locations" },
  { href: "/favorites", icon: Heart, key: "favorites" },
  { href: "/settings", icon: Settings, key: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const { user } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-[var(--card)] border-r border-[var(--card-border)] z-40 py-6 px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-2 mb-8 group">
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-[#7dc0ff]/30 group-hover:shadow-[#7dc0ff]/50 transition-shadow">
          <Image src="/icons/icon.png" alt="HomeArch" width={36} height={36} className="w-full h-full object-cover" />
        </div>
        <span className="text-lg font-bold text-[var(--foreground)]">HomeArch</span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#7dc0ff]/10 text-[#7dc0ff]"
                  : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{t(item.key as "home" | "items" | "locations" | "favorites" | "settings")}</span>
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#7dc0ff]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Add item CTA */}
      {user?.familyId && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/items/new")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-[#7dc0ff] text-white text-sm font-semibold hover:bg-[#5aabff] transition-colors shadow-md shadow-[#7dc0ff]/30"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </motion.button>
      )}

      {/* User profile */}
      {user && (
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--background)] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#7dc0ff]/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#7dc0ff]">
            {user.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">{user.name}</p>
            <p className="text-xs text-[var(--muted)] truncate">{user.email}</p>
          </div>
        </Link>
      )}
    </aside>
  );
}
