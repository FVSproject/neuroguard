"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const LABEL_KEY: Record<Locale, "english" | "arabic"> = {
  en: "english",
  ar: "arabic",
};

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("language");
  const active = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const pick = (next: Locale) => {
    if (next === active) return;
    // 1 year cookie so parents don't have to re-pick every session.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("label")}
          disabled={pending}
          className={cn("gap-2", className)}
        >
          <Languages className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t(LABEL_KEY[active])}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => pick(code)}
            className={cn(
              "cursor-pointer",
              code === active && "font-semibold text-brand",
            )}
          >
            {t(LABEL_KEY[code])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
