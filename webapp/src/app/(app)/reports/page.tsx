"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { packetsSince } from "@/lib/packet-db";
import { useBabyStore } from "@/stores/baby-store";
import type { PacketRecord } from "@/lib/types";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

type Stats = {
  n: number;
  min?: number;
  max?: number;
  mean?: number;
};

function stats(rows: PacketRecord[], key: keyof PacketRecord): Stats {
  const values = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!values.length) return { n: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    n: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: sum / values.length,
  };
}

function Metric({ label, unit, s }: { label: string; unit: string; s: Stats }) {
  const t = useTranslations("reports");
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="tabular text-2xl font-semibold">
          {s.mean !== undefined ? s.mean.toFixed(1) : "—"}
        </div>
        <div className="text-xs text-muted">{t("avg")} {unit}</div>
      </div>
      <div className="mt-1 text-xs text-muted">
        {s.n > 0 ? (
          <>
            {t("min")} <span className="tabular font-medium">{s.min?.toFixed(1)}</span> ·
            {" "}{t("max")} <span className="tabular font-medium">{s.max?.toFixed(1)}</span> ·
            {" "}{t("samples")} {s.n}
          </>
        ) : (
          t("noData")
        )}
      </div>
    </div>
  );
}

function ReportPane({ babyId, windowMs }: { babyId: string; windowMs: number }) {
  const t = useTranslations();
  const [rows, setRows] = useState<PacketRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cutoff = Date.now() - windowMs;
      try {
        const r = await packetsSince(babyId, cutoff);
        if (!cancelled) setRows(r);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [babyId, windowMs]);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">{t("reports.empty")}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Metric label={t("sensor.hr")}     unit={t("sensor.hrUnit")}       s={stats(rows, "hr")} />
      <Metric label={t("sensor.spo2")}   unit={t("sensor.spo2Unit")}     s={stats(rows, "spo2")} />
      <Metric label={t("sensor.hrv")}    unit={t("sensor.hrvUnit")}      s={stats(rows, "rmssd")} />
      <Metric label={t("sensor.suck")}   unit={t("sensor.suckUnit")}     s={stats(rows, "suckRate")} />
      <Metric label={t("sensor.breath")} unit={t("sensor.breathUnit")}   s={stats(rows, "breathRate")} />
      <Metric label={t("sensor.motion")} unit={t("sensor.motionUnit")}   s={stats(rows, "activityG")} />
      <Metric label={t("sensor.temp")}   unit={t("sensor.tempUnit")}     s={stats(rows, "tempC")} />
      <Metric label={t("sensor.humidity")} unit={t("sensor.humidityUnit")} s={stats(rows, "rhPct")} />
      <Metric label={t("sensor.eco2")}   unit={t("sensor.eco2Unit")}     s={stats(rows, "eco2")} />
    </div>
  );
}

export default function ReportsPage() {
  const t = useTranslations();
  const babyId = useBabyStore((s) => s.currentBabyId);

  const summary = useMemo(() => {
    if (!babyId) return null;
    return (
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">{t("reports.daily")}</TabsTrigger>
          <TabsTrigger value="weekly">{t("reports.weekly")}</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <ReportPane babyId={babyId} windowMs={ONE_DAY} />
        </TabsContent>
        <TabsContent value="weekly">
          <ReportPane babyId={babyId} windowMs={ONE_WEEK} />
        </TabsContent>
      </Tabs>
    );
  }, [babyId, t]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("reports.subtitle")}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t("reports.summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          {babyId ? summary : (
            <p className="py-6 text-sm text-muted">{t("landing.noBaby")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
