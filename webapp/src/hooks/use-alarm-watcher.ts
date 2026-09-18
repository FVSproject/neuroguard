"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createElement } from "react";

import { db } from "@/lib/db";
import { evaluate } from "@/lib/thresholds";
import { playAlarm, stopAlarm } from "@/lib/alarm";
import { AlarmToast, type AlarmToastLevel } from "@/components/alarm/alarm-toast";
import { useAlarmStore } from "@/stores/alarm-store";
import { useBabyStore } from "@/stores/baby-store";
import { useBleStore } from "@/stores/ble-store";
import { useUiStore } from "@/stores/ui-store";
import { useThresholds } from "./use-thresholds";
import { readMetric } from "./use-history";
import type { AlarmPrefs, LogEntry } from "@/lib/types";
import type { MetricId } from "@/lib/types";
import type { CombinedPacket } from "@/lib/packet";

// Same set of metrics the dashboard renders — the watcher stays in sync.
const METRICS: readonly MetricId[] = [
  "hr", "spo2", "rmssd", "suckRate", "breathRate",
  "apneaSec", "stillnessSec", "tempC", "rhPct", "eco2",
] as const;

const METRIC_LABEL_KEY: Record<MetricId, string> = {
  hr:           "sensor.hr",
  spo2:         "sensor.spo2",
  rmssd:        "sensor.hrv",
  sdnn:         "sensor.hrv",
  suckRate:     "sensor.suck",
  breathRate:   "sensor.breath",
  apneaSec:     "sensor.breath",
  stillnessSec: "sensor.motion",
  tempC:        "sensor.temp",
  rhPct:        "sensor.humidity",
  eco2:         "sensor.eco2",
  tvoc:         "sensor.tvoc",
  aqi:          "sensor.eco2",
};

/**
 * Mount once at the app-shell layout. On every BLE packet:
 *   1. Compute each metric's current state
 *   2. If the state changed, push it into the alarm store
 *   3. If the new state is warn / alert / critical, surface a Sonner toast
 *   4. Escalate audio according to per-baby alarm prefs
 *   5. Persist a LogEntry to IndexedDB so the Logs tab keeps a record
 */
export function useAlarmWatcher() {
  const t = useTranslations();
  const babyId = useBabyStore((s) => s.currentBabyId);
  const thresholds = useThresholds(babyId);
  const observe = useAlarmStore((s) => s.observe);
  const alarmSilenced = useUiStore((s) => s.alarmSilenced);

  // Cache the per-baby alarm prefs once — the settings page updates via a
  // different code path that also flips this ref, so we don't need to refetch
  // on every packet.
  const prefsRef = useRef<AlarmPrefs | null>(null);
  useEffect(() => {
    if (!babyId) return;
    let cancelled = false;
    (async () => {
      const p = await db().alarmPrefs.get(babyId);
      if (!cancelled) prefsRef.current = p ?? null;
    })();
    return () => { cancelled = true; };
  }, [babyId]);

  useEffect(() => {
    if (!babyId) return;
    const unsub = useBleStore.subscribe(
      (s) => s.lastPacket,
      (packet) => onPacket(packet),
    );

    function onPacket(p: CombinedPacket | null) {
      if (!p) return;
      let highest: "ok" | "watch" | "alert" | "critical" | "stale" | "off" = "ok";
      for (const metric of METRICS) {
        const cfg = thresholds[metric];
        const v = readMetric(p, metric);
        const state = evaluate(v, cfg);
        const changed = observe(metric, state, v);
        if (changed === "changed" && (state === "alert" || state === "critical" || state === "watch")) {
          const label = t(METRIC_LABEL_KEY[metric] as never);
          const msg = t("notification.thresholdBreached", { metric: label });
          const level: AlarmToastLevel =
            state === "critical" ? "critical" :
            state === "alert"    ? "alert" :
                                   "watch";
          toast.custom((id) =>
            createElement(AlarmToast, {
              id,
              level,
              title: msg,
              detail: v !== null ? `${v.toFixed(1)}` : undefined,
              metricLabel: label,
            }),
            {
              duration: state === "critical" ? 20_000 : state === "alert" ? 10_000 : 5_000,
            },
          );

          const entry: LogEntry = {
            babyId: babyId!,
            tsMs: Date.now(),
            kind: state === "critical" || state === "alert" ? "alarm" : "threshold",
            metric,
            severity:
              state === "critical" ? "critical" :
              state === "alert"    ? "alert" :
                                     "warn",
            message: msg,
            value: v ?? undefined,
          };
          void db().logs.add(entry);
        }
        // Track the "worst" state so we know what sound to play.
        const order = { off: 0, stale: 1, ok: 2, watch: 3, alert: 4, critical: 5 } as const;
        if (order[state] > order[highest]) highest = state;
      }

      // Audio escalation. Snoozed / silenced → no sound.
      if (alarmSilenced) { stopAlarm(); return; }
      const prefs = prefsRef.current;
      if (!prefs || !prefs.soundEnabled) { stopAlarm(); return; }

      if (highest === "critical") {
        playAlarm("siren", prefs.volume);
      } else if (highest === "alert") {
        playAlarm(prefs.soundName, prefs.volume);
      } else {
        stopAlarm();
      }
    }

    return () => {
      unsub();
      stopAlarm();
    };
  }, [babyId, thresholds, observe, alarmSilenced, t]);
}
