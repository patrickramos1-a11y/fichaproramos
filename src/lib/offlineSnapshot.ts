import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "fieldguide-offline";
const STORE = "snapshot";
const SYNC_QUEUE_STORE = "sync_queue";
const KEY = "db-v1";

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
        if (!d.objectStoreNames.contains(SYNC_QUEUE_STORE)) d.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "operationId" });
      },
    });
  }
  return dbPromise;
}

export type SyncOperationType = "upsert" | "delete" | "restore" | "upload_attachment" | "delete_attachment";

export interface SyncOperation {
  operationId: string;
  table: string;
  recordId: string;
  type: SyncOperationType;
  payload?: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export async function saveSnapshot(userId: string, db: unknown) {
  try {
    const d = await getDB();
    await d.put(STORE, { userId, db, savedAt: Date.now() }, KEY);
  } catch (e) {
    console.warn("[offline] snapshot save failed", e);
  }
}

export async function loadSnapshot(userId: string): Promise<any | null> {
  try {
    const d = await getDB();
    const s = await d.get(STORE, KEY);
    if (s && s.userId === userId) return s.db;
    return null;
  } catch (e) {
    console.warn("[offline] snapshot load failed", e);
    return null;
  }
}

export async function clearSnapshot() {
  try {
    const d = await getDB();
    await d.delete(STORE, KEY);
  } catch {}
}

export async function enqueueSyncOperations(operations: SyncOperation[]) {
  if (!operations.length) return;
  try {
    const d = await getDB();
    const tx = d.transaction(SYNC_QUEUE_STORE, "readwrite");
    await Promise.all(operations.map((operation) => tx.store.put(operation)));
    await tx.done;
  } catch (e) {
    console.warn("[offline] sync queue write failed", e);
  }
}

export async function listSyncOperations(): Promise<SyncOperation[]> {
  try {
    const d = await getDB();
    return await d.getAll(SYNC_QUEUE_STORE);
  } catch (e) {
    console.warn("[offline] sync queue read failed", e);
    return [];
  }
}

export async function removeSyncOperations(operationIds: string[]) {
  if (!operationIds.length) return;
  try {
    const d = await getDB();
    const tx = d.transaction(SYNC_QUEUE_STORE, "readwrite");
    await Promise.all(operationIds.map((id) => tx.store.delete(id)));
    await tx.done;
  } catch (e) {
    console.warn("[offline] sync queue delete failed", e);
  }
}

export async function markSyncOperationsFailed(operationIds: string[], error: string) {
  if (!operationIds.length) return;
  try {
    const d = await getDB();
    const tx = d.transaction(SYNC_QUEUE_STORE, "readwrite");
    await Promise.all(operationIds.map(async (id) => {
      const current = await tx.store.get(id);
      if (!current) return;
      await tx.store.put({
        ...current,
        attempts: Number(current.attempts ?? 0) + 1,
        lastError: error,
      });
    }));
    await tx.done;
  } catch (e) {
    console.warn("[offline] sync queue failure mark failed", e);
  }
}
