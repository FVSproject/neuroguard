"use client";

import { useTranslations } from "next-intl";

import type { ThresholdConfig } from "@/lib/types";
import type { MetricState } from "@/lib/thresholds";
import { cn } from "@/lib/utils";

const STATE_TONE: Record<MetricState, string> = {
  ok:        "text-muted",
  watch:     "text-warn",
  alert:     "text-danger",
  critical:  "text-danger",
  stale:     "text-muted",
  off:       "text-muted",
  warmingUp: "text-brand",
};

/**
 * The little "Normal: 90–160 bpm" line under every sensor's live value.
 * Colour drifts to the current metric state so a parent sees at a glance
 * both the acceptable band AND which direction the current value has drifted.
 */
export function ThresholdBadge({
  cfg,
  unit,
  state,
  className,
}: {
  cfg?: ThresholdConfig;
  unit: string;
  state: MetricState;
  className?: string;
}) {
  const t = useTranslations("threshold");

  if (!cfg || !cfg.enabled) {
    return (
      <p className={cn("text-xs text-muted/70", className)}>—</p>
    );
  }
  const { min, max } = cfg;

  let text: string;
  if (min !== undefined && max !== undefined) {
    text = t("normal", { min, max, unit });
  } else if (max !== undefined) {
    text = t("alertHigh", { max, unit });
  } else if (min !== undefined) {
    text = t("alertLow", { min, unit });
  } else {
    return null;
  }

  return (
    <p className={cn("text-xs font-medium", STATE_TONE[state], className)}>
      {text}
    </p>
  );
}
