import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "zh-HK"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const messageMap: Record<string, () => Promise<any>> = {
  en: () => import("../../messages/en.json"),
  "zh-HK": () => import("../../messages/zh-HK.json"),
};

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const locale =
    localeCookie && locales.includes(localeCookie as Locale)
      ? (localeCookie as Locale)
      : defaultLocale;

  const messages = (await messageMap[locale]()).default;

  return { locale, messages };
});
