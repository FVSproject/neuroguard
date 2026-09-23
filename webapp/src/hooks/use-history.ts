"use client";

import { useEffect, useRef, useState } from "react";

import { useBleStore } from "@/stores/ble-store";
import type { CombinedPacket } from "@/lib/packet";
import type { MetricId } from "@/lib/types";

/**
 * Bracelet data older than this is shown as "stale · N s ago" and never
 * treated as a live reading. The hub keeps sending the last values for up
 * to 15 s so a short reconnect doesn't blank every card.
 */
export const BRACELET_STALE_SEC = 5;

/**
 * Extract a numeric value for the given metric from the latest packet.
 * Central place to map "our metric IDs" → "wire field names" so the rest
 * of the app doesn't have to know the packet shape. Returns null for
 * stale bracelet data so alarms and sparklines only ever see live values.
 */
export function readMetric(p: CombinedPacket, metric: MetricId): number | null {
  const br = p.braceletAgeSec > BRACELET_STALE_SEC ? null : p.bracelet;
  switch (metric) {
    case "hr":            return br?.hrBpm ?? null;
    case "spo2":          return br?.spo2Valid ? br.spo2Pct : null;
    case "rmssd":         return br?.rmssdMs ?? null;
    case "sdnn":          return br?.sdnnMs ?? null;
    case "suckRate":      return p.hub.sucksPerMin;
    case "breathRate":    return p.hub.estBreathsPerMin;
    case "apneaSec":      return p.hub.secondsSinceLastBreath;
    case "stillnessSec":  return br?.secondsSinceMovement ?? null;
    case "tempC":         return p.hub.ahtOk ? p.hub.tempC : null;
    case "rhPct":         return p.hub.ahtOk ? p.hub.rhPct : null;
    case "eco2":          return p.hub.ensOk ? p.hub.eco2Ppm : null;
    case "tvoc":          return p.hub.ensOk ? p.hub.tvocPpb : null;
    case "aqi":           return p.hub.ensOk ? p.hub.aqi : null;
  }
}

const HISTORY_LEN = 30;   // ~30 s of samples at 1 Hz — matches sparkline width

/**
 * Keeps a rolling per-metric history buffer synced to the latest packet.
 * Buffers live in a ref (no re-render each write) and we notify subscribers
 * via a version bump only when a metric they care about actually changes.
 */
export function useMetricHistory(metrics: readonly MetricId[]): Record<MetricId, number[]> {
  const bufRef = useRef<Record<string, number[]>>({});
  const [, force] = useState(0);

  useEffect(() => {
    // Prime the buffers.
    for (const m of metrics) {
      if (!bufRef.current[m]) bufRef.current[m] = [];
    }
    const unsub = useBleStore.subscribe((s) => s.lastPacket, (packet) => {
      if (!packet) return;
      let touched = false;
      for (const m of metrics) {
        const v = readMetric(packet, m);
        if (v === null || v === undefined || Number.isNaN(v)) continue;
        const arr = bufRef.current[m] ?? (bufRef.current[m] = []);
        arr.push(v);
        if (arr.length > HISTORY_LEN) arr.splice(0, arr.length - HISTORY_LEN);
        touched = true;
      }
      if (touched) force((v) => v + 1);
    });
    return unsub;
  }, [metrics]);

  return bufRef.current as Record<MetricId, number[]>;
}
