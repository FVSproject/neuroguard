"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, BabyIcon, Plus, UserPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBabyStore } from "@/stores/baby-store";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function BabyPill({ className }: { className?: string }) {
  const t = useTranslations("baby");
  const hydrated = useBabyStore((s) => s.hydrated);
  const babies = useBabyStore((s) => s.babies);
  const currentId = useBabyStore((s) => s.currentBabyId);
  const setCurrent = useBabyStore((s) => s.setCurrent);
  const hydrate = useBabyStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const current = babies.find((b) => b.id === currentId);

  if (!hydrated) {
    return <div className={cn("h-9 w-32 animate-pulse rounded-full bg-surface-2", className)} />;
  }

  if (!current) {
    return (
      <Button asChild size="sm" variant="outline" className={cn("gap-2 rounded-full", className)}>
        <Link href="/profile/new">
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pe-3 ps-1.5 shadow-sm transition hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            className,
          )}
          aria-label={t("switch")}
        >
          <Avatar className="size-7">
            {current.photoDataUrl ? (
              <AvatarImage src={current.photoDataUrl} alt={current.name} />
            ) : null}
            <AvatarFallback className="bg-brand-soft text-xs font-semibold text-brand">
              {initials(current.name)}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[8rem] truncate text-sm font-medium">
            {current.name}
          </span>
          <ChevronDown className="size-4 text-muted" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel>{t("switch")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {babies.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => setCurrent(b.id)}
            className={cn(
              "cursor-pointer gap-2",
              b.id === currentId && "bg-brand-soft/60 font-semibold text-brand",
            )}
          >
            <Avatar className="size-6">
              {b.photoDataUrl ? <AvatarImage src={b.photoDataUrl} alt={b.name} /> : null}
              <AvatarFallback className="bg-brand-soft text-[10px] font-semibold text-brand">
                {initials(b.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{b.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/profile/new">
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/profile">
            <BabyIcon className="size-4" aria-hidden />
            {t("edit")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/settings">
            <UserPen className="size-4" aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
