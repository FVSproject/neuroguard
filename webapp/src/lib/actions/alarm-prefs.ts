"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { AlarmPrefs } from "@/lib/types";

async function requireOwnership(babyId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  const owned = await prisma.baby.findFirst({
    where: { id: babyId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");
}

const DEFAULTS: Omit<AlarmPrefs, "babyId" | "updatedAt"> = {
  soundEnabled: true,
  soundName: "pulse",
  volume: 0.8,
  vibrate: true,
};

export async function getAlarmPrefs(babyId: string): Promise<AlarmPrefs> {
  await requireOwnership(babyId);
  const row = await prisma.alarmPrefs.findUnique({ where: { babyId } });
  if (!row) return { babyId, ...DEFAULTS, updatedAt: Date.now() };
  return {
    babyId: row.babyId,
    soundEnabled: row.soundEnabled,
    soundName: row.soundName as AlarmPrefs["soundName"],
    volume: row.volume,
    vibrate: row.vibrate,
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function saveAlarmPrefs(
  babyId: string,
  patch: Partial<Omit<AlarmPrefs, "babyId" | "updatedAt">>,
): Promise<void> {
  await requireOwnership(babyId);
  await prisma.alarmPrefs.upsert({
    where: { babyId },
    create: { babyId, ...DEFAULTS, ...patch },
    update: patch,
  });
  revalidatePath("/settings");
}
