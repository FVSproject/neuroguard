"use client";

import { useTranslations } from "next-intl";
import { Check, TriangleAlert, OctagonAlert, Siren, WifiOff, CircleOff } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MetricState } from "@/lib/thresholds";

const STATE_STYLE: Record<MetricState, string> = {
  ok:       "bg-ok-soft text-ok-foreground text-ok border-ok/30",
  watch:    "bg-warn-soft text-warn border-warn/30",
  alert:    "bg-danger-soft text-danger border-danger/30",
  critical: "bg-danger text-white border-danger",
  stale:    "bg-offline-soft text-offline border-offline/30",
  off:      "bg-offline-soft text-offline border-offline/30",
};

const STATE_ICON: Record<MetricState, React.ComponentType<{ className?: string }>> = {
  ok:       Check,
  watch:    TriangleAlert,
  alert:    OctagonAlert,
  critical: Siren,
  stale:    WifiOff,
  off:      CircleOff,
};

const STATE_LABEL_KEY: Record<MetricState, string> = {
  ok:       "ok",
  watch:    "watch",
  alert:    "alert",
  critical: "critical",
  stale:    "stale",
  off:      "off",
};

export function StateChip({
  state,
  className,
  size = "sm",
}: {
  state: MetricState;
  className?: string;
  size?: "sm" | "md";
}) {
  const t = useTranslations("state");
  const Icon = STATE_ICON[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        STATE_STYLE[state],
        state === "critical" && "shadow-[0_0_0_3px_rgba(201,75,75,0.25)]",
        className,
      )}
      role="status"
    >
      <Icon className={cn(size === "sm" ? "size-3" : "size-3.5")} aria-hidden />
      {t(STATE_LABEL_KEY[state])}
    </span>
  );
}
