// Черновик конструктора: обрезанные фото хранятся в IndexedDB на устройстве покупателя,
// чтобы они не пропадали при обновлении страницы. Никуда не отправляются, живут 7 дней.
const DB_NAME = "photobrelok";
const STORE = "draft";
const KEY = "current";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DraftItem = { index: number; blob: Blob; hash: string | null };
type Stored = { savedAt: number; items: DraftItem[] };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB недоступен"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

/** true — сохранено; false — хранилище недоступно (например, приватный режим) */
export async function saveDraft(items: DraftItem[]): Promise<boolean> {
  try {
    const value: Stored = { savedAt: Date.now(), items };
    await run("readwrite", (s) => s.put(value, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadDraft(): Promise<Stored | null> {
  try {
    const value = (await run("readonly", (s) => s.get(KEY))) as Stored | undefined;
    if (!value || !Array.isArray(value.items)) return null;
    if (Date.now() - value.savedAt > TTL_MS) {
      await clearDraft();
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // хранилище недоступно: очищать нечего
  }
}
