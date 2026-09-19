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
 *   ~15% raw pk-pk crosses the 300-count "breath event" firmware threshold
 *  100%  pk-pk = 2048 (half-rail swing — a loud shout / clap / crying)
 *
 * When we're over the breath threshold the bar turns brand-teal; below it
 * stays muted grey, so the user can watch the threshold get crossed in real
 * time.
 */
export function MicLevel({ pkpk }: { pkpk: number | undefined }) {
  const raw = Math.max(0, Math.round(pkpk ?? 0));
  const pct = Math.min(100, Math.round((raw / 2048) * 100));
  const overThreshold = raw >= 300;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted">
      <Mic className="size-3 shrink-0" aria-hidden />
      <div
        className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2"
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
      </div>
      <span className="tabular font-medium min-w-[2.5rem] text-right">
        {pct}%
      </span>
    </div>
  );
}
