"use client";

import { useAlarmWatcher } from "@/hooks/use-alarm-watcher";
import { usePacketRecorder } from "@/hooks/use-packet-recorder";

/**
 * Invisible mount point that boots the app-wide background hooks (alarm
 * watcher + packet recorder). Kept as a client component so the app shell
 * (a server component) stays a pure layout.
 */
export function AlarmMount() {
  useAlarmWatcher();
  usePacketRecorder();
  return null;
}
