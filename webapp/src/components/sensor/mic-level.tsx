"use client";

import { Mic } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Raw mic activity strip — shows the peak-to-peak amplitude of the last
 * 50 ms window as a live percentage bar. This is BEFORE any threshold /
 * breath-detection algorithm, so a caregiver can verify the mic itself is
 * seeing sound (blow on the pacifier → bar jumps).
 *
 *   0    silence
 *   27 % raw pk-pk crosses the client-side "breath event" trigger
 *  100 % pk-pk = 2048 (half-rail swing — a loud shout / clap / crying)
 *
 * When we're over the breath threshold the bar turns brand-teal; below it
 * stays muted grey, so the user can watch the threshold get crossed in real
 * time. Keep BREATH_ON_PCT in lockstep with `BREATH_THRESHOLD_PCT` in
 * `use-client-breath-count.ts` — the browser is the source of truth for
 * this threshold; firmware doesn't participate in the count anymore.
 */
const BREATH_ON_PCT = 27;

export function MicLevel({
  pkpk,
  eventsPerMin,
}: {
  pkpk: number | undefined;
  /** Optional: raw firmware event count in the last 60 s. When passed, we
   *  render a small "N ev/min" chip so every threshold-crossing visibly
   *  bumps a number by 1 — the primary breaths/min value only ticks every
   *  2 events because of the inhale+exhale ÷2 heuristic. */
  eventsPerMin?: number;
}) {
  const raw = Math.max(0, Math.round(pkpk ?? 0));
  const pct = Math.min(100, Math.round((raw / 2048) * 100));
  const overThreshold = pct >= BREATH_ON_PCT;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted">
      <Mic className="size-3 shrink-0" aria-hidden />
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Mic pk-pk"
      >
        <div
          className={cn(
            "h-full transition-[width,background-color] duration-200 ease-out",
            overThreshold ? "bg-brand" : "bg-muted/50",
          )}
          style={{ width: `${pct}%` }}
        />
        <span
          className="pointer-events-none absolute top-0 h-full w-px bg-ink/40"
          style={{ left: `${BREATH_ON_PCT}%` }}
          aria-hidden
        />
      </div>
      <span className="tabular font-medium min-w-[2.5rem] text-right">
        {pct}%
      </span>
      {eventsPerMin !== undefined ? (
        <span
          className="tabular font-semibold min-w-[3rem] rounded-full bg-brand-soft px-1.5 py-0.5 text-center text-brand"
          title="Raw mic events in the last 60 s — every threshold crossing bumps this by 1"
        >
          {eventsPerMin} ev
        </span>
      ) : null}
    </div>
  );
}
