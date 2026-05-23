import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "fieldguide-offline";
const STORE = "snapshot";
const KEY = "db-v1";

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
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