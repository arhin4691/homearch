"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Notifications are now shown via the bell icon modal.
export default function NotificationsPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
