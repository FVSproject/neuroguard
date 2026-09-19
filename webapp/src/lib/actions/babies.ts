"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { Gender as PrismaGender } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { defaultThresholdsList } from "@/lib/thresholds";
import type { Baby, Gender } from "@/lib/types";

async function requireUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

function toGender(g?: Gender): PrismaGender | null {
  if (!g) return null;
  return g.toUpperCase() as PrismaGender;
}
function fromGender(g: PrismaGender | null): Gender | undefined {
  return g ? (g.toLowerCase() as Gender) : undefined;
}

// Shape returned to the client — matches src/lib/types.ts `Baby`.
function serialize(row: {
  id: string;
  name: string;
  dob: Date | null;
  weightKg: number | null;
  heightCm: number | null;
  gender: PrismaGender | null;
  notes: string | null;
  photoDataUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Baby {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob ? row.dob.toISOString().slice(0, 10) : undefined,
    weightKg: row.weightKg ?? undefined,
    heightCm: row.heightCm ?? undefined,
    gender: fromGender(row.gender),
    notes: row.notes ?? undefined,
    photoDataUrl: row.photoDataUrl ?? undefined,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listBabies(): Promise<Baby[]> {
  const userId = await requireUser();
  const rows = await prisma.baby.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(serialize);
}

export async function createBaby(input: {
  baby: Omit<Baby, "id" | "createdAt" | "updatedAt">;
  parent?: { name: string; phone?: string; email?: string; relation?: string };
  contacts?: { name: string; phone: string; relation?: string }[];
}): Promise<Baby> {
  const userId = await requireUser();
  const row = await prisma.$transaction(async (tx) => {
    const baby = await tx.baby.create({
      data: {
        userId,
        name: input.baby.name,
        dob: input.baby.dob ? new Date(input.baby.dob) : null,
        weightKg: input.baby.weightKg ?? null,
        heightCm: input.baby.heightCm ?? null,
        gender: toGender(input.baby.gender),
        notes: input.baby.notes ?? null,
        photoDataUrl: input.baby.photoDataUrl ?? null,
      },
    });
    if (input.parent?.name) {
      await tx.parent.create({
        data: {
          babyId: baby.id,
          name: input.parent.name,
          phone: input.parent.phone ?? null,
          email: input.parent.email ?? null,
          relation: input.parent.relation ?? null,
        },
      });
    }
    if (input.contacts?.length) {
      await tx.emergencyContact.createMany({
        data: input.contacts.map((c, i) => ({
          babyId: baby.id,
          name: c.name,
          phone: c.phone,
          relation: c.relation ?? null,
          order: i,
        })),
      });
    }
    await tx.babyThresholds.create({
      data: { babyId: baby.id, entries: defaultThresholdsList() as object },
    });
    await tx.alarmPrefs.create({
      data: {
        babyId: baby.id,
        soundEnabled: true,
        soundName: "pulse",
        volume: 0.8,
        vibrate: true,
      },
    });
    return baby;
  });

  revalidatePath("/profile");
  revalidatePath("/live");
  return serialize(row);
}

export async function updateBaby(id: string, patch: Partial<Baby>): Promise<Baby> {
  const userId = await requireUser();
  // Verify ownership with a filtered updateMany — never trust the client's id.
  const owned = await prisma.baby.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Not found");

  const row = await prisma.baby.update({
    where: { id },
    data: {
      ...(patch.name       !== undefined && { name: patch.name }),
      ...(patch.dob        !== undefined && { dob: patch.dob ? new Date(patch.dob) : null }),
      ...(patch.weightKg   !== undefined && { weightKg: patch.weightKg ?? null }),
      ...(patch.heightCm   !== undefined && { heightCm: patch.heightCm ?? null }),
      ...(patch.gender     !== undefined && { gender: toGender(patch.gender) }),
      ...(patch.notes      !== undefined && { notes: patch.notes ?? null }),
      ...(patch.photoDataUrl !== undefined && { photoDataUrl: patch.photoDataUrl ?? null }),
    },
  });
  revalidatePath("/profile");
  return serialize(row);
}

export async function deleteBaby(id: string): Promise<void> {
  const userId = await requireUser();
  await prisma.baby.deleteMany({ where: { id, userId } });
  revalidatePath("/profile");
  revalidatePath("/live");
}
