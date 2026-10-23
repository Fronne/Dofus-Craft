# Modèle de données : Classement de brisage

Rien n'est stocké côté serveur pour l'essentiel ; ce sont des vues calculées en mémoire à partir de données existantes.

## RankingRow (calculée, jamais enregistrée)

| Champ | Type | Origine / règle |
|-------|------|-----------------|
| `itemId`, `name`, `level`, `imageUrl`, `categoryId` | texte / nombre | index `brisage-items.json` |
| `priceKamas` | nombre > 0 | prix HDV du mode actif (carnet ou partage) |
| `priceUpdatedAt` | date | `updatedAt` / `contributedAt` du prix |
| `coefficient` | nombre ou absent | le plus récent entre local et partagé |
| `coefficientAt` | date ou absent | date de ce coefficient |
| `group` | `'known'` ou `'unknown'` | selon la présence d'un coefficient |
| `status` | `'ok'`, `'missing-rune-price'`, `'no-breakable-line'`, `'no-price'` | état du calcul ; `no-price` = objet de l'index sans prix HDV (affiché seulement si « masquer sans prix » est décoché) |
| `best` | `{ kind: 'normal'` ou `'focus'`, `focusRuneName? }` | meilleur choix de l'analyse |
| `gainKamas` | nombre ou absent | seulement si `group = 'known'` et `status = 'ok'` |
| `thresholdCoefficient` | nombre ou absent | seuil de rentabilité du meilleur choix |
| `neverProfitable` | booléen | seuil > 100 % (groupe `unknown`) |
| `exo` | `{ effectId, statLabel, runeName, runePriceKamas, gainKamas?, improvementKamas?, thresholdCoefficient? }` ou absent | meilleur exo, seulement s'il dépasse le gain sans exo ; groupe `known` : `gainKamas` et `improvementKamas` ; groupe `unknown` : seulement `thresholdCoefficient`, recalculé avec le prix de l'objet + `runePriceKamas` |
| `oldestRunePriceAt` | date ou absent | la plus ancienne des dates de runes utilisées |

Règles :
- Un objet sans prix n'a pas de gain ; il n'apparaît que si « masquer les objets sans prix » est décoché.
- `status = 'missing-rune-price'` : aucune valeur n'est comblée, la ligne va en fin de liste.
- Le groupe `unknown` n'a jamais de `gainKamas`.

## RankingView (état de l'écran)

| Champ | Type | Règle |
|-------|------|-------|
| `sortColumn` | `'name'`, `'level'`, `'price'`, `'gain'`, `'threshold'`, `'exoGain'` | défaut `'gain'` |
| `sortDirection` | `'asc'` ou `'desc'` | défaut `'desc'` ; le groupe `unknown` est trié par seuil croissant par défaut |
| `levelMin`, `levelMax` | nombres ou absents | `levelMin ≤ levelMax`, sinon message d'erreur |
| `categoryId` | texte ou absent | catégories de la page Recherche ; un objet sans `categoryId` dans l'index est exclu dès qu'une catégorie est choisie |
| `minGainKamas` | nombre ou absent | s'applique au groupe `known` |
| `hideWithoutPrice`, `hideWithoutCoefficient` | booléens | `hideWithoutPrice` coché par défaut, `hideWithoutCoefficient` décoché |

Conservé dans `BrisagePage` tant que l'utilisateur reste sur la page (survit à l'ouverture d'une fiche).

## Fraîcheur

`FreshnessLevel = 'fresh' | 'old' | 'stale' | 'unknown'`, calculé depuis une date et un seuil de péremption (7 jours par défaut, constante exportée). Les valeurs absolues de seuil ne figurent qu'à un endroit.

## BrisageRankingAccess (localStorage)

Clé `craftcheck-brisage-ranking` : `'1'` quand le propriétaire a activé l'accès. Absente ou illisible = refus (échec sûr).

## Réutilisation, aucun changement de forme

`StoredCoefficient`, `SharedCoefficient`, `PinnedItemPrice`, `SharedItemPriceEntry`, `RuneItem`, `BrisageOption`, `BrisageAnalysis`, `FocusAdvice`.
