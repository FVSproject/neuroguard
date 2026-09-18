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
 * Atomic dashboard cell. Compact by design so the whole set fits in one
 * viewport on desktop (goal: no vertical scroll to see any card). Sizes at
 * roughly 140 px tall × 200 px wide.  See DESIGN.md §7 for the contract.
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
  value: string | number;
  unit: string;
  state: MetricState;
  cfg?: ThresholdConfig;
  history?: number[];
  extra?: ReactNode;
  className?: string;
}) {
  // Border colour follows the current state so the room glow doubles as an
  // ambient status indicator, without repainting the whole background.
  const borderTone =
    state === "critical" ? "border-danger" :
    state === "alert"    ? "border-danger/70" :
    state === "watch"    ? "border-warn/70" :
    state === "stale"    ? "border-offline/40" :
                           "border-border";

  return (
    <motion.div
      layout
      className={cn(
        "card relative flex flex-col gap-1.5 border p-3.5",
        borderTone,
        state === "critical" && "alarm-pulse",
        className,
      )}
      role="group"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        <StateChip state={state} />
      </div>

      <div className="flex items-baseline gap-1.5">
        <motion.div
          key={String(value)}
          initial={{ y: 3, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="tabular text-3xl font-bold leading-none tracking-tight"
        >
          {value}
        </motion.div>
        <div className="text-[11px] font-medium text-muted">{unit}</div>
        {extra ? <div className="ms-auto text-[10px] uppercase text-muted/70">{extra}</div> : null}
      </div>

      {history && history.length > 1 ? (
        <Sparkline
          values={history}
          height={22}
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
          className="opacity-70"
        />
      ) : (
        <div className="h-[22px]" aria-hidden />
      )}

      <ThresholdBadge cfg={cfg} unit={unit} state={state} className="text-[10px] leading-tight" />
    </motion.div>
  );
}
