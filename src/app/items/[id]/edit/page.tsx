"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditItemRedirect() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  useEffect(() => { router.replace(`/items/${id}?edit=1`); }, [router, id]);
  return null;
}

