// @ts-nocheck
import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api-response";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", "", { maxAge: 0, path: "/" });
  return apiSuccess({ message: "Logged out" });
}

