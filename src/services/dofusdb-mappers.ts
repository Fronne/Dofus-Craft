import type { Category, CatalogueItemKind, Ingredient, Item, Recipe, Resource } from '../domain/types';
import type { Server } from '../domain/servers';
import type { DofusDbItem, DofusDbItemTypeRecord, DofusDbRecipe, DofusDbServer } from './dofusdb-types';
import { stripDiacritics } from './text';

/** Permanent servers use gameTypeId 0. Other values are Dofus Retro (2), short-lived event
 * servers like Tournois/Speed Rush (3), and other non-standard entries (4, seen on "Ombre"). */
const PERMANENT_SERVER_GAME_TYPE_ID = 0;

const RESOURCE_SUPER_TYPE_ID = 9;
export const WEAPON_SUPER_TYPE_ID = 2;
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

function superTypeId(item: DofusDbItem | DofusDbItemTypeRecord): number | undefined {
  if (isDofusDbItem(item)) return item.type?.superType?.id ?? item.type?.superTypeId;
  return item.superType?.id ?? item.superTypeId;
}

export function isWeapon(item: DofusDbItem): boolean {
  return superTypeId(item) === WEAPON_SUPER_TYPE_ID;
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

/** DofusDB files Trophées (151) and Prysmaradites (217) under the same super type (13, shared
 * with Dofus eggs, which CraftCheck excludes — see isEquipment above) but gives that super type
 * itself a composite name ("Dofus / Trophée / Prysmaradite"). The two item types are in-game
 * equivalents for CraftCheck's purposes, so they're folded into a single "Trophée" category
 * instead of the generic per-super-type grouping used for everything else. */
const TROPHY_CATEGORY_ID = 'equipment-type-151';

function equipmentCategoryId(item: DofusDbItem | DofusDbItemTypeRecord): string {
  const superId = superTypeId(item);
  if (superId === 13) return TROPHY_CATEGORY_ID;
  return `equipment-type-${superId}`;
}

function categoryLabel(type: DofusDbItemTypeRecord): string | undefined {
  const superId = superTypeId(type);
  if (superId === 13) return 'Trophée';
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
  // specs/015: DofusDB flags every item — ingredients embedded in a recipe included — with
  // `hasRecipe`, which is what tells a craftable intermediate resource apart without another request.
  return typeof item.hasRecipe === 'boolean'
    ? { id: String(item.id), name, imageUrl, craftable: item.hasRecipe }
    : { id: String(item.id), name, imageUrl };
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

function isFlaggedServerName(name: DofusDbServer['name']): boolean {
  if (!name) return false;
  return Object.values(name).some((value) => typeof value === 'string' && value.trim().startsWith('[!]'));
}

function slugifyServerName(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Keeps only permanent servers: DofusDB also lists Dofus Retro, short-lived event servers
 * (Speed Rush, Tournois) and other non-standard entries under distinct gameTypeIds, and flags a
 * couple of special/inactive ones with a "[!]" prefix on their non-French names. */
export function mapDofusDbServers(servers: DofusDbServer[]): Server[] {
  return servers
    .filter((server) => server.gameTypeId === PERMANENT_SERVER_GAME_TYPE_ID && !isFlaggedServerName(server.name))
    .map((server): Server | undefined => {
      const name = server.name?.fr?.trim();
      return name ? { id: slugifyServerName(name), name, type: server.monoAccount ? 'mono' : 'multi' } : undefined;
    })
    .filter((server): server is Server => server !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
}
