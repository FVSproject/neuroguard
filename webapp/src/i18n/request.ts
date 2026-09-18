import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(raw ?? "")
    ? (raw as Locale)
    : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
