# Phase 1 Data Model: Affichage instantané du cache local sur la page Recherche

## Nouvelle entité

### CatalogueCacheEntry

Représente une entrée mise en cache localement (IndexedDB, base `dofus-craft-catalogue-cache`,
store `entries`) pour un résultat déjà obtenu depuis DofusDB et déjà affiché sur la page Recherche.

| Champ     | Type                | Description                                                                                     |
|-----------|---------------------|---------------------------------------------------------------------------------------------------|
| `key`     | `string`            | Clé primaire. Identifie de façon stable ce qui a été mis en cache : `categories`, `search:<query>:<category>:<levelFilter>:<limit>`, ou `detail:<itemId>`. |
| `value`   | JSON sérialisable   | Le résultat déjà retourné par `getCategories()` / `searchItems(...)` / `getItemDetail(...)`, tel quel. |
| `savedAt` | `string` (ISO 8601) | Horodatage de la dernière écriture réussie de cette entrée (= dernière synchronisation réseau réussie pour cette clé). |

**Validation** : `key` non vide ; `value` doit être sérialisable en JSON (pas de fonction, pas de
référence circulaire — déjà garanti car `value` provient directement des types `Item[]`,
`{ recipe?, resources, ... }`, `Category[]` existants, tous des DTO simples).

**Cycle de vie** : écrite à chaque réponse réseau réussie pour une clé donnée (écrase l'entrée
précédente pour la même clé) ; lue au montage du hook consommateur pour cette clé ; jamais purgée
automatiquement (pas de TTL — voir research.md §4) ; une entrée pour une clé qui n'est plus jamais
redemandée reste simplement inutilisée (volume borné par le nombre de recherches/objets déjà
consultés par l'utilisateur, pas de croissance illimitée à l'échelle du projet).

**Relations** : aucune — store indépendant, pas de clé étrangère vers les stores de prix
scoped-serveur existants (`resource-prices-by-server`, `community-mode-prices-by-server`,
`pinned-item-prices-by-server`), qui restent inchangés.

## Entités existantes réutilisées sans changement de structure

- **`ResourcePrice`** (`src/domain/types.ts`) : `{ resourceId, unitPriceKamas, updatedAt }`, déjà
  persisté dans `resource-prices-by-server` (Mode personnel) et `community-mode-prices-by-server`
  (Mode communautaire). Cette fonctionnalité ne change pas sa forme, seulement la façon dont
  `useResourcePrices` l'expose (pas de flash vide, garde anti-race — voir research.md §3).
- **`CommunityPrice`** (`src/domain/types.ts`) : `{ resourceId, serverId, medianAmountKamas,
  sampleSize }`. Sa représentation en cache local change de support (`sessionStorage` →
  `localStorage`, voir research.md §2) mais pas de forme.
- **`Item` / `Recipe` / `Resource` / `Category` / `ItemStat`** (`src/domain/types.ts`) : valeurs
  stockées telles quelles comme `value` d'une `CatalogueCacheEntry`, sans transformation.

## Nouvel état dérivé (non persisté) : statut de synchronisation

Exposé par `useStaleWhileRevalidate` à chaque consommateur (catalogue, prix), et par les hooks qui
l'utilisent (`useCatalogue`, `useResourcePrices`, `useCommunityPrice`) vers `RecherchePage` /
`ItemResults` pour piloter `SyncStatusIndicator` :

| Champ            | Type                 | Signification                                                                                   |
|------------------|----------------------|---------------------------------------------------------------------------------------------------|
| `data`           | `T \| undefined`     | Dernière valeur affichable connue (cache local ou réseau, selon ce qui est arrivé en dernier et n'a pas été jugé obsolète). |
| `loading`        | `boolean`            | `true` uniquement quand il n'existe encore aucune donnée à afficher (ni cache ni réseau résolu) — FR-006. |
| `isRevalidating` | `boolean`            | `true` pendant qu'un appel réseau est en cours alors que `data` est déjà affichable — FR-012.     |
| `offline`        | `boolean`            | `true` si le dernier appel réseau a échoué alors que `data` provient du cache local — FR-007/FR-008. |
| `lastSyncedAt`   | `string \| undefined`| Horodatage ISO de la dernière synchronisation réseau réussie pour la clé courante — FR-013.        |

Cet état est calculé en mémoire à partir de `CatalogueCacheEntry.savedAt` (pour le catalogue) ou de
l'équivalent pour les prix ; il n'est pas lui-même persisté séparément.

## Garde anti-race (état interne, non exposé)

Pour chaque clé suivie par `useStaleWhileRevalidate`, un compteur de génération (`generation:
number`) et un indicateur `networkArrived: boolean` sont maintenus en mémoire (ref React), réinitialisés
à chaque changement de clé — voir research.md §3. Ce ne sont pas des entités de données au sens
métier, mais un détail d'implémentation nécessaire pour garantir FR-009/FR-010 ; ils sont documentés
ici pour que les tests unitaires du hook (`tests/unit/use-stale-while-revalidate.test.ts`) sachent
exactement quel comportement observable vérifier (pas d'accès direct au compteur depuis les tests,
uniquement à l'ordre et au contenu des mises à jour de `data`).
