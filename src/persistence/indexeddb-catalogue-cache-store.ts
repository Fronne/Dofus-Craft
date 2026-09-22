type CatalogueCacheEntry = {
  key: string;
  value: unknown;
  savedAt: string;
};

const DB_NAME = 'dofus-craft-catalogue-cache';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

// Dedicated, separate database from `dofus-craft` (server-scoped-price-store.ts): the DofusDB
// catalogue is global game data, not scoped by server, and keeping it in its own database means a
// version bump here can never risk a migration on the price stores (specs/010, research.md §1).
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const catalogueCache = {
  async get(key: string): Promise<{ value: unknown; savedAt: string } | undefined> {
    const database = await openDatabase();
    const result = await new Promise<CatalogueCacheEntry | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return result && { value: result.value, savedAt: result.savedAt };
  },

  async set(key: string, value: unknown): Promise<string> {
    const savedAt = new Date().toISOString();
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ key, value, savedAt } satisfies CatalogueCacheEntry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return savedAt;
  },
};
