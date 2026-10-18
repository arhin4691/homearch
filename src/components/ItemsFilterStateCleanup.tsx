"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ItemsFilterStateCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/items" || /^\/items\/[^/]+$/.test(pathname)) return;
    window.sessionStorage.removeItem("items-filter-state");
    window.sessionStorage.removeItem("items-return-from-detail");
  }, [pathname]);

  return null;
}
