import Dexie, { type EntityTable } from "dexie";

import type {
  AlarmPrefs,
  Baby,
  BabyThresholds,
  EmergencyContact,
  LogEntry,
  PacketRecord,
  Parent,
} from "./types";

/**
 * IndexedDB schema for NeuroGuard.
 *
 * We deliberately keep everything client-side (no auth, no cloud sync) so a
 * parent's health data never leaves their device. The trade-off is that the
 * data is bound to this browser profile; the Settings page will offer an
 * export as JSON so it can be moved manually.
 */
class NeuroGuardDB extends Dexie {
  babies!:            EntityTable<Baby, "id">;
  parents!:           EntityTable<Parent, "id">;
  emergencyContacts!: EntityTable<EmergencyContact, "id">;
  thresholds!:        EntityTable<BabyThresholds, "babyId">;
  alarmPrefs!:        EntityTable<AlarmPrefs, "babyId">;
  logs!:              EntityTable<LogEntry, "id">;
  packets!:           EntityTable<PacketRecord, "id">;

  constructor() {
    super("neuroguard");
    this.version(1).stores({
      babies:            "id, name, createdAt",
      parents:           "id, babyId",
      emergencyContacts: "id, babyId, [babyId+order]",
      thresholds:        "babyId",
      alarmPrefs:        "babyId",
      logs:              "++id, babyId, tsMs, kind, severity",
      packets:           "++id, babyId, tsMs",
    });
  }
}

// Guard against being imported into a Server Component and blowing up: Dexie
// only works in the browser, so we lazily instantiate on first access.
let _db: NeuroGuardDB | null = null;
export function db(): NeuroGuardDB {
  if (typeof window === "undefined") {
    throw new Error("db() called on the server — must be inside a client component");
  }
  if (!_db) _db = new NeuroGuardDB();
  return _db;
}

// -- Retention --------------------------------------------------------------
// Packets accumulate at ~1 Hz. We keep 7 days per baby by default, capped at
// 500 000 rows so a stuck sensor doesn't fill the database.

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ROWS = 500_000;

export async function pruneOldPackets(): Promise<void> {
  const cutoff = Date.now() - RETENTION_MS;
  const table = db().packets;
  await table.where("tsMs").below(cutoff).delete();

  const total = await table.count();
  if (total > MAX_ROWS) {
    const excess = total - MAX_ROWS;
    const oldest = await table.orderBy("tsMs").limit(excess).primaryKeys();
    await table.bulkDelete(oldest);
  }
}
