"use client";

import { create } from "zustand";

/**
 * Mic level (% of the ADC half-swing) that counts as breath sound. Single
 * source of truth for the breath tracker, the apnea timer, and the tick on
 * the mic bar.
 */
export const BREATH_THRESHOLD_PCT = 40;

type BreathState = {
  /** Upward crossings of the breath line since connect. Never decrements. */
  total: number;
  /** Crossings in the last 60 s — i.e. breaths per minute. */
  window60s: number;
  /** Last packet where the mic was at/above the line (0 = none yet). */
  lastSoundMs: number;
  /** First packet of this session (0 = no session). */
  sinceMs: number;
};

export const useBreathStore = create<BreathState>(() => ({
  total: 0,
  window60s: 0,
  lastSoundMs: 0,
  sinceMs: 0,
}));

/**
 * Apnea timer: seconds since the mic last heard breath-level sound. Before
 * any sound this session it counts from the first packet, so a dead or
 * disconnected mic still trips the alarm.
 */
export function apneaSecAt(nowMs: number): number | null {
  const { lastSoundMs, sinceMs } = useBreathStore.getState();
  const ref = lastSoundMs || sinceMs;
  if (!ref) return null;
  return Math.max(0, Math.floor((nowMs - ref) / 1000));
}
