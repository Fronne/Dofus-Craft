export type CatalogueSnapshotMeta = {
  version: 1;
  generatedAt: string;
  source: 'DofusDB';
  totals: { items: number; itemSets: number };
};

export function projectItem<T extends { id: number }>(item: T): T;
export function projectItemSet<T extends { id: number }>(itemSet: T): T;
export function buildCatalogueSnapshot(options?: {
  fetchImpl?: typeof fetch;
  outDir?: URL;
  log?: (message: string) => void;
}): Promise<CatalogueSnapshotMeta>;
