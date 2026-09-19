import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";

import { LOCALE_DIR, type Locale } from "@/i18n/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NeuroGuard — Smart Pacifier",
    template: "%s · NeuroGuard",
  },
  description: "Live infant vitals from the NeuroGuard smart pacifier and foot bracelet.",
  applicationName: "NeuroGuard",
  appleWebApp: { capable: true, title: "NeuroGuard", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4a7c8c" },
    { media: "(prefers-color-scheme: dark)",  color: "#06304a" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = LOCALE_DIR[locale] ?? "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${cairo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton={false}
            expand={false}
            visibleToasts={5}
            offset={16}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
