// Черновик конструктора: обрезанные фото хранятся в IndexedDB на устройстве покупателя,
// чтобы они не пропадали при обновлении страницы. Никуда не отправляются, живут 7 дней.
const DB_NAME = "photobrelok";
const STORE = "draft";
const KEY = "current";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DraftItem = { index: number; blob: Blob; hash: string | null };
/**
 * Фото хранится как байты (ArrayBuffer), а не как Blob: Blob в IndexedDB — файл, который встроенные браузеры
 * (Instagram, Facebook на iPhone) со временем теряют, и фото на экране есть, а прочитать его при отправке нельзя.
 * Старый формат (поле blob) читается и проверяется при возврате.
 */
type StoredItem = { index: number; hash: string | null; data?: ArrayBuffer; type?: string; blob?: Blob };
type Stored = { savedAt: number; items: StoredItem[] };
export type Draft = { savedAt: number; items: DraftItem[]; /** сколько фото не удалось вернуть (нечитаемые) */ lost: number };

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
    const stored: StoredItem[] = [];
    for (const it of items) {
      try {
        stored.push({ index: it.index, hash: it.hash, data: await it.blob.arrayBuffer(), type: it.blob.type || "image/jpeg" });
      } catch {
        // фото уже нечитаемо — в черновик не кладём
      }
    }
    if (stored.length === 0) return items.length === 0;
    const value: Stored = { savedAt: Date.now(), items: stored };
    await run("readwrite", (s) => s.put(value, KEY));
    return true;
  } catch {
    return false;
  }
}

/** Возвращает только читаемые фото; нечитаемые отбрасываются и считаются в lost. */
export async function loadDraft(): Promise<Draft | null> {
  try {
    const value = (await run("readonly", (s) => s.get(KEY))) as Stored | undefined;
    if (!value || !Array.isArray(value.items)) return null;
    if (Date.now() - value.savedAt > TTL_MS) {
      await clearDraft();
      return null;
    }
    const items: DraftItem[] = [];
    let lost = 0;
    for (const it of value.items) {
      try {
        if (it.data instanceof ArrayBuffer) {
          items.push({ index: it.index, hash: it.hash, blob: new Blob([it.data], { type: it.type || "image/jpeg" }) });
        } else if (it.blob instanceof Blob) {
          // старый формат: проверяем, что файл ещё читается, и переписываем байтами
          const data = await it.blob.arrayBuffer();
          items.push({ index: it.index, hash: it.hash, blob: new Blob([data], { type: it.blob.type || "image/jpeg" }) });
        } else {
          lost++;
        }
      } catch {
        lost++;
      }
    }
    return { savedAt: value.savedAt, items, lost };
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
