import type { MetricId } from "./types";

/**
 * Per-metric warmup periods (seconds). A metric is only "ready" to be
 * displayed as a rate / evaluated for alarms once this many seconds have
 * elapsed since the current BLE session started (see ble-store's
 * `sessionStartMs`).
 *
 * Values fall into three buckets:
 *
 *   - **0 (instant)** — the metric is a snapshot or "time-since" counter,
 *     meaningful from the first packet: HR, SpO2, apnea watchdog,
 *     stillness watchdog, temperature, humidity.
 *
 *   - **60 (windowed rate)** — the firmware computes these as a count of
 *     events over the last 60 seconds. Before the window fills, they
 *     under-report, so we withhold them for a full minute:
 *     `sucksPerMin`, `bursts`, `breathRate`, HRV stats.
 *
 *   - **180 (sensor warmup)** — ENS160 needs ~3 min to stabilise per its
 *     datasheet. Values before that are qualitatively meaningful but not
 *     quantitatively trustworthy, so we don't fire alarms on them.
 */
export const WARMUP_SEC: Partial<Record<MetricId, number>> = {
  suckRate:     60,
  breathRate:   60,
  rmssd:        60,
  sdnn:         60,
  eco2:        180,
  tvoc:        180,
  aqi:         180,
};

/**
 * Pure — call from anywhere. Returns true when the metric has enough
 * elapsed time to be trusted.
 */
export function isMetricReady(
  metric: MetricId,
  sessionStartMs: number,
  nowMs: number = Date.now(),
): boolean {
  if (!sessionStartMs) return false;
  const warmup = WARMUP_SEC[metric] ?? 0;
  if (warmup === 0) return true;
  return (nowMs - sessionStartMs) >= warmup * 1000;
}

/**
 * Seconds remaining until the metric is ready. Never negative — clamps to 0
 * for metrics that are already ready or have no warmup.
 */
export function secondsUntilReady(
  metric: MetricId,
  sessionStartMs: number,
  nowMs: number = Date.now(),
): number {
  if (!sessionStartMs) {
    const warmup = WARMUP_SEC[metric] ?? 0;
    return warmup;
  }
  const warmup = WARMUP_SEC[metric] ?? 0;
  if (warmup === 0) return 0;
  const elapsedSec = (nowMs - sessionStartMs) / 1000;
  return Math.max(0, Math.ceil(warmup - elapsedSec));
}
