"use client";

import { useEffect, useRef, useState } from "react";

import { useBleStore } from "@/stores/ble-store";

const BREATH_THRESHOLD_PCT = 27;
const WINDOW_MS            = 60_000;
// EMA weight on the fresh sample (0..1). Lower = smoother bar, more lag.
// 0.35 dampens single-window noise spikes without hiding real breaths.
const EMA_ALPHA            = 0.35;

// Match MicLevel: raw ADC pk-pk → % of 12-bit half-swing (2048).
function pkpkToPct(pkpk: number | undefined): number {
  const raw = Math.max(0, Math.round(pkpk ?? 0));
  return Math.min(100, Math.round((raw / 2048) * 100));
}

/**
 * Client-side breath counter driven purely from the mic_pkpk_now field
 * on every packet. Fires exactly one event per upward crossing of the
 * 27 % threshold — the same tick MicLevel draws.
 *
 * Raw pk-pk from a 50 ms window jitters a lot (real acoustic noise is
 * spiky), so we EMA-smooth the % before both the visual bar AND the
 * crossing detector. Both use the same smoothed value → chip and bar
 * stay in lockstep.
 *
 * Returns:
 *   - `total`     — cumulative crossings since session start. Monotonic,
 *                   never decrements. Resets on disconnect.
 *   - `window60s` — rolling count of crossings in the last 60 s.
 *   - `smoothPct` — EMA-smoothed 0..100 mic level for the bar display.
 */
export function useClientBreathCount(): {
  total: number;
  window60s: number;
  smoothPct: number;
} {
  const [total,     setTotal]     = useState(0);
  const [window60s, setWindow60s] = useState(0);
  const [smoothPct, setSmoothPct] = useState(0);
  const totalRef    = useRef<number>(0);
  const prevPctRef  = useRef<number>(0);
  const smoothRef   = useRef<number>(0);
  const ringRef     = useRef<number[]>([]);

  useEffect(() => {
    const trim = (now: number) => {
      while (ringRef.current.length > 0 && now - ringRef.current[0] > WINDOW_MS) {
        ringRef.current.shift();
      }
    };

    const unsubPacket = useBleStore.subscribe(
      (s) => s.lastPacket,
      (packet) => {
        if (!packet) return;
        const raw = pkpkToPct(packet.hub?.micPkpkNow);
        // EMA smooth to kill single-window noise spikes.
        const sm  = Math.round(smoothRef.current * (1 - EMA_ALPHA) + raw * EMA_ALPHA);
        const now = Date.now();

        // Rising-edge crossing on the SMOOTHED value so the bar and the
        // counter agree on when the threshold was crossed.
        if (prevPctRef.current < BREATH_THRESHOLD_PCT && sm >= BREATH_THRESHOLD_PCT) {
          ringRef.current.push(now);
          totalRef.current += 1;
          setTotal(totalRef.current);
        }
        prevPctRef.current = sm;
        smoothRef.current  = sm;
        trim(now);
        setWindow60s(ringRef.current.length);
        setSmoothPct(sm);
      },
    );

    // Reset everything on disconnect so the next session starts clean.
    const unsubSession = useBleStore.subscribe(
      (s) => s.sessionStartMs,
      (sessionStartMs) => {
        if (sessionStartMs === 0) {
          ringRef.current = [];
          prevPctRef.current = 0;
          smoothRef.current = 0;
          totalRef.current = 0;
          setTotal(0);
          setWindow60s(0);
          setSmoothPct(0);
        }
      },
    );

    // 1 Hz trim so the rolling window decays even when packets stop
    // arriving. Does NOT touch the cumulative total or smoothed level.
    const iv = setInterval(() => {
      const now = Date.now();
      const before = ringRef.current.length;
      trim(now);
      if (ringRef.current.length !== before) setWindow60s(ringRef.current.length);
    }, 1000);

    return () => {
      unsubPacket();
      unsubSession();
      clearInterval(iv);
    };
  }, []);

  return { total, window60s, smoothPct };
}
