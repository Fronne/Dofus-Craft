# Modèle de données : Refonte de la page Brisage

Aucune donnée serveur nouvelle. Ce sont des types de domaine, un champ ajouté à l'index local et des préférences navigateur.

## Index des équipements (`src/data/brisage-items.json`)

`IndexedItem` (existant) gagne :

| Champ | Type | Règle |
|-------|------|-------|
| `categoryId` | `string` | `equipment-type-<superTypeId>` ; trophées et prysmaradites : `equipment-type-151`. Obligatoire pour tout objet de l'index régénéré. |

Lecture (`brisage-items-repository.ts`) : un objet sans `categoryId` valide est conservé avec `categoryId` absent (il reste trouvable sans filtre de catégorie, jamais listé sous une catégorie) ; cela garde l'application utilisable avec un ancien JSON.

## Filtre de recherche (`ItemFilters`)

| Champ | Type | Défaut | Règle |
|-------|------|--------|-------|
| `query` | `string` | `''` | Nom, sans accents ni casse ; tous les mots doivent être présents ; sous 2 caractères, ignoré (pas de filtre). Non persisté. |
| `categoryId` | `string \| undefined` | tous | Doit exister dans les catégories d'équipement connues, sinon ignoré. |
| `minLevel`, `maxLevel` | `number \| undefined` | aucun | Entiers ≥ 1 ; min > max est une erreur affichée (`levelRangeError`) et la liste n'est pas filtrée par niveau. |
| `effectIds` | `number[]` | `[]` | Stats ciblables seulement ; l'objet doit porter **toutes** les stats (règle de `specs/064`). |
| `sort` | `'runes' \| 'kamas' \| 'maxRoll'` | `'runes'` | Utilisé seulement si des stats sont choisies ; sans stat : niveau décroissant puis nom. |
| `panelOpen` | `boolean` | `false` | Panneau de filtres déplié ou replié ; persisté. |

Persistance : clé existante `craftcheck-brisage-search` ; `categoryId` et `panelOpen` sont ajoutés, une valeur absente ou de mauvais type retombe sur le défaut.

## Groupe de stats

`StatGroup = 'caracteristiques' | 'degats' | 'resistances'` (libellés : Caractéristiques, Dommages, Résistances). `statGroup(effectId)` est total : toute stat ciblable appartient à exactement un groupe.

## Résultat d'une carte (`SearchResult`, existant, étendu)

`SearchResult` reste tel quel. Sans stat choisie, `perStat` est vide, `totalRunes` 0 et `valueKamas` indéfini. La carte affiche en plus le coefficient enregistré de l'objet (`getStoredCoefficient`), lu côté interface, pas stocké dans le résultat.

## Prix de l'objet

| Entité | Champs | Règle |
|--------|--------|-------|
| `PriceSource` | `'hdv' \| 'craft' \| 'auto'` | Existant + `'auto'` ; valeur par défaut d'un nouvel objet : `'auto'`. |
| `ResolvedPrice` | `{ kamas: number; origin: 'hdv' \| 'craft' } \| undefined` | Valeurs ≤ 0, `NaN` ou absentes : inconnues. Auto : minimum des prix connus ; égalité → `'hdv'`. Absent si aucun prix connu (repli : prix saisi). |

## Session de brisage (existant)

`BrisageSession` (`serverId`, objet, jets, coefficient saisi, prix saisi, `priceSource`) est inchangée ; seul `priceSource` accepte `'auto'`. Une session écrite avant cette version se relit sans migration.

## Coefficients enregistrés (existant)

`StoredCoefficient` (`coefficient`, `savedAt`) par serveur et objet : inchangé, lu pour les cartes et l'en-tête.

## Transitions d'état de la page

1. **Aucun objet choisi** : champ, filtres, cartes ; ni en-tête ni tableau.
2. **Objet choisi** : carte en évidence, en-tête, tableau et ligne du bas. Changer de carte repasse par les lectures de stats et de prix (états de chargement existants).
3. **Filtres changés alors qu'un objet est choisi** : l'objet reste affiché même s'il quitte la liste.
4. **Rechargement** : filtres, panneau, mode de prix et objet (avec ses jets et coefficient saisis) sont relus.
