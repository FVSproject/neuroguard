"use client";

import { useTranslations } from "next-intl";
import { Bluetooth, BluetoothConnected, BluetoothOff } from "lucide-react";

import { useBleStore } from "@/stores/ble-store";
import { cn } from "@/lib/utils";

/**
 * A tiny always-visible chip in the header that shows the BLE connection
 * state — colour-coded so a parent knows at a glance whether the data on
 * the dashboard is live or stale.
 */
export function ConnectionChip() {
  const t = useTranslations("landing");
  const status = useBleStore((s) => s.status);
  const deviceName = useBleStore((s) => s.deviceName);

  const Icon =
    status === "connected"    ? BluetoothConnected :
    status === "disconnected" ? BluetoothOff :
                                Bluetooth;

  const dot =
    status === "connected"     ? "bg-ok pulse-soft" :
    status === "connecting"    ? "bg-warn pulse-soft" :
    status === "reconnecting"  ? "bg-warn pulse-soft" :
                                 "bg-offline";

  const label =
    status === "connected"    ? (deviceName ?? t("connected")) :
    status === "connecting"   ? t("connecting") :
    status === "reconnecting" ? t("connecting") :
                                t("disconnect");

  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted sm:inline-flex",
      )}
      role="status"
      aria-live="polite"
    >
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      <Icon className="size-3.5" aria-hidden />
      <span className="max-w-[10rem] truncate">{label}</span>
    </div>
  );
}
