"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { AlertCircle, BellOff, Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAlarmStore } from "@/stores/alarm-store";
import { useUiStore } from "@/stores/ui-store";
import { stopAlarm } from "@/lib/alarm";
import { cn } from "@/lib/utils";

const METRIC_LABEL_KEY: Record<string, string> = {
  hr: "sensor.hr",
  spo2: "sensor.spo2",
  rmssd: "sensor.hrv",
  suckRate: "sensor.suck",
  breathRate: "sensor.breath",
  apneaSec: "sensor.breath",
  stillnessSec: "sensor.motion",
  tempC: "sensor.temp",
  rhPct: "sensor.humidity",
  eco2: "sensor.eco2",
};

/**
 * Sticky banner surfaced under the app header while any metric is in an
 * alert / critical state. Non-blocking (does not cover sensor cards) — its
 * height reserves space so nothing jumps.
 */
export function AlarmBanner() {
  const t = useTranslations();
  const rows = useAlarmStore((s) => s.rows);
  const snooze = useAlarmStore((s) => s.snooze);
  const acknowledge = useAlarmStore((s) => s.acknowledge);
  const setSilenced = useUiStore((s) => s.setAlarmSilenced);

  const active = Object.values(rows).filter(
    (r) => (r.state === "alert" || r.state === "critical") && r.snoozedUntil < Date.now(),
  );

  return (
    <AnimatePresence initial={false}>
      {active.length > 0 ? (
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="sticky top-14 z-20 border-b border-danger/40 bg-danger-soft/95 backdrop-blur"
          role="alert"
          aria-live="assertive"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-5">
            <AlertCircle className={cn("size-5 text-danger", "shrink-0")} aria-hidden />
            <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-danger">{t("alarm.title")}</span>
              <span className="text-danger/80">
                {active
                  .map((r) => t(METRIC_LABEL_KEY[r.metric] ?? "sensor.hr"))
                  .join(" · ")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-danger hover:bg-danger/10"
                onClick={() => {
                  active.forEach((r) => snooze(r.metric, 5));
                  stopAlarm();
                }}
              >
                <Bell className="size-4" aria-hidden />
                {t("alarm.snooze")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-danger hover:bg-danger/10"
                onClick={() => {
                  active.forEach((r) => acknowledge(r.metric));
                  stopAlarm();
                }}
              >
                <X className="size-4" aria-hidden />
                {t("alarm.acknowledge")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-danger hover:bg-danger/10"
                onClick={() => {
                  setSilenced(true);
                  stopAlarm();
                }}
              >
                <BellOff className="size-4" aria-hidden />
                {t("alarm.silence")}
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
