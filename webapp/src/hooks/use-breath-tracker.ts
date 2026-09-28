"use client";

import { useEffect, useRef } from "react";

import { useBleStore } from "@/stores/ble-store";
import { BREATH_THRESHOLD_PCT, useBreathStore } from "@/stores/breath-store";

const WINDOW_MS = 60_000;

// Match MicLevel: raw ADC pk-pk → % of 12-bit half-swing (2048).
function pkpkToPct(pkpk: number | undefined): number {
  const raw = Math.max(0, Math.round(pkpk ?? 0));
  return Math.min(100, Math.round((raw / 2048) * 100));
}

/**
 * Mount ONCE (AlarmMount). Turns the mic level in every packet into the
 * app-wide breath state that the Live cards, sparklines and alarms all read:
 *   - one breath per upward crossing of the breath line,
 *   - a rolling 60 s count (breaths per minute),
 *   - the time the mic last heard breath-level sound (apnea timer).
 *
 * Runs in the browser off the hub's raw mic level on purpose — the hub's own
 * breath detector uses a different line and is ignored by the UI.
 */
export function useBreathTracker() {
  const prevPct = useRef(0);
  const ring = useRef<number[]>([]);

  useEffect(() => {
    const set = useBreathStore.setState;
    const trim = (now: number) => {
      while (ring.current.length > 0 && now - ring.current[0] > WINDOW_MS) ring.current.shift();
    };

    const unsubPacket = useBleStore.subscribe(
      (s) => s.lastPacket,
      (packet) => {
        if (!packet) return;
        const now = Date.now();
        const pct = pkpkToPct(packet.hub?.micPkpkNow);
        const s = useBreathStore.getState();
        const patch: Partial<typeof s> = {};

        if (!s.sinceMs) patch.sinceMs = now;
        if (pct >= BREATH_THRESHOLD_PCT) patch.lastSoundMs = now;
        if (prevPct.current < BREATH_THRESHOLD_PCT && pct >= BREATH_THRESHOLD_PCT) {
          ring.current.push(now);
          patch.total = s.total + 1;
        }
        prevPct.current = pct;
        trim(now);
        patch.window60s = ring.current.length;
        set(patch);
      },
    );

    const unsubSession = useBleStore.subscribe(
      (s) => s.sessionStartMs,
      (sessionStartMs) => {
        if (sessionStartMs !== 0) return;
        ring.current = [];
        prevPct.current = 0;
        set({ total: 0, window60s: 0, lastSoundMs: 0, sinceMs: 0 });
      },
    );

    // Let the 60 s window drain even when packets stop arriving.
    const iv = setInterval(() => {
      const before = ring.current.length;
      trim(Date.now());
      if (ring.current.length !== before) set({ window60s: ring.current.length });
    }, 1000);

    return () => {
      unsubPacket();
      unsubSession();
      clearInterval(iv);
    };
  }, []);
}
