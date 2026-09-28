"use client";

import { useAlarmWatcher } from "@/hooks/use-alarm-watcher";
import { useBreathTracker } from "@/hooks/use-breath-tracker";
import { usePacketRecorder } from "@/hooks/use-packet-recorder";

/**
 * Invisible mount point that boots the app-wide background hooks (alarm
 * watcher + packet recorder). Kept as a client component so the app shell
 * (a server component) stays a pure layout.
 */
export function AlarmMount() {
  // First, so its packet subscription runs before the alarm watcher's and
  // alarms see this packet's breath state.
  useBreathTracker();
  useAlarmWatcher();
  usePacketRecorder();
  return null;
}
