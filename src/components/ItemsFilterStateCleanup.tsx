"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ItemsFilterStateCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/items" || /^\/items\/[^/]+(?:\/edit)?$/.test(pathname)) return;
    window.sessionStorage.removeItem("items-filter-state");
    window.sessionStorage.removeItem("items-return-from-detail");
    window.sessionStorage.removeItem("items-scroll-state");
  }, [pathname]);

  return null;
}
