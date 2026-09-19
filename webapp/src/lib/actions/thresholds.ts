"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { defaultThresholdsList } from "@/lib/thresholds";
import type { ThresholdConfig } from "@/lib/types";

async function requireUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

async function requireOwnership(babyId: string): Promise<void> {
  const userId = await requireUser();
  const owned = await prisma.baby.findFirst({
    where: { id: babyId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");
}

export async function getThresholds(babyId: string): Promise<ThresholdConfig[]> {
  await requireOwnership(babyId);
  const row = await prisma.babyThresholds.findUnique({ where: { babyId } });
  return (row?.entries as unknown as ThresholdConfig[]) ?? defaultThresholdsList();
}

export async function saveThresholds(
  babyId: string,
  entries: ThresholdConfig[],
): Promise<void> {
  await requireOwnership(babyId);
  await prisma.babyThresholds.upsert({
    where: { babyId },
    create: { babyId, entries: entries as object },
    update: { entries: entries as object },
  });
  revalidatePath("/settings");
  revalidatePath("/live");
}
