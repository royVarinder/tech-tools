import { defineRouting } from "next-intl/routing";

export const locales = ["en", "hin", "pun"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  hin: "हिंदी",
  pun: "ਪੰਜਾਬੀ",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
});
