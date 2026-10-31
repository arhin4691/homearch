"use client";

import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("nav");
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* {mobileOpen && <button aria-label={t("closeSidebar")} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />} */}
      <Sidebar desktopCollapsed={desktopCollapsed} mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        onClose={() => {
          if (mobileOpen) setMobileOpen(false);
          else setDesktopCollapsed(true);
        }} />
      {/* <div className="px-4 pt-2 lg:hidden">
        <button aria-label={t("openSidebar")} onClick={() => setMobileOpen(true)} className="rounded-xl p-2">
          <Menu className="h-5 w-5" />
        </button>
      </div> */}
      {/* {desktopCollapsed && (
        <button aria-label={t("openSidebar")} onClick={() => setDesktopCollapsed(false)} className="fixed left-3 top-3 z-30 hidden rounded-xl bg-[var(--card)] p-2 lg:block">
          <Menu className="h-5 w-5" />
        </button>
      )} */}

      <div className={desktopCollapsed ? "" : "lg:pl-64"}>
        <main className="max-w-5xl mx-auto px-4 pt-2 pb-32 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />
    </div>
  );
}
