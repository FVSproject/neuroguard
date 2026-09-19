"use client";

import { useEffect, useState } from "react";

import { getThresholds } from "@/lib/actions/thresholds";
import { DEFAULT_THRESHOLDS, defaultThresholdsList } from "@/lib/thresholds";
import type { MetricId, ThresholdConfig } from "@/lib/types";

export function useThresholds(babyId: string | null) {
  const [map, setMap] = useState<Record<MetricId, ThresholdConfig>>(() => DEFAULT_THRESHOLDS);

  useEffect(() => {
    let cancelled = false;
    if (!babyId) {
      setMap(DEFAULT_THRESHOLDS);
      return;
    }
    (async () => {
      try {
        const list = await getThresholds(babyId);
        const entries = list.length ? list : defaultThresholdsList();
        const next = Object.fromEntries(entries.map((e) => [e.metric, e])) as Record<
          MetricId,
          ThresholdConfig
        >;
        if (!cancelled) setMap(next);
      } catch {
        // Fall back to defaults if the network is off or the user isn't signed in.
        if (!cancelled) setMap(DEFAULT_THRESHOLDS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [babyId]);

  return map;
}
