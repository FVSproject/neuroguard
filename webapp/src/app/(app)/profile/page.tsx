"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { BabyIcon, Plus, Pencil } from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBabyStore } from "@/stores/baby-store";

function initials(name: string) {
  return (name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")) || "?";
}

export default function ProfilePage() {
  const t = useTranslations();
  const hydrated = useBabyStore((s) => s.hydrated);
  const hydrate = useBabyStore((s) => s.hydrate);
  const babies = useBabyStore((s) => s.babies);
  const currentId = useBabyStore((s) => s.currentBabyId);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const current = babies.find((b) => b.id === currentId);

  if (!hydrated) return <div className="h-32 animate-pulse rounded-lg bg-surface-2" />;

  if (!current) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
            <BabyIcon className="size-7" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("landing.noBaby")}</h2>
          </div>
          <Button asChild className="gap-2">
            <Link href="/profile/new">
              <Plus className="size-4" aria-hidden />
              {t("baby.add")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar className="size-16">
            {current.photoDataUrl ? <AvatarImage src={current.photoDataUrl} alt="" /> : null}
            <AvatarFallback className="bg-brand-soft text-lg font-semibold text-brand">
              {initials(current.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-2xl">{current.name}</CardTitle>
            {current.dob ? (
              <p className="text-sm text-muted">{current.dob}</p>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/profile/edit">
              <Pencil className="size-4" aria-hidden />
              {t("baby.edit")}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          {current.weightKg ? <div><span className="text-muted">Weight: </span>{current.weightKg} kg</div> : null}
          {current.heightCm ? <div><span className="text-muted">Height: </span>{current.heightCm} cm</div> : null}
          {current.gender ? <div><span className="text-muted">Gender: </span>{current.gender}</div> : null}
          {current.notes ? (
            <div className="sm:col-span-2">
              <span className="text-muted">Notes: </span>
              {current.notes}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
