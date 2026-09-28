export type HdvTypeMap = {
  source: string;
  checkedAt: string;
  types: Record<string, 'resources' | 'consumables' | 'animals' | null>;
  excludedTypes: number[];
  listAllExchangeable: number[];
};

export type HdvCandidate = { id: string | number; name: string; imageUrl?: string; typeId: number; exchangeable: boolean };

export type SelectedHdvItem = { id: string; name: string; imageUrl?: string; typeId: number; hdv: 'resources' | 'consumables' | 'animals' };

export class MissingHdvTypesError extends Error {
  typeIds: number[];
}

export function selectHdvItems(input: { typeMap: HdvTypeMap; usefulIds: Set<string>; candidates: HdvCandidate[] }): {
  items: SelectedHdvItem[];
  skipped: { outOfScope: number; excluded: number; notExchangeable: number };
};
