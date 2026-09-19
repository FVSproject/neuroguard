"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Activity, Wind, Thermometer, Droplet, Wind as Air, BabyIcon, Bluetooth, RadioTower } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SensorCard } from "@/components/sensor/sensor-card";
import { MicLevel } from "@/components/sensor/mic-level";
import { FsrLevel } from "@/components/sensor/fsr-level";
import { PacifierIcon } from "@/components/icons/pacifier";
import { useBleStore } from "@/stores/ble-store";
import { useBabyStore } from "@/stores/baby-store";
import { useUiStore } from "@/stores/ui-store";
import { useBle } from "@/hooks/use-ble";
import { useThresholds } from "@/hooks/use-thresholds";
import { useMetricHistory, readMetric } from "@/hooks/use-history";
import { evaluate, type MetricState } from "@/lib/thresholds";
import { isMetricReady, secondsUntilReady } from "@/lib/readiness";
import type { MetricId } from "@/lib/types";

const METRICS = ["hr", "spo2", "rmssd", "suckRate", "breathRate", "apneaSec", "stillnessSec", "tempC", "rhPct", "eco2"] as const;

// Metrics that come from the foot bracelet — if the bracelet isn't linked
// (or its last packet is more than a few seconds stale), we want the cards
// to say "Sensor off" or "Stale — 12 s" instead of a stale numeric reading.
const BRACELET_METRICS = new Set<MetricId>(["hr", "spo2", "rmssd", "sdnn", "stillnessSec"]);
const BRACELET_STALE_SEC = 5;

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
  const sessionStartMs = useBleStore((s) => s.sessionStartMs);
  const { connect, disconnect, mockEnabled } = useBle();
  const setMock = useUiStore((s) => s.setMockStream);

  const thresholds = useThresholds(currentId);
  const history = useMetricHistory(METRICS);

  // 1 Hz tick so the "Warming up · N s" countdown ticks down even when no
  // packet has arrived. Cheap — one setState per second.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

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

  /**
   * Compute the display state for a metric. Priority order:
   *   1. Bracelet metric with no linked bracelet → "off" (Sensor off).
   *   2. Bracelet metric with stale link (> 5 s since last update) → "stale"
   *      with age hint. Distinct from "warming up" — the metric IS ready,
   *      the wireless link is just flaky.
   *   3. Still inside the warmup window → "warmingUp" + seconds-remaining.
   *   4. Otherwise → evaluate() against the (auto-scaled) threshold band.
   */
  function stateFor(metric: MetricId): { state: MetricState; extra?: string } {
    if (BRACELET_METRICS.has(metric)) {
      if (!packet || !packet.braceletLinked) {
        return { state: "off" };
      }
      if (packet.braceletAgeSec > BRACELET_STALE_SEC) {
        return { state: "stale", extra: `${packet.braceletAgeSec}s ago` };
      }
    }
    if (!isMetricReady(metric, sessionStartMs, nowMs)) {
      const sec = secondsUntilReady(metric, sessionStartMs, nowMs);
      return { state: "warmingUp", extra: sec > 0 ? `${sec}s` : undefined };
    }
    return { state: evaluate(values[metric], thresholds[metric]) };
  }

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
        {(() => {
          const cards: Array<{
            metric: MetricId;
            title: React.ReactNode;
            icon: React.ReactNode;
            unit: string;
            digits?: number;
          }> = [
            { metric: "hr",           title: t("sensor.hr"),        icon: <Heart       className="size-3.5 text-danger"   aria-hidden />, unit: t("sensor.hrUnit") },
            { metric: "spo2",         title: t("sensor.spo2"),      icon: <Droplet     className="size-3.5 text-brand"    aria-hidden />, unit: t("sensor.spo2Unit") },
            { metric: "rmssd",        title: t("sensor.hrv"),       icon: <Activity    className="size-3.5 text-brand"    aria-hidden />, unit: t("sensor.hrvUnit"),      digits: 1 },
            { metric: "stillnessSec", title: t("sensor.stillness"), icon: <Activity    className="size-3.5 text-accent"   aria-hidden />, unit: t("sensor.stillnessUnit") },
            { metric: "suckRate",     title: t("sensor.suck"),      icon: <PacifierIcon className="size-3.5 text-brand"    aria-hidden />, unit: t("sensor.suckUnit") },
            { metric: "breathRate",   title: t("sensor.breath"),    icon: <Wind        className="size-3.5 text-brand"    aria-hidden />, unit: t("sensor.breathUnit") },
            { metric: "apneaSec",     title: t("sensor.apnea"),     icon: <Wind        className="size-3.5 text-danger"   aria-hidden />, unit: t("sensor.stillnessUnit") },
            { metric: "tempC",        title: t("sensor.temp"),      icon: <Thermometer className="size-3.5 text-accent"   aria-hidden />, unit: t("sensor.tempUnit"),     digits: 1 },
            { metric: "rhPct",        title: t("sensor.humidity"),  icon: <Droplet     className="size-3.5 text-brand"    aria-hidden />, unit: t("sensor.humidityUnit") },
            { metric: "eco2",         title: t("sensor.eco2"),      icon: <Air         className="size-3.5 text-brand"    aria-hidden />, unit: t("sensor.eco2Unit") },
          ];
          return cards.map(({ metric, title, icon, unit, digits }) => {
            const { state, extra } = stateFor(metric);
            const hrExtra =
              metric === "hr" && !extra
                ? (packet?.bracelet?.hrSrc === 2 ? t("sensor.hrSourceAlgo") :
                   packet?.bracelet?.hrSrc === 1 ? t("sensor.hrSourceBeat") :
                   undefined)
                : extra;
            // Raw-sensor verification strips under the two derived-rate
            // cards. Lets the parent watch the amplitude cross the firmware
            // trigger tick before trusting the aggregated rate.
            const belowValue =
              metric === "breathRate" ? <MicLevel pkpk={packet?.hub.micPkpkNow} eventsPerMin={packet?.hub.respEventsPerMin} /> :
              metric === "suckRate"   ? <FsrLevel pct={packet?.hub.fsrPctNow} /> :
              undefined;
            return (
              <SensorCard
                key={metric}
                title={title}
                icon={icon}
                value={fmt(values[metric], digits ?? 0)}
                unit={unit}
                state={state}
                cfg={thresholds[metric]}
                history={history[metric]}
                extra={hrExtra}
                belowValue={belowValue}
              />
            );
          });
        })()}
      </div>
    </div>
  );
}
