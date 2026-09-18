import type { MetricId, ThresholdConfig } from "./types";

/**
 * Default per-metric thresholds for a healthy term infant. These are BENCH
 * defaults — they are not clinical guidance and every baby's profile has to
 * be reviewed by whoever is caring for the infant before the alarm engine
 * fires on any of them.
 *
 * Values in double comments beside each threshold cite the range they were
 * derived from (mostly Nelson Textbook of Pediatrics / AAP monitoring
 * guidance) so a caregiver knows what to change.
 */
export const DEFAULT_THRESHOLDS: Record<MetricId, ThresholdConfig> = {
  //                                                       min   max   criticalMin  criticalMax  dwellSec
  hr:           { metric: "hr",           enabled: true,  min: 90,   max: 180,  criticalMin: 70,  criticalMax: 220, dwellSec: 10 }, // AAP: term infant 90–180 awake
  spo2:         { metric: "spo2",         enabled: true,  min: 92,               criticalMin: 88,                     dwellSec: 15 }, // desaturation < 92 %
  rmssd:        { metric: "rmssd",        enabled: false, min: 15,   max: 120 },                                                     // informational only
  sdnn:         { metric: "sdnn",         enabled: false, min: 20,   max: 150 },
  suckRate:     { metric: "suckRate",     enabled: false, min: 30,   max: 120 },                                                     // NNS descriptive
  breathRate:   { metric: "breathRate",   enabled: true,  min: 20,   max: 60,   criticalMin: 15,  criticalMax: 80,  dwellSec: 15 }, // AAP: term 30–60
  apneaSec:     { metric: "apneaSec",     enabled: true,             max: 10,                     criticalMax: 20,  dwellSec: 0  }, // > 10 s bench, > 20 s clinical
  stillnessSec: { metric: "stillnessSec", enabled: true,             max: 120,                    criticalMax: 300, dwellSec: 0  },
  tempC:        { metric: "tempC",        enabled: true,  min: 18,   max: 24,   criticalMin: 15,  criticalMax: 27,  dwellSec: 60 }, // AAP nursery: 16–20 °C safe range
  rhPct:        { metric: "rhPct",        enabled: true,  min: 30,   max: 60,   criticalMin: 20,  criticalMax: 75,  dwellSec: 60 },
  eco2:         { metric: "eco2",         enabled: true,             max: 1200,                   criticalMax: 2500, dwellSec: 60 }, // outdoor ~400 ppm
  tvoc:         { metric: "tvoc",         enabled: false,            max: 300,                    criticalMax: 1000 },
  aqi:          { metric: "aqi",          enabled: true,             max: 3,                      criticalMax: 4,   dwellSec: 30 }, // ENS160 AQI 1..5
};

export function defaultThresholdsList(): ThresholdConfig[] {
  return Object.values(DEFAULT_THRESHOLDS).map((t) => ({ ...t }));
}

// -- Runtime state derivation ----------------------------------------------

export type MetricState = "ok" | "watch" | "alert" | "critical" | "stale" | "off";

/**
 * Given the current value + configured thresholds, return which state the
 * metric is in. `null` values collapse to "stale" so a card can render an
 * appropriate no-data affordance.
 */
export function evaluate(
  value: number | null | undefined,
  cfg?: ThresholdConfig,
): MetricState {
  if (value === null || value === undefined || Number.isNaN(value)) return "stale";
  if (!cfg || !cfg.enabled) return "ok";

  const critLo = cfg.criticalMin;
  const critHi = cfg.criticalMax;
  const lo = cfg.min;
  const hi = cfg.max;

  if ((critLo !== undefined && value < critLo) || (critHi !== undefined && value > critHi)) {
    return "critical";
  }
  if ((lo !== undefined && value < lo) || (hi !== undefined && value > hi)) {
    return "alert";
  }
  // "watch" band = within 10 % of a soft bound
  if (lo !== undefined && value < lo * 1.1) return "watch";
  if (hi !== undefined && value > hi * 0.9) return "watch";
  return "ok";
}

// -- Presentation helpers ---------------------------------------------------

export function formatThreshold(cfg: ThresholdConfig, unit: string): string | null {
  if (!cfg.enabled) return null;
  const { min, max } = cfg;
  if (min !== undefined && max !== undefined) return `${min}–${max} ${unit}`;
  if (max !== undefined) return `≤ ${max} ${unit}`;
  if (min !== undefined) return `≥ ${min} ${unit}`;
  return null;
}
