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
};

export const useBleStore = create<State & Actions>()(
  subscribeWithSelector((set) => ({
    ...initial,
    setStatus: (status, deviceName) =>
      set((s) => ({ status, deviceName: deviceName ?? s.deviceName })),
    setError: (err) => set({ lastError: err }),
    ingest: (packet) => set({ lastPacket: packet, lastPacketMs: Date.now() }),
    reset: () => set(initial),
  })),
);
