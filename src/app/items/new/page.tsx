"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewItemRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/items?new=1"); }, [router]);
  return null;
}

