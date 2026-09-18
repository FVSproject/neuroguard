"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { MetricState } from "@/lib/thresholds";
import type { ThresholdConfig } from "@/lib/types";
import { StateChip } from "./state-chip";
import { ThresholdBadge } from "./threshold-badge";
import { Sparkline } from "./sparkline";

/**
 * The atomic dashboard cell. Big animated value on top, sparkline in the
 * middle, threshold underneath. Border color follows the current state.
 * See DESIGN.md §7 for the visual contract.
 */
export function SensorCard({
  title,
  icon,
  value,
  unit,
  state,
  cfg,
  history,
  extra,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  value: string | number;                 // formatted (or "—" for stale)
  unit: string;
  state: MetricState;
  cfg?: ThresholdConfig;
  history?: number[];                     // recent values for the sparkline
  extra?: ReactNode;                      // secondary metric or source label
  className?: string;
}) {
  const borderTone =
    state === "critical" ? "border-danger" :
    state === "alert"    ? "border-danger/70" :
    state === "warn" as MetricState ? "border-warn/70" :
    state === "watch"    ? "border-warn/60" :
    state === "stale"    ? "border-offline/50" :
                           "border-border";

  return (
    <motion.div
      layout
      className={cn(
        "card group relative flex flex-col gap-3 border p-5",
        borderTone,
        state === "critical" && "alarm-pulse",
        className,
      )}
      role="group"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 text-sm font-medium text-muted">
          {icon}
          <span>{title}</span>
        </div>
        <StateChip state={state} />
      </div>

      <div className="flex items-baseline gap-2">
        <motion.div
          key={String(value)}
          initial={{ y: 4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="tabular text-5xl font-bold leading-none tracking-tight"
        >
          {value}
        </motion.div>
        <div className="text-sm font-medium text-muted">{unit}</div>
      </div>

      {history && history.length > 1 ? (
        <Sparkline
          values={history}
          height={44}
          stroke={
            state === "critical" || state === "alert" ? "var(--danger)" :
            state === "watch" ? "var(--warn)" :
            "var(--brand)"
          }
          fill={
            state === "critical" || state === "alert" ? "var(--danger-soft)" :
            state === "watch" ? "var(--warn-soft)" :
            "var(--brand-soft)"
          }
        />
      ) : (
        <div className="h-11" aria-hidden />
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <ThresholdBadge cfg={cfg} unit={unit} state={state} />
        {extra ? <div className="text-xs text-muted">{extra}</div> : null}
      </div>
    </motion.div>
  );
}
