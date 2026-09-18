"use client";

import {
  NG_HUB_WEB_SERVICE_UUID,
  NG_HUB_WEB_CHR_UUID,
  parseCombinedBinary,
  parseCombinedJson,
  type CombinedPacket,
} from "@/lib/packet";

/**
 * Thin wrapper around the Web Bluetooth API for talking to the NeuroGuard hub.
 *
 * The hub advertises `NG_SERVICE_UUID` with a single notify characteristic
 * (`NG_WEB_CHR_UUID`) that sends a UTF-8 JSON blob matching the shape of
 * `CombinedPacket` about once per second.
 *
 * This module never touches React state directly. It only invokes the
 * callbacks the ble-store hook passes in — so the store can be tested
 * without a browser and there's exactly one owner of connection state.
 */

export type BleCallbacks = {
  onStatus: (status: "connecting" | "connected" | "disconnected", deviceName?: string) => void;
  onPacket: (packet: CombinedPacket) => void;
  onError:  (err: string) => void;
};

/** Runtime detection — safe to call from either SSR or the browser. */
export function isBleSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/**
 * Prompt the user to pick a NeuroGuard hub from the browser chooser and
 * subscribe to its characteristic. Must be called from a user gesture
 * (click) or the browser rejects it.
 */
export async function connectHub(cb: BleCallbacks): Promise<BluetoothDevice> {
  if (!isBleSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser.");
  }

  cb.onStatus("connecting");

  const device = await navigator.bluetooth.requestDevice({
    // Filter on the hub's own service so only NeuroGuard hubs appear
    // (the bracelet advertises a different service, so it's filtered out).
    filters: [{ services: [NG_HUB_WEB_SERVICE_UUID] }],
    optionalServices: [NG_HUB_WEB_SERVICE_UUID],
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error("Failed to connect to hub GATT server.");
  const service = await server.getPrimaryService(NG_HUB_WEB_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(NG_HUB_WEB_CHR_UUID);

  const onValue = (ev: Event) => {
    try {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const value = target.value;
      if (!value) return;
      // Detect binary-vs-JSON: JSON starts with `{`. Older WiFi-AP firmware
      // that gets bridged here could still send JSON; we accept both.
      const first = value.byteLength ? value.getUint8(0) : 0;
      // value.buffer is typed as ArrayBufferLike (could be SharedArrayBuffer);
      // Web Bluetooth always gives us a plain ArrayBuffer at runtime.
      const packet = first === 0x7B // '{'
        ? parseCombinedJson(new TextDecoder("utf-8").decode(value))
        : parseCombinedBinary(value.buffer as ArrayBuffer);
      cb.onPacket(packet);
    } catch (err) {
      cb.onError(err instanceof Error ? err.message : String(err));
    }
  };

  characteristic.addEventListener("characteristicvaluechanged", onValue);
  await characteristic.startNotifications();

  device.addEventListener("gattserverdisconnected", () => {
    characteristic.removeEventListener("characteristicvaluechanged", onValue);
    cb.onStatus("disconnected", device.name ?? undefined);
  });

  cb.onStatus("connected", device.name ?? undefined);
  return device;
}

/** Explicit disconnect requested by the parent (e.g. hitting the button). */
export function disconnectHub(device: BluetoothDevice): void {
  try {
    device.gatt?.disconnect();
  } catch {
    // ignore — best-effort teardown
  }
}
