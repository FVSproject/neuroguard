"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Activity, User, ScrollText, FileText, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function useNavItems(): NavItem[] {
  const t = useTranslations("nav");
  return [
    { href: "/live",     label: t("live"),     icon: Activity },
    { href: "/profile",  label: t("profile"),  icon: User },
    { href: "/logs",     label: t("logs"),     icon: ScrollText },
    { href: "/reports",  label: t("reports"),  icon: FileText },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];
}

/**
 * Desktop sidebar — vertical rail. Mobile users get a bottom nav instead
 * (see `<BottomNav />` below). Both use the same nav item list.
 */
export function Sidebar() {
  const items = useNavItems();
  const pathname = usePathname();

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-e border-border/60 bg-surface/50 lg:block">
      <nav className="flex flex-col gap-1 p-3">
        {items.map((it) => {
          const active = pathname?.startsWith(it.href) ?? false;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "group inline-flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-brand-soft text-brand"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon
                className={cn(
                  "size-4",
                  active ? "text-brand" : "text-muted group-hover:text-ink",
                )}
                aria-hidden
              />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * Mobile bottom nav — sits fixed at the bottom of the viewport. Uses the
 * same nav items but shows the icon prominent, label small.
 */
export function BottomNav() {
  const items = useNavItems();
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-surface/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch">
        {items.map((it) => {
          const active = pathname?.startsWith(it.href) ?? false;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-brand" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
