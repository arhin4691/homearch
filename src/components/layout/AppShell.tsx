import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "@/components/ui/NotificationBell";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Desktop sidebar — visible lg+ only */}
      <Sidebar />

      {/* Main content — offset on desktop, full width on mobile */}
      <div className="lg:pl-64">
        <main className="max-w-5xl mx-auto px-4 pt-2 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />
    </div>
  );
}
