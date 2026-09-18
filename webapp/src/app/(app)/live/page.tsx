"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Heart, Activity, Wind, Thermometer, Droplet, Wind as Air, BabyIcon, Bluetooth, RadioTower } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SensorCard } from "@/components/sensor/sensor-card";
import { PacifierIcon } from "@/components/icons/pacifier";
import { useBleStore } from "@/stores/ble-store";
import { useBabyStore } from "@/stores/baby-store";
import { useUiStore } from "@/stores/ui-store";
import { useBle } from "@/hooks/use-ble";
import { useThresholds } from "@/hooks/use-thresholds";
import { useMetricHistory, readMetric } from "@/hooks/use-history";
import { evaluate } from "@/lib/thresholds";
import type { MetricId } from "@/lib/types";

const METRICS = ["hr", "spo2", "rmssd", "suckRate", "breathRate", "apneaSec", "stillnessSec", "tempC", "rhPct", "eco2"] as const;

function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}

export default function LivePage() {
  const t = useTranslations();
  const hydrated = useBabyStore((s) => s.hydrated);
  const hydrate  = useBabyStore((s) => s.hydrate);
  const currentId = useBabyStore((s) => s.currentBabyId);
  const babies = useBabyStore((s) => s.babies);
  const current = babies.find((b) => b.id === currentId);

  const status = useBleStore((s) => s.status);
  const packet = useBleStore((s) => s.lastPacket);
  const { connect, disconnect, mockEnabled } = useBle();
  const setMock = useUiStore((s) => s.setMockStream);

  const thresholds = useThresholds(currentId);
  const history = useMetricHistory(METRICS);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // Fresh values per metric for the current render
  const values = useMemo(() => {
    if (!packet) return {} as Record<MetricId, number | null>;
    return Object.fromEntries(METRICS.map((m) => [m, readMetric(packet, m)])) as Record<
      MetricId, number | null
    >;
  }, [packet]);

  // ---- empty states ----------------------------------------------------
  if (!hydrated) return <div className="h-64 animate-pulse rounded-lg bg-surface-2" />;

  return (
    <div className="space-y-6">
      {/* --- header --- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("nav.live")}</h1>
          <p className="mt-1 text-sm text-muted">
            {current
              ? current.name
              : t("landing.noBaby")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
            <Switch id="mock" checked={mockEnabled} onCheckedChange={setMock} />
            <Label htmlFor="mock" className="cursor-pointer text-xs font-medium text-muted">
              {t("landing.mockStream")}
            </Label>
          </div>
          {status === "connected" ? (
            <Button variant="outline" size="sm" onClick={disconnect} className="gap-2">
              <RadioTower className="size-4" aria-hidden />
              {t("landing.disconnect")}
            </Button>
          ) : (
            <Button size="sm" onClick={connect} className="gap-2">
              <Bluetooth className="size-4" aria-hidden />
              {status === "connecting" ? t("landing.connecting") : t("landing.connect")}
            </Button>
          )}
        </div>
      </div>

      {!current ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BabyIcon className="size-8 text-muted" aria-hidden />
            <p className="max-w-md text-sm text-muted">{t("landing.noBaby")}</p>
            <Button asChild size="sm">
              <Link href="/profile/new">{t("baby.add")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* --- unified grid: all 10 sensors, one view, no scroll on desktop.
          Card icon colour signals the source (danger = cardiac, brand = hub /
          respiratory / env, accent = bracelet motion), so we don't need
          separate section headers eating vertical space. --- */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <SensorCard
          title={t("sensor.hr")}
          icon={<Heart className="size-3.5 text-danger" aria-hidden />}
          value={fmt(values.hr)}
          unit={t("sensor.hrUnit")}
          state={evaluate(values.hr, thresholds.hr)}
          cfg={thresholds.hr}
          history={history.hr}
          extra={
            packet?.bracelet?.hrSrc === 2 ? t("sensor.hrSourceAlgo") :
            packet?.bracelet?.hrSrc === 1 ? t("sensor.hrSourceBeat") :
            undefined
          }
        />
        <SensorCard
          title={t("sensor.spo2")}
          icon={<Droplet className="size-3.5 text-brand" aria-hidden />}
          value={fmt(values.spo2)}
          unit={t("sensor.spo2Unit")}
          state={evaluate(values.spo2, thresholds.spo2)}
          cfg={thresholds.spo2}
          history={history.spo2}
        />
        <SensorCard
          title={t("sensor.hrv")}
          icon={<Activity className="size-3.5 text-brand" aria-hidden />}
          value={fmt(values.rmssd, 1)}
          unit={t("sensor.hrvUnit")}
          state={evaluate(values.rmssd, thresholds.rmssd)}
          cfg={thresholds.rmssd}
          history={history.rmssd}
        />
        <SensorCard
          title={t("sensor.stillness")}
          icon={<Activity className="size-3.5 text-accent" aria-hidden />}
          value={fmt(values.stillnessSec)}
          unit={t("sensor.stillnessUnit")}
          state={evaluate(values.stillnessSec, thresholds.stillnessSec)}
          cfg={thresholds.stillnessSec}
          history={history.stillnessSec}
        />
        <SensorCard
          title={t("sensor.suck")}
          icon={<PacifierIcon className="size-3.5 text-brand" aria-hidden />}
          value={fmt(values.suckRate)}
          unit={t("sensor.suckUnit")}
          state={evaluate(values.suckRate, thresholds.suckRate)}
          cfg={thresholds.suckRate}
          history={history.suckRate}
        />
        <SensorCard
          title={t("sensor.breath")}
          icon={<Wind className="size-3.5 text-brand" aria-hidden />}
          value={fmt(values.breathRate)}
          unit={t("sensor.breathUnit")}
          state={evaluate(values.breathRate, thresholds.breathRate)}
          cfg={thresholds.breathRate}
          history={history.breathRate}
        />
        <SensorCard
          title={t("sensor.apnea")}
          icon={<Wind className="size-3.5 text-danger" aria-hidden />}
          value={fmt(values.apneaSec)}
          unit={t("sensor.stillnessUnit")}
          state={evaluate(values.apneaSec, thresholds.apneaSec)}
          cfg={thresholds.apneaSec}
          history={history.apneaSec}
        />
        <SensorCard
          title={t("sensor.temp")}
          icon={<Thermometer className="size-3.5 text-accent" aria-hidden />}
          value={fmt(values.tempC, 1)}
          unit={t("sensor.tempUnit")}
          state={evaluate(values.tempC, thresholds.tempC)}
          cfg={thresholds.tempC}
          history={history.tempC}
        />
        <SensorCard
          title={t("sensor.humidity")}
          icon={<Droplet className="size-3.5 text-brand" aria-hidden />}
          value={fmt(values.rhPct, 0)}
          unit={t("sensor.humidityUnit")}
          state={evaluate(values.rhPct, thresholds.rhPct)}
          cfg={thresholds.rhPct}
          history={history.rhPct}
        />
        <SensorCard
          title={t("sensor.eco2")}
          icon={<Air className="size-3.5 text-brand" aria-hidden />}
          value={fmt(values.eco2)}
          unit={t("sensor.eco2Unit")}
          state={evaluate(values.eco2, thresholds.eco2)}
          cfg={thresholds.eco2}
          history={history.eco2}
        />
      </div>
    </div>
  );
}
