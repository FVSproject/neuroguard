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
  note,
}: {
  pkpk: number | undefined;
  /** Optional: cumulative crossing count. Rendered as a small "N ev" chip
   *  next to the level bar so every threshold-crossing visibly bumps a
   *  number by 1. Passed by the Live page from `useClientBreathCount`. */
  eventsPerMin?: number;
  /** Optional caption rendered below the level row. Used to explain the
   *  cumulative-total semantics of `eventsPerMin` and to surface the
   *  rolling-60 s window count as a secondary hint. */
  note?: string;
}) {
  const raw = Math.max(0, Math.round(pkpk ?? 0));
  const pct = Math.min(100, Math.round((raw / 2048) * 100));
  const overThreshold = pct >= BREATH_ON_PCT;

  return (
    <div className="space-y-1">
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
            title="Cumulative breath events since connect — every threshold crossing bumps this by 1, never decrements."
          >
            {eventsPerMin} ev
          </span>
        ) : null}
      </div>
      {note ? (
        <div className="text-[9px] leading-tight text-muted/80">{note}</div>
      ) : null}
    </div>
  );
}
