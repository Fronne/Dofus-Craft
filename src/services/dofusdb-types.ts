export type DofusDbLocalizedText = {
  fr?: string;
  [language: string]: string | undefined;
};

export type DofusDbItemType = {
  id?: number;
  superTypeId?: number;
  categoryId?: number;
  name?: DofusDbLocalizedText;
  superType?: {
    id?: number;
    positions?: number[];
    name?: DofusDbLocalizedText;
  };
};

export type DofusDbItemTypeRecord = DofusDbItemType & {
  id: number;
};

export type DofusDbItem = {
  id: number;
  level?: number;
  name?: DofusDbLocalizedText;
  img?: string;
  type?: DofusDbItemType;
  hasRecipe?: boolean;
  itemSetId?: number;
  effects?: DofusDbItemEffect[];
};

export type DofusDbItemSet = {
  id: number;
  name?: DofusDbLocalizedText;
  items?: DofusDbItem[];
};

export type DofusDbItemEffect = {
  from?: number;
  to?: number;
  characteristic?: number;
  category?: number;
  elementId?: number;
  effectId?: number;
};

export type DofusDbEffect = {
  id: number;
  characteristic?: number;
  useDice?: boolean;
  forceMinMax?: boolean;
  description?: DofusDbLocalizedText;
};

export type DofusDbRecipe = {
  id: number;
  resultId: number;
  ingredientIds?: number[];
  quantities?: number[];
  ingredients?: DofusDbItem[];
};

export type DofusDbPage<T> = {
  total: number;
  limit: number;
  skip: number;
  data: T[];
};

export type DofusDbServer = {
  id: number;
  language?: string;
  gameTypeId?: number;
  monoAccount?: boolean;
  name?: DofusDbLocalizedText;
};
