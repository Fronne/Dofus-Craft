type CatalogueCacheEntry = {
  key: string;
  value: unknown;
  savedAt: string;
  formatVersion?: number;
};

// specs/021-background-data-loading (FR-004): bump whenever the shape of what `cached()` stores
// changes (a mapper, an index layout), so entries written by an older app version are ignored and
// refetched instead of being read back in a format the code no longer expects.
export const CATALOGUE_FORMAT_VERSION = 1;

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

  // Like `get`, but only for entries written with the current CATALOGUE_FORMAT_VERSION.
  async getVersioned(key: string): Promise<{ value: unknown; savedAt: string } | undefined> {
    const database = await openDatabase();
    const result = await new Promise<CatalogueCacheEntry | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (!result || result.formatVersion !== CATALOGUE_FORMAT_VERSION) return undefined;
    return { value: result.value, savedAt: result.savedAt };
  },

  async set(key: string, value: unknown): Promise<string> {
    const savedAt = new Date().toISOString();
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ key, value, savedAt, formatVersion: CATALOGUE_FORMAT_VERSION } satisfies CatalogueCacheEntry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return savedAt;
  },
};
