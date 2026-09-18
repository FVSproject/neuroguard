"use client";

import { useEffect, useState } from "react";

import { db } from "@/lib/db";
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
      const rec = await db().thresholds.get(babyId);
      const list = rec?.entries ?? defaultThresholdsList();
      const next = Object.fromEntries(list.map((t) => [t.metric, t])) as Record<
        MetricId,
        ThresholdConfig
      >;
      if (!cancelled) setMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [babyId]);

  return map;
}
