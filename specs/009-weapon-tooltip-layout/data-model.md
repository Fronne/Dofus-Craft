# Phase 1 Data Model: Fiche d'arme façon tooltip du jeu

## Entités modifiées

### `ItemStat` (`src/domain/types.ts`)

Champ ajouté pour permettre à la vue de répartir les effets entre les deux sections sans
recalculer une logique de classification côté composant :

| Champ | Type | Description |
|---|---|---|
| `id` | `string` | Inchangé. |
| `label` | `string` | Inchangé. |
| `icon` | `string?` | Inchangé. |
| `positive` | `boolean` | Inchangé. |
| `isWeaponEffect` | `boolean` | **Nouveau.** `true` quand l'effet source a `category === 2` dans les données DofusDB (dommages/vol infligés par l'arme) ; `false` pour tout autre bonus (caractéristique, résistance, etc.). |

Valeur par défaut/portée : ce champ est calculé pour **tous** les objets (pas seulement les
armes) par cohérence de mapping, mais n'est consulté par la vue que lorsque l'objet est une arme
(cf. FR-005 : les objets non-armes gardent une section "Effets" unique regroupant tout, quelle
que soit la valeur de `isWeaponEffect`).

### `ItemDetailData` (type local à `getItemDetail`, `src/data/catalogue-repository.ts`)

Champ ajouté :

| Champ | Type | Description |
|---|---|---|
| `stats` | `ItemStat[]` | Inchangé. |
| `recipe` | `Recipe?` | Inchangé. |
| `resources` | `Resource[]` | Inchangé. |
| `panoplieName` | `string?` | Inchangé. |
| `weaponInfo` | `WeaponInfo?` | **Nouveau.** Présent uniquement quand l'objet est une arme (super-type DofusDB "Arme", id 2). `undefined` pour tout autre objet. |

### `WeaponInfo` (nouveau type, `src/domain/types.ts`)

Regroupe les données de combat propres à une arme, distinctes des effets génériques déjà modélisés
par `ItemStat`. Tous les champs sont optionnels individuellement : une donnée absente côté DofusDB
est omise à l'affichage plutôt que remplacée par une valeur par défaut (Constitution, Principe I ;
FR-008).

| Champ | Type | Source DofusDB | Description |
|---|---|---|---|
| `apCost` | `number?` | `item.apCost` | Coût en Points d'Action pour utiliser l'arme. |
| `minRange` | `number?` | `item.minRange` | Portée minimale. |
| `maxRange` | `number?` | `item.range` | Portée maximale (nom du champ source différent du nom exposé, pour lever l'ambiguïté avec `minRange`). |
| `maxCastPerTurn` | `number?` | `item.maxCastPerTurn` | Nombre de lancers autorisés par tour. |
| `criticalHitProbability` | `number?` | `item.criticalHitProbability` | Taux de coup critique, en pourcentage. |
| `criticalHitBonus` | `number?` | `item.criticalHitBonus` | Bonus infligé en cas de critique. |
| `zoneLabel` | `string?` | dérivé de `item.possibleEffects[].zoneDescr` (forme + `param1`) | Description textuelle de la zone d'effet (ex. "croix de taille 1"), uniquement pour les formes reconnues (cf. research.md §4). |

## Validation rules

- `minRange`/`maxRange` : si les deux sont définis et égaux, la vue affiche une valeur unique ;
  si `maxRange > minRange`, la vue affiche un intervalle ; ce calcul est un détail de présentation,
  pas une nouvelle règle métier (aucune transformation des valeurs sources).
- `WeaponInfo` n'est construit (non `undefined`) que pour les objets dont le super-type
  d'équipement DofusDB vaut `2` ; pour tout autre objet, `weaponInfo` reste `undefined` et
  l'affichage actuel (section "Effets" unique) s'applique sans changement (FR-005).
- Une section ("Effets de l'arme" ou "Effets") n'est rendue par la vue que si le tableau de
  `ItemStat` correspondant (filtré par `isWeaponEffect`) est non vide (FR-006).

## Pas de nouvelle entité persistée

Aucune donnée n'est stockée (pas de nouvelle table D1, pas de nouvelle clé IndexedDB) : `WeaponInfo`
et `isWeaponEffect` sont dérivés à la volée depuis la réponse DofusDB déjà chargée par
`getItemDetail`, au même titre que `ItemStat` aujourd'hui.
