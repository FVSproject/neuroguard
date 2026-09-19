"use client";

/**
 * Local (per-browser) packet ring-buffer.
 *
 * Full 1 Hz packets are far too chatty to push to Postgres — we'd burn Neon's
 * free-tier compute quota in a week. Instead we keep the last N days of
 * downsampled packets in the browser's IndexedDB using a hand-rolled schema
 * (no library — the API surface is tiny, one table).
 *
 * The Reports tab reads from this. The Logs tab reads from the DB (which only
 * stores rare alarm events).
 */

import type { PacketRecord } from "./types";

const DB_NAME = "neuroguard-packets";
const STORE = "packets";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const MAX_ROWS = 500_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("babyId_tsMs", ["babyId", "tsMs"]);
      store.createIndex("tsMs", "tsMs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function insertPacket(rec: Omit<PacketRecord, "id">): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function packetsSince(babyId: string, cutoffMs: number): Promise<PacketRecord[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const idx = store.index("babyId_tsMs");
    const range = IDBKeyRange.bound([babyId, cutoffMs], [babyId, Number.POSITIVE_INFINITY]);
    const req = idx.getAll(range);
    req.onsuccess = () => resolve(req.result as PacketRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function prunePackets(): Promise<void> {
  const db = await open();
  const cutoff = Date.now() - RETENTION_MS;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const idx = tx.objectStore(STORE).index("tsMs");
    const range = IDBKeyRange.upperBound(cutoff);
    const req = idx.openCursor(range);
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { cur.delete(); cur.continue(); } else { resolve(); }
    };
    req.onerror = () => reject(req.error);
  });

  // Coarse row-count cap so a stuck sensor can't fill the DB.
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const excess = countReq.result - MAX_ROWS;
      if (excess <= 0) { resolve(); return; }
      const idx = store.index("tsMs");
      const req = idx.openCursor();
      let deleted = 0;
      req.onsuccess = () => {
        const cur = req.result;
        if (cur && deleted < excess) {
          cur.delete(); deleted++; cur.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
}

export async function clearAllPackets(): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
