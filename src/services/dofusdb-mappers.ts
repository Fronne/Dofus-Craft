import type { Category, CatalogueItemKind, Ingredient, Item, Recipe, Resource } from '../domain/types';
import type { DofusDbItem, DofusDbItemTypeRecord, DofusDbRecipe } from './dofusdb-types';

const RESOURCE_SUPER_TYPE_ID = 9;
const CRAFTCHECK_EQUIPMENT_SUPER_TYPE_IDS = new Set([1, 2, 3, 4, 5, 7, 10, 11, 13]);
const CRAFTCHECK_EQUIPMENT_TYPE_IDS = new Set([151, 217]);
const CATEGORY_SORT_ORDER = new Map([
  [2, 1],
  [1, 2],
  [3, 3],
  [10, 4],
  [11, 5],
  [4, 6],
  [5, 7],
  [7, 8],
  [151, 9],
  [217, 10],
]);
const CATEGORY_ICON_URLS: Record<string, string> = {
  'equipment-type-1': 'https://api.dofusdb.fr/img/items/1016.png',
  'equipment-type-2': 'https://api.dofusdb.fr/img/items/6007.png',
  'equipment-type-3': 'https://api.dofusdb.fr/img/items/9011.png',
  'equipment-type-4': 'https://api.dofusdb.fr/img/items/10030.png',
  'equipment-type-5': 'https://api.dofusdb.fr/img/items/11027.png',
  'equipment-type-7': 'https://api.dofusdb.fr/img/items/82274.png',
  'equipment-type-10': 'https://api.dofusdb.fr/img/items/16378.png',
  'equipment-type-11': 'https://api.dofusdb.fr/img/items/17016.png',
  'equipment-type-151': 'https://api.dofusdb.fr/img/items/151002.png',
  'equipment-type-217': 'https://api.dofusdb.fr/img/items/217032.png',
};

function superTypeId(item: DofusDbItem | DofusDbItemTypeRecord): number | undefined {
  if (isDofusDbItem(item)) return item.type?.superType?.id ?? item.type?.superTypeId;
  return item.superType?.id ?? item.superTypeId;
}

function superTypePositions(item: DofusDbItem | DofusDbItemTypeRecord): number[] | undefined {
  if (isDofusDbItem(item)) return item.type?.superType?.positions;
  return item.superType?.positions;
}

function typeCategoryId(item: DofusDbItem | DofusDbItemTypeRecord): number | undefined {
  if (isDofusDbItem(item)) return item.type?.categoryId;
  return item.categoryId;
}

function typeId(item: DofusDbItem | DofusDbItemTypeRecord): number | undefined {
  if (isDofusDbItem(item)) return item.type?.id;
  return item.id;
}

function isDofusDbItem(value: DofusDbItem | DofusDbItemTypeRecord): value is DofusDbItem {
  return 'type' in value;
}

function isEquipment(item: DofusDbItem | DofusDbItemTypeRecord): boolean {
  const categoryId = typeCategoryId(item);
  const itemTypeId = typeId(item);
  const superId = superTypeId(item);
  if (superId === 13) return itemTypeId !== undefined && CRAFTCHECK_EQUIPMENT_TYPE_IDS.has(itemTypeId);
  if (categoryId !== undefined) {
    return categoryId === 0 &&
      superId !== undefined &&
      CRAFTCHECK_EQUIPMENT_SUPER_TYPE_IDS.has(superId);
  }
  const positions = superTypePositions(item);
  if (positions) {
    return positions.length > 0 &&
      superId !== undefined &&
      CRAFTCHECK_EQUIPMENT_SUPER_TYPE_IDS.has(superId);
  }
  return superId !== undefined && CRAFTCHECK_EQUIPMENT_SUPER_TYPE_IDS.has(superId);
}

function equipmentCategoryId(item: DofusDbItem | DofusDbItemTypeRecord): string {
  const superId = superTypeId(item);
  const itemTypeId = typeId(item);
  return `equipment-type-${superId === 13 ? itemTypeId : superId}`;
}

function categoryLabel(type: DofusDbItemTypeRecord): string | undefined {
  const superId = superTypeId(type);
  if (superId === 13) return type.name?.fr;
  return type.superType?.name?.fr;
}

export function mapDofusDbCategories(types: DofusDbItemTypeRecord[]): Category[] {
  const groups = new Map<string, Category>();
  for (const type of types) {
    const superId = superTypeId(type);
    const equipment = isEquipment(type);
    if (superId === undefined || !equipment) continue;
    const label = categoryLabel(type);
    if (!label) continue;
    const categoryId = equipmentCategoryId(type);
    const existing = groups.get(categoryId);
    if (existing) {
      existing.typeIds.push(type.id);
      continue;
    }
    groups.set(categoryId, {
      id: categoryId,
      label,
      kind: 'Equipment',
      sortOrder: CATEGORY_SORT_ORDER.get(type.id) ?? groups.size + 1,
      typeIds: [type.id],
      iconUrl: CATEGORY_ICON_URLS[categoryId],
    });
  }
  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getDofusDbItemKind(item: DofusDbItem): CatalogueItemKind | undefined {
  const itemSuperTypeId = superTypeId(item);
  if (itemSuperTypeId === RESOURCE_SUPER_TYPE_ID) return 'Resource';
  if (itemSuperTypeId !== undefined && isEquipment(item)) return 'Equipment';
  return undefined;
}

export function mapDofusDbItem(item: DofusDbItem): Item | undefined {
  const kind = getDofusDbItemKind(item);
  if (!kind) return undefined;
  const name = item.name?.fr?.trim();
  if (!name) throw new Error(`L’item DofusDB ${item.id} ne possède pas de nom français.`);
  const imageUrl = item.img && !item.img.endsWith('/undefined.png') ? item.img : undefined;
  return {
    id: String(item.id),
    name,
    level: typeof item.level === 'number' ? item.level : undefined,
    kind,
    categoryId: kind === 'Equipment' ? equipmentCategoryId(item) : 'resource',
    imageUrl,
    recipeId: item.hasRecipe ? String(item.id) : undefined,
  };
}

export function mapDofusDbResource(item: DofusDbItem): Resource {
  const name = item.name?.fr?.trim();
  if (!name) throw new Error(`L’item DofusDB ${item.id} ne possède pas de nom français.`);
  const imageUrl = item.img && !item.img.endsWith('/undefined.png') ? item.img : undefined;
  return { id: String(item.id), name, imageUrl };
}

export function mapDofusDbRecipe(recipe: DofusDbRecipe, ingredients: DofusDbItem[]): Recipe {
  if (!recipe.ingredientIds || !recipe.quantities || recipe.ingredientIds.length !== recipe.quantities.length) {
    throw new Error(`La recette DofusDB ${recipe.id} est invalide.`);
  }
  const mappedIngredients: Ingredient[] = recipe.ingredientIds.map((resourceId, index) => {
    const quantity = recipe.quantities?.[index];
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Quantité invalide dans la recette ${recipe.id}.`);
    }
    return { resourceId: String(resourceId), quantity };
  });
  if (ingredients.length !== mappedIngredients.length) {
    throw new Error(`Les ingrédients de la recette DofusDB ${recipe.id} sont incomplets.`);
  }
  return { id: String(recipe.id), itemId: String(recipe.resultId), ingredients: mappedIngredients };
}
