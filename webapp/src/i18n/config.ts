// Client-safe locale constants. Kept in its own file so it doesn't drag
// `next/headers` into the client bundle (that would break the Turbopack
// build for anything under `"use client"`).

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ng.locale";

export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};
