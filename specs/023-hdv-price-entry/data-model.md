# Data Model: Page Saisie HDV

## HdvId

`'resources' | 'consumables' | 'animals'` — les trois onglets, dans cet ordre. Libellés :
« Ressources », « Consommables », « Créatures ».

## Correspondance type → HDV (`scripts/data/hdv-type-map.json`)

Entrée du script, écrite à la main. Voir [contracts/hdv-type-map.md](./contracts/hdv-type-map.md).

| Champ | Type | Règle |
|---|---|---|
| `source` | string | « Relevé en jeu par le porteur du projet » |
| `checkedAt` | date ISO | date de la validation en jeu |
| `types` | `Record<typeId, HdvId \| null>` | `null` = hors périmètre (HDV Runes, équipements…) ; un type absent n'est jamais deviné |
| `excludedTypes` | `number[]` | types jamais listés même s'ils sont utiles (Certificat de Dragodinde 97) |
| `listAllExchangeable` | `number[]` | types dont tous les objets échangeables sont listés, utiles ou non (Nourriture pour familier 209, FR-004b) |

## Objet d'HDV (`src/data/hdv-items.json`, entrée `items[]`)

| Champ | Type | Règle |
|---|---|---|
| `id` | string | id DofusDB de l'objet = clé du carnet de prix (même clé que la Recherche) |
| `name` | string | nom français |
| `imageUrl` | string? | icône DofusDB |
| `typeId` | number | type DofusDB, doit être rattaché à `hdv` dans la correspondance |
| `hdv` | HdvId | un seul HDV par objet |

Invariants : `id` unique ; objet échangeable ; objet utile (ingrédient d'une recette **ou** ressource
du tableau d'XP familier) **ou** de type `listAllExchangeable` ; type absent de `excludedTypes`.

Fichier complet : voir [contracts/hdv-items-data.md](./contracts/hdv-items-data.md).

## Prix relevé

Aucune nouvelle entité : `ResourcePrice` existant (`resourceId`, `unitPriceKamas`, `updatedAt`),
par serveur, dans le carnet du mode actif (`resourcePricesFor(priceMode)`).

## État de la page (non persisté sauf mention)

| Champ | Type | Règle |
|---|---|---|
| `tab` | HdvId | mémorisé en localStorage (`craftcheck-hdv-tab`), défaut `resources` |
| `query` | string | filtre nom, comparaison via `normalizeSearchText` |
| `typeFilter` | number \| '' | seulement les types présents dans l'onglet |
| `priceFilter` | `'all' \| 'missing' \| 'old'` | `missing` = pas d'entrée dans le carnet ; `old` = âge `stale` ou `expired` (`price-age.ts`) |
| `shown` | number | taille de la tranche affichée, +25 au défilement, remise à 25 à chaque changement de filtre |

## Décompte

`countPriced(items, prices) = { priced, total }` sur **tous** les objets de l'onglet (pas seulement
les filtrés), pour le serveur et le mode actifs.
