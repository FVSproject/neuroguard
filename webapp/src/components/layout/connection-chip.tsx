"use client";

import { useTranslations } from "next-intl";
import { Bluetooth, BluetoothConnected, BluetoothOff, Watch } from "lucide-react";

import { useBleStore } from "@/stores/ble-store";
import { cn } from "@/lib/utils";

/**
 * Two chips: hub link + bracelet link.
 *
 * The bracelet indicator uses the age field the hub sends with every packet,
 * so the parent sees "Bracelet · 12 s ago" when the BLE link between hub
 * and bracelet is stalling — that's the "hub reads lag 5–15 s then recover"
 * symptom, and it should surface here rather than silently freezing numbers.
 */
export function ConnectionChip() {
  const t = useTranslations("landing");
  const tBrace = useTranslations("bracelet");
  const status = useBleStore((s) => s.status);
  const deviceName = useBleStore((s) => s.deviceName);
  const packet = useBleStore((s) => s.lastPacket);

  const HubIcon =
    status === "connected"    ? BluetoothConnected :
    status === "disconnected" ? BluetoothOff :
                                Bluetooth;

  const hubDot =
    status === "connected"     ? "bg-ok pulse-soft" :
    status === "connecting"    ? "bg-warn pulse-soft" :
    status === "reconnecting"  ? "bg-warn pulse-soft" :
                                 "bg-offline";

  const hubLabel =
    status === "connected"    ? (deviceName ?? t("connected")) :
    status === "connecting"   ? t("connecting") :
    status === "reconnecting" ? t("connecting") :
                                t("disconnect");

  // Bracelet is only meaningful once we have hub packets to look at.
  const braceletLinked = packet?.braceletLinked ?? false;
  const braceletAge    = packet?.braceletAgeSec ?? 999;

  let braceletDot   = "bg-offline";
  let braceletLabel = tBrace("offline");
  if (braceletLinked && braceletAge <= 3) {
    braceletDot = "bg-ok pulse-soft";
    braceletLabel = tBrace("linked");
  } else if (braceletLinked && braceletAge <= 15) {
    braceletDot = "bg-warn pulse-soft";
    braceletLabel = tBrace("stale", { sec: braceletAge });
  } else if (packet) {
    braceletDot = "bg-danger";
    braceletLabel = tBrace("offline");
  }

  return (
    <div className="hidden items-center gap-1.5 sm:inline-flex">
      <div
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted"
        role="status"
        aria-live="polite"
      >
        <span className={cn("size-1.5 rounded-full", hubDot)} aria-hidden />
        <HubIcon className="size-3.5" aria-hidden />
        <span className="max-w-[8rem] truncate">{hubLabel}</span>
      </div>

      {packet ? (
        <div
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted"
          role="status"
          aria-live="polite"
          title={tBrace("drops", { count: packet.braceletDrops })}
        >
          <span className={cn("size-1.5 rounded-full", braceletDot)} aria-hidden />
          <Watch className="size-3.5" aria-hidden />
          <span className="max-w-[10rem] truncate">{braceletLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
