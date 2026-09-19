"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { connectHub, disconnectHub, isBleSupported, sendHubCommand, hasCmdChannel } from "@/lib/ble";
import { generateMockPacket } from "@/lib/mock-packet";
import { HUB_CMD_RESCAN_BRACELET } from "@/lib/packet";
import { useBleStore } from "@/stores/ble-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Reusable hook that wraps `ble.ts` in something a React component can call.
 * When "mock stream" is enabled in the UI store, this bypasses BLE entirely
 * and pushes generated packets at 1 Hz — useful during frontend development
 * before the hub firmware exposes the peripheral role.
 */
export function useBle() {
  const status     = useBleStore((s) => s.status);
  const setStatus  = useBleStore((s) => s.setStatus);
  const setError   = useBleStore((s) => s.setError);
  const ingest     = useBleStore((s) => s.ingest);
  const reset      = useBleStore((s) => s.reset);

  const mockEnabled = useUiStore((s) => s.mockStream);

  const deviceRef  = useRef<BluetoothDevice | null>(null);
  const mockRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect browsers without Web Bluetooth (Safari, iOS, Firefox) AFTER mount
  // so the initial SSR render doesn't diverge from the client. The store
  // starts as "disconnected" on both server and client — this effect only
  // flips it to "unsupported" on the client, after hydration has settled.
  useEffect(() => {
    if (!isBleSupported()) setStatus("unsupported", null);
  }, [setStatus]);

  // --- Mock stream: cheapest possible "connection" for local dev -----------
  useEffect(() => {
    if (!mockEnabled) {
      if (mockRef.current) { clearInterval(mockRef.current); mockRef.current = null; }
      return;
    }
    let step = 0;
    setStatus("connected", "Mock stream");
    ingest(generateMockPacket(step++));
    mockRef.current = setInterval(() => ingest(generateMockPacket(step++)), 1000);
    return () => {
      if (mockRef.current) { clearInterval(mockRef.current); mockRef.current = null; }
      setStatus("disconnected", null);
    };
  }, [mockEnabled, ingest, setStatus]);

  // --- Real BLE connection --------------------------------------------------
  const connect = useCallback(async () => {
    if (!isBleSupported()) {
      toast.error("Web Bluetooth isn't available in this browser.");
      return;
    }
    try {
      deviceRef.current = await connectHub({
        onStatus: (s, name) => setStatus(s, name ?? null),
        onPacket: (p) => ingest(p),
        onError:  (e) => {
          setError(e);
          toast.error(e);
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("disconnected", null);
      // NotFoundError just means the user closed the picker — don't toast that.
      if (!/NotFoundError|cancelled/i.test(msg)) toast.error(msg);
    }
  }, [ingest, setError, setStatus]);

  const disconnect = useCallback(() => {
    if (deviceRef.current) {
      disconnectHub(deviceRef.current);
      deviceRef.current = null;
    }
    reset();
  }, [reset]);

  // Ask the hub to drop its cached bracelet MAC and rediscover. Used when
  // pairing a fresh bracelet or when the current one is stuck reconnecting.
  const rescanBracelet = useCallback(async (): Promise<void> => {
    if (!hasCmdChannel()) {
      throw new Error("Hub firmware doesn't support commands (re-flash to enable).");
    }
    await sendHubCommand(HUB_CMD_RESCAN_BRACELET);
  }, []);

  return { status, connect, disconnect, rescanBracelet, mockEnabled };
}
