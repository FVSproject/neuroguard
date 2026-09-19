"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type {
  LogKind as PrismaLogKind,
  LogSeverity as PrismaLogSeverity,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { LogEntry, LogSeverity } from "@/lib/types";

async function requireOwnership(babyId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  const owned = await prisma.baby.findFirst({
    where: { id: babyId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");
}

function serialize(row: {
  id: number;
  babyId: string;
  tsMs: bigint;
  kind: PrismaLogKind;
  metric: string | null;
  severity: PrismaLogSeverity;
  message: string;
  value: number | null;
}): LogEntry {
  return {
    id: row.id,
    babyId: row.babyId,
    tsMs: Number(row.tsMs),
    kind: row.kind.toLowerCase() as LogEntry["kind"],
    metric: row.metric as LogEntry["metric"],
    severity: row.severity.toLowerCase() as LogSeverity,
    message: row.message,
    value: row.value ?? undefined,
  };
}

export async function listLogs(
  babyId: string,
  limit = 500,
): Promise<LogEntry[]> {
  await requireOwnership(babyId);
  const rows = await prisma.logEntry.findMany({
    where: { babyId },
    orderBy: { tsMs: "desc" },
    take: limit,
  });
  return rows.map(serialize);
}

export async function appendLog(
  entry: Omit<LogEntry, "id">,
): Promise<void> {
  await requireOwnership(entry.babyId);
  await prisma.logEntry.create({
    data: {
      babyId: entry.babyId,
      tsMs: BigInt(entry.tsMs),
      kind: entry.kind.toUpperCase() as PrismaLogKind,
      metric: entry.metric ?? null,
      severity: entry.severity.toUpperCase() as PrismaLogSeverity,
      message: entry.message,
      value: entry.value ?? null,
    },
  });
  revalidatePath("/logs");
}

export async function clearLogs(babyId: string): Promise<void> {
  await requireOwnership(babyId);
  await prisma.logEntry.deleteMany({ where: { babyId } });
  revalidatePath("/logs");
}
