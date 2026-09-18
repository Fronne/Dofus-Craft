type ServerScopedPriceRecord = {
  serverId: string;
  entryId: string;
  amountKamas: number;
  updatedAt: string;
};

interface ServerScopedPriceStore {
  get(serverId: string, entryId: string): Promise<ServerScopedPriceRecord | undefined>;
  getMany(serverId: string, entryIds: string[]): Promise<Record<string, ServerScopedPriceRecord>>;
  save(serverId: string, entryId: string, amountKamas: number): Promise<ServerScopedPriceRecord>;
  remove(serverId: string, entryId: string): Promise<void>;
  removeAllForEntry(entryId: string): Promise<void>;
  listAllForServer(serverId: string): Promise<ServerScopedPriceRecord[]>;
}

const DB_NAME = 'dofus-craft';
const DB_VERSION = 4;

/**
 * Every server-scoped store must be registered here so a single IndexedDB version upgrade
 * creates them all together. Adding a future server-scoped data type only requires appending
 * its store name to this list (FR-013). `community-mode-prices-by-server` is a physically
 * separate store from `resource-prices-by-server` on purpose: it backs the Mode communautaire
 * carnet, which spec.md FR-005 requires to never read from or write to the Mode personnel carnet.
 */
const REGISTERED_STORES = [
  'resource-prices-by-server',
  'pinned-item-prices-by-server',
  'community-mode-prices-by-server',
];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of REGISTERED_STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: ['serverId', 'entryId'] });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createServerScopedPriceStore(storeName: string): ServerScopedPriceStore {
  return {
    async get(serverId, entryId) {
      return (await this.getMany(serverId, [entryId]))[entryId];
    },
    async getMany(serverId, entryIds) {
      const database = await openDatabase();
      const transaction = database.transaction(storeName, 'readonly');
      const objectStore = transaction.objectStore(storeName);
      const output: Record<string, ServerScopedPriceRecord> = {};
      await Promise.all(
        entryIds.map(
          (entryId) =>
            new Promise<void>((resolve, reject) => {
              const request = objectStore.get([serverId, entryId]);
              request.onsuccess = () => {
                if (request.result) output[entryId] = request.result;
                resolve();
              };
              request.onerror = () => reject(request.error);
            }),
        ),
      );
      database.close();
      return output;
    },
    async save(serverId, entryId, amountKamas) {
      if (!Number.isInteger(amountKamas) || amountKamas < 0) throw new Error('Prix invalide');
      const record: ServerScopedPriceRecord = {
        serverId,
        entryId,
        amountKamas,
        updatedAt: new Date().toISOString(),
      };
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      return record;
    },
    async remove(serverId, entryId) {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).delete([serverId, entryId]);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    async removeAllForEntry(entryId) {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (cursor.value.entryId === entryId) cursor.delete();
          cursor.continue();
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    async listAllForServer(serverId) {
      const database = await openDatabase();
      const records: ServerScopedPriceRecord[] = [];
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (cursor.value.serverId === serverId) records.push(cursor.value);
          cursor.continue();
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      return records;
    },
  };
}
