"use client";

import { useEffect, useRef, useState } from "react";

import { useBleStore } from "@/stores/ble-store";

const BREATH_THRESHOLD_PCT = 27;
const WINDOW_MS            = 60_000;

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
 * Uses the RAW pk-pk per-packet — no EMA/smoothing. An earlier smoothing
 * pass held the bar at spurious high values (a single noise spike would
 * keep the smoothed level artificially high for several packets), so the
 * bar reported ~86 % in silence. Raw is jittery but honest.
 *
 * Returns:
 *   - `total`     — cumulative crossings since session start. Monotonic,
 *                   never decrements. Resets on disconnect.
 *   - `window60s` — rolling count of crossings in the last 60 s.
 */
export function useClientBreathCount(): { total: number; window60s: number } {
  const [total,     setTotal]     = useState(0);
  const [window60s, setWindow60s] = useState(0);
  const totalRef   = useRef<number>(0);
  const prevPctRef = useRef<number>(0);
  const ringRef    = useRef<number[]>([]);

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
        const pct = pkpkToPct(packet.hub?.micPkpkNow);
        const now = Date.now();

        if (prevPctRef.current < BREATH_THRESHOLD_PCT && pct >= BREATH_THRESHOLD_PCT) {
          ringRef.current.push(now);
          totalRef.current += 1;
          setTotal(totalRef.current);
        }
        prevPctRef.current = pct;
        trim(now);
        setWindow60s(ringRef.current.length);
      },
    );

    const unsubSession = useBleStore.subscribe(
      (s) => s.sessionStartMs,
      (sessionStartMs) => {
        if (sessionStartMs === 0) {
          ringRef.current = [];
          prevPctRef.current = 0;
          totalRef.current = 0;
          setTotal(0);
          setWindow60s(0);
        }
      },
    );

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

  return { total, window60s };
}
