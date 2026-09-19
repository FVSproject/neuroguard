"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type { CombinedPacket } from "@/lib/packet";

export type BleStatus =
  | "unsupported"     // Web Bluetooth not available in this browser
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type State = {
  status: BleStatus;
  deviceName: string | null;
  lastError: string | null;
  lastPacket: CombinedPacket | null;
  lastPacketMs: number;
  /**
   * Wall-clock ms when the CURRENT session started — either when the first
   * packet arrived after connecting, or when the mock stream was turned on.
   * `useMetricReady()` uses `Date.now() - sessionStartMs` as an "elapsed"
   * clock so we know when a windowed metric (breath rate, suck rate, HRV,
   * eCO₂ warmup, etc.) has enough data to be meaningful.
   * Reset to 0 on disconnect so the next session starts a fresh warmup.
   */
  sessionStartMs: number;
};

type Actions = {
  setStatus: (status: BleStatus, deviceName?: string | null) => void;
  setError: (err: string | null) => void;
  ingest: (packet: CombinedPacket) => void;
  reset: () => void;
};

const initial: State = {
  status: typeof navigator !== "undefined" && "bluetooth" in navigator ? "disconnected" : "unsupported",
  deviceName: null,
  lastError: null,
  lastPacket: null,
  lastPacketMs: 0,
  sessionStartMs: 0,
};

export const useBleStore = create<State & Actions>()(
  subscribeWithSelector((set) => ({
    ...initial,
    setStatus: (status, deviceName) =>
      set((s) => ({
        status,
        deviceName: deviceName ?? s.deviceName,
        // Reset warmup clock whenever the link drops.
        sessionStartMs: status === "disconnected" ? 0 : s.sessionStartMs,
      })),
    setError: (err) => set({ lastError: err }),
    ingest: (packet) =>
      set((s) => ({
        lastPacket: packet,
        lastPacketMs: Date.now(),
        // Latch on the first packet of a session.
        sessionStartMs: s.sessionStartMs || Date.now(),
      })),
    reset: () => set(initial),
  })),
);
