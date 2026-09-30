export type Category={id:string;label:string;sortOrder:number;kind:'Equipment'|'Resource';typeIds:number[]}; export type CatalogueItemKind='Equipment'|'Resource'; export type Resource={id:string;name:string;imageUrl?:string;craftable?:boolean}; export type Ingredient={resourceId:string;quantity:number}; export type Recipe={id:string;itemId:string;ingredients:Ingredient[]}; export type ItemStat={id:string;label:string;icon?:string;positive:boolean;isWeaponEffect:boolean}; export type Item={id:string;name:string;level?:number;kind:CatalogueItemKind;categoryId:string;imageUrl?:string;recipeId?:string}; export type ResourcePrice={resourceId:string;unitPriceKamas:number;updatedAt:string}; export type Recommendation='craft'|'buy'|'equal'|'insufficient-data'; export type Comparison={lines:{resourceId:string;quantity:number;unitPriceKamas?:number;subtotalKamas?:number}[];knownCraftCostKamas:number;missingResourceIds:string[];craftCostStatus:'complete'|'partial';marketPriceKamas?:number;recommendation:Recommendation;differenceKamas?:number;percentage?:number;percentageBase?:'craft-cost'|'market-price'};
export type ServerId=string;
export type PinnedItemPrice={itemId:string;marketPriceKamas:number;updatedAt:string};
export type CommunityPrice={resourceId:string;serverId:string;medianAmountKamas:number;sampleSize:number;lastContributionAt?:string;latestAmountKamas:number;latestContributionAt:string;latestOrigin?:'manual'|'capture'|'bot'};

// specs/015-intermediate-craft-costs: a resource's own recipe, fetched as needed. `null` means
// checked and not craftable (no recipe, or none could be obtained); a missing key means not loaded yet.
export type RecipeTree = { recipes: Record<string, Recipe | null>; resources: Record<string, Resource> };
export type IngredientChoice = 'buy' | 'craft';
export type RetainedOption = 'buy' | 'craft' | 'missing';
// Computed, never stored (FR-008): how one resource is counted at one place in the craft chain.
export type RetainedCost = {
  resourceId: string;
  purchaseKamas?: number;
  recipeKamas?: number;
  children?: { quantity: number; cost: RetainedCost }[];
  option: RetainedOption;
  forced: boolean;
  unitKamas?: number;
};
