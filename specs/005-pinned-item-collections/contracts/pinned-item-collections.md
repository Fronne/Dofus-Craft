# Pinned Item Collections Contract

## Scope

Ce contrat fixe les frontières observables introduites par les collections d'objets épinglés :
assignation, renommage, suppression, et leur reflet sur la page Épinglés et au moment d'épingler
depuis la recherche. Il **complète** le contrat existant de
[`../../002-server-scoped-prices/contracts/server-scoped-storage.md`](../../002-server-scoped-prices/contracts/server-scoped-storage.md)
(section « Pinned item list ») sans modifier `pin(item)`/`unpin(itemId)`, dont le comportement
observable reste identique.

## Persistance des objets épinglés (étendue)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `loadPinnedItems()` | aucun | liste de `PinnedItem`, `collectionName` inclus quand présent | Une entrée stockée avant cette fonctionnalité (sans `collectionName`) se charge normalement, `collectionName` absent — jamais rejetée ni migrée de force (FR-005). |
| `savePinnedItems(items)` | liste de `PinnedItem` | succès | Persiste `collectionName` tel quel (ou son absence) pour chaque objet, sans validation supplémentaire côté stockage — la normalisation (casse, espaces) a déjà eu lieu en amont. |

## Gestion des collections (nouveau)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `assignCollection(itemId, name)` | identifiant d'objet épinglé ; nom de collection ou `undefined`/vide | liste mise à jour | Voir data-model.md pour la normalisation complète. N'agit que si `itemId` correspond à un objet actuellement épinglé ; sans effet sinon. |
| `renameCollection(oldName, newName)` | nom de collection existant (portée par ≥1 objet) ; nouveau nom | liste mise à jour | Sans effet si `oldName` ne correspond à aucun objet actuellement épinglé. Fusionne avec `newName` s'il correspond (insensible à la casse) à une collection déjà existante. |
| `deleteCollection(name)` | nom de collection existant | liste mise à jour | Réassigne tous les objets concernés vers « Sans collection ». MUST NOT retirer un objet de la liste des épinglés (contrairement à `unpin`). |
| `listCollectionNames()` | aucun | noms de collections non vides, triés alphabétiquement | Lecture pure, dérivée de l'état courant des objets épinglés — jamais une source de vérité indépendante. |

## Garanties valables quel que soit l'état de la liste

- `assignCollection`/`renameCollection`/`deleteCollection` ne suppriment ni ne modifient jamais un
  objet épinglé au-delà de son `collectionName` — les prix associés (002-server-scoped-prices), le
  niveau, l'image et le reste des données affichées restent inchangés.
- Deux collections dont le nom ne diffère qu'à la casse ne peuvent jamais coexister après l'une
  quelconque de ces trois opérations (FR-009) ; le résultat en cas de conflit est toujours une
  fusion vers la collection déjà existante, jamais une erreur silencieuse ni un doublon visuel.
- `deleteCollection` et `unpin` restent des opérations strictement distinctes : la première ne
  désépingle jamais un objet (FR-007), la seconde continue de le faire (comportement existant,
  inchangé).

## Contrat d'interaction UI

| Surface | Inputs | Outputs / states |
|---------|--------|-------------------|
| Page Épinglés (`EpinglesPage.tsx`) | aucun (lecture) | Affiche les objets épinglés regroupés par collection, triées alphabétiquement, « Sans collection » toujours en dernier (FR-004, FR-011). |
| Carte d'objet épinglé | choix d'une collection via `CollectionPicker` (existante ou nouvelle) | Appelle `assignCollection` ; l'objet change immédiatement de groupe à l'affichage. |
| En-tête de groupe de collection | renommer (texte) ou supprimer (action) | Renommer appelle `renameCollection` ; supprimer appelle `deleteCollection` — dans les deux cas, tous les objets du groupe restent visibles, dans leur nouveau groupe. |
| Écran de détail d'objet (`ItemDetail.tsx`), au moment d'épingler | bouton Épingler (inchangé, un clic) + contrôle secondaire optionnel ouvrant `CollectionPicker` | Épingler sans utiliser le contrôle secondaire assigne « Sans collection », identique au comportement actuel ; l'utiliser appelle `pin` puis `assignCollection` pour la collection choisie ou nouvellement créée (US2). |

## Ce que ce contrat ne couvre pas

L'implémentation exacte de la normalisation de casse (fonction utilisée, ex. `localeCompare` vs
`toLocaleLowerCase`) est un détail d'implémentation, pas une exigence produit ; voir data-model.md et
research.md pour la règle observable (comparaison insensible à la casse, casse de la première
création conservée) que toute implémentation MUST respecter.
