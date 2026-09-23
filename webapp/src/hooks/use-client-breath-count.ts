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
 * 27 % threshold — the same tick MicLevel draws — so the "N ev" chip
 * in the UI stays consistent with what the level bar visibly does.
 *
 * We keep this in the web app on purpose: the firmware detector has
 * proven flaky in noisy rooms, and re-flashing the hub for every tweak
 * is slow. The 60 s rolling window mirrors the firmware's
 * `resp_events_per_min` field so the chip's semantics don't change.
 *
 * Returns the current 60 s rolling count of crossings.
 */
export function useClientBreathCount(): number {
  const [events, setEvents] = useState(0);
  const prevPctRef = useRef<number>(0);
  const ringRef    = useRef<number[]>([]);

  useEffect(() => {
    const trim = (now: number) => {
      while (ringRef.current.length > 0 && now - ringRef.current[0] > WINDOW_MS) {
        ringRef.current.shift();
      }
    };

    // Every packet: check for a rising-edge crossing of 17 %, push a
    // timestamp if it happened, trim old ones, publish the count.
    const unsubPacket = useBleStore.subscribe(
      (s) => s.lastPacket,
      (packet) => {
        if (!packet) return;
        const pct = pkpkToPct(packet.hub?.micPkpkNow);
        const now = Date.now();

        if (prevPctRef.current < BREATH_THRESHOLD_PCT && pct >= BREATH_THRESHOLD_PCT) {
          ringRef.current.push(now);
        }
        prevPctRef.current = pct;
        trim(now);
        setEvents(ringRef.current.length);
      },
    );

    // Reset on disconnect so the next session starts fresh.
    const unsubSession = useBleStore.subscribe(
      (s) => s.sessionStartMs,
      (sessionStartMs) => {
        if (sessionStartMs === 0) {
          ringRef.current = [];
          prevPctRef.current = 0;
          setEvents(0);
        }
      },
    );

    // 1 Hz trim so the count also decays when packets stop arriving
    // (bracelet went out of range, hub reboot, etc.) instead of freezing.
    const iv = setInterval(() => {
      const now = Date.now();
      const before = ringRef.current.length;
      trim(now);
      if (ringRef.current.length !== before) setEvents(ringRef.current.length);
    }, 1000);

    return () => {
      unsubPacket();
      unsubSession();
      clearInterval(iv);
    };
  }, []);

  return events;
}
