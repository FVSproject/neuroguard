"use client";

import { useEffect } from "react";

import { insertPacket, prunePackets } from "@/lib/packet-db";
import { useBabyStore } from "@/stores/baby-store";
import { useBleStore } from "@/stores/ble-store";
import type { PacketRecord } from "@/lib/types";

const WRITE_EVERY_MS = 5_000;    // 1 record every 5 s → ~7-day rolling buffer
const PRUNE_EVERY_MS = 60_000;   // prune tail once a minute

export function usePacketRecorder() {
  const babyId = useBabyStore((s) => s.currentBabyId);

  useEffect(() => {
    if (!babyId) return;
    let lastWrite = 0;
    let lastPrune = 0;

    const unsub = useBleStore.subscribe(
      (s) => s.lastPacket,
      (packet) => {
        if (!packet) return;
        const now = Date.now();
        if (now - lastWrite < WRITE_EVERY_MS) return;
        lastWrite = now;

        const rec: Omit<PacketRecord, "id"> = {
          babyId,
          tsMs: packet.tsMs,
          hr: packet.bracelet?.hrBpm,
          spo2: packet.bracelet?.spo2Valid ? packet.bracelet.spo2Pct : undefined,
          rmssd: packet.bracelet?.rmssdMs,
          suckRate: packet.hub.sucksPerMin,
          breathRate: packet.hub.estBreathsPerMin,
          apneaSec: packet.hub.secondsSinceLastBreath,
          stillnessSec: packet.bracelet?.secondsSinceMovement,
          tempC: packet.hub.ahtOk ? packet.hub.tempC : undefined,
          rhPct: packet.hub.ahtOk ? packet.hub.rhPct : undefined,
          eco2: packet.hub.ensOk ? packet.hub.eco2Ppm : undefined,
          activityG: packet.bracelet?.activityG,
          posture: packet.bracelet?.posture,
          fingerPresent: packet.bracelet?.fingerPresent,
        };
        void insertPacket(rec);

        if (now - lastPrune > PRUNE_EVERY_MS) {
          lastPrune = now;
          void prunePackets();
        }
      },
    );

    return unsub;
  }, [babyId]);
}
