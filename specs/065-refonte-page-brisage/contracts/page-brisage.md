# Contrat d'interface : page Brisage

Contrat entre la page et le joueur (comportement observable) et entre les modules du domaine (fonctions pures). Les noms sont indicatifs ; les tests les figent.

## Contrat de la page

| Zone | Contenu | Comportement |
|------|---------|--------------|
| Recherche | champ « nom de l'objet », bouton Filtres (nombre de filtres actifs, `aria-expanded`) | Premier contenu de la page, aucun titre `h1` redondant au-dessus |
| Panneau de filtres | catégories, niveau min/max, stats en 3 colonnes avec emplacement d'icône, tri (si stats) | Replié par défaut ; état conservé |
| Filtres actifs | pastilles « Retirer … » + « Réinitialiser les filtres » + « N objets » | Visibles panneau replié ou déplié |
| Cartes | environ 6 cartes (icône, nom, niveau, coefficient ou « à saisir »), « Afficher plus » | Carte active : `aria-pressed="true"` |
| En-tête de l'objet | icône, nom, niveau, Achat / Craft / Auto, prix retenu + provenance + les deux prix, coefficient | Apparaît dès qu'une carte est choisie |
| Verdict / conseil | version compacte du verdict existant | Au-dessus du tableau |
| Tableau | colonnes existantes, champ de jet avec min et max, sélecteur Min / Moyen / Max | Aucun `input[type=range]` |
| Ligne du bas | coefficient actuel puis après 1, 2 et 3 brisages (avec gain si connu), valeur estimée des runes | Une seule ligne compacte, qui passe à la ligne sur écran étroit |

États vides et d'erreur : invitation sans objet choisi ; « Aucun objet ne correspond » ; index indisponible (`role="alert"`) ; plage de niveaux invalide (`role="alert"`) ; prix inconnu affiché comme tel.

## Contrat du domaine

```ts
// src/domain/brisage-search.ts
export type StatGroup = 'caracteristiques' | 'degats' | 'resistances';
export function statGroup(effectId: number): StatGroup;            // total, un seul groupe par stat
export type BrowseFilters = {
  query: string; categoryId?: string; effectIds: number[];
  minLevel?: number; maxLevel?: number; sort: SearchSort;
};
export function browseItems(
  items: IndexedItem[], filters: BrowseFilters,
  runes: RuneItem[], settings: BrisageSettings, prices: Record<string, number | undefined>,
): SearchResult[];                                                   // [] si plage invalide

// src/domain/brisage-price.ts
export type ResolvedPrice = { kamas: number; origin: 'hdv' | 'craft' };
export function resolveItemPrice(
  hdvKamas: number | undefined, craftKamas: number | undefined, source: 'hdv' | 'craft' | 'auto',
): ResolvedPrice | undefined;                                        // prix ≤ 0 / NaN = inconnu

// src/persistence/brisage-search-prefs.ts
export type SearchPrefs = { effectIds: number[]; sort: SearchSort; minLevel?: number; maxLevel?: number;
  categoryId?: string; panelOpen: boolean };
```

Garanties testées : même résultat que `searchResults` quand `query` est vide et `categoryId` absent (SC-005) ; `browseItems` ne modifie pas ses entrées ; un prix inconnu ne devient jamais 0 ; `statGroup` couvre toutes les stats ciblables.
