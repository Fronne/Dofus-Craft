import manifest from '../catalogue-manifest.json';

export const getManifest = () => ({
  ...manifest,
  sourceName: 'DofusDB',
  sourceUrl: 'https://api.dofusdb.fr',
});

export { preloadCatalogueIndexes, whenCatalogueReady } from './indexes';
export { searchItems, getCategories } from './search';
export { getItemDetail, getResourceRecipe, getResourceDetails } from './item-detail';
export { effectRangesOf, negativeRangesOf, getItemEffectLines, getItemEffectRanges, getItemNegativeRanges } from './effects';
