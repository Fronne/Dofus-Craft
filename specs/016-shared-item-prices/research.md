# Research: Prix HDV des objets partagé en Mode communautaire

## 1. Où stocker les contributions d'objets

- **Decision**: dans la table existante `community_price_contributions`, colonne `resource_id` = identifiant DofusDB de l'objet, plus une nouvelle colonne `kind` (`'resource'` par défaut, `'item'` pour un prix HDV d'objet) ajoutée par la migration `0005_add_contribution_kind.sql`.
- **Rationale**: objets et ressources sont des « items » DofusDB au même espace d'identifiants, sans collision ; la limite de montant (2 milliards de kamas) couvre les équipements. `kind` est nécessaire pour que la purge n'épargne que les prix d'objets (constitution, principe V — analyse C1) et que la trace des écarts soit filtrable par type (analyse I1). Les lignes existantes prennent `'resource'`, ce qui est exact.
- **Alternatives considered**: nouvelle table `item_price_contributions` (duplique écriture, purge, limiteur de débit) ; sans colonne `kind` (la purge garderait aussi d'anciennes lignes de ressources inutiles, et la trace ne serait pas filtrable).

## 2. Lire le dernier prix

- **Decision**: `GET /latest-price?itemId=…&serverId=…` → `{ itemId, serverId, amountKamas, contributedAt }` (la ligne `kind = 'item'` la plus récente, `ORDER BY created_at DESC LIMIT 1`), `404` sans contribution. Lecture anonyme comme `GET /community-price`.
- **Rationale**: le contrat de `/community-price` (médiane, nombre de contributions) reste intact pour les ressources ; la spec exclut médiane et nombre pour les objets.
- **Alternatives considered**: paramètre `mode=latest` sur `/community-price` (mélange deux formes de réponse sur une même route).

## 3. Conservation au-delà de 90 jours

- **Decision**: la purge hebdomadaire supprime les contributions de plus de 90 jours **sauf la plus récente de chaque couple (objet, serveur) de type `'item'`**.
- **Rationale**: sans cela, le dernier prix d'un objet disparaîtrait après 90 jours sans contribution, contre FR-001 (« sans limite d'ancienneté »). Les ressources suivent exactement la règle actuelle des 90 jours : rien d'inutile n'est conservé (principe V). Révision de specs/004 FR-013 à consigner.
- **Alternatives considered**: garder la plus récente de chaque identifiant sans distinction de type (conserverait sans raison d'anciennes contributions de ressources) ; accepter la disparition après 90 jours (contredit la spec).

## 4. Seuil et trace de l'écart

- **Decision**: client : `ITEM_OUTLIER_THRESHOLD_PERCENT = 50`, écart `|saisi − dernier| / dernier × 100` avec le **dernier prix affiché** ; confirmation si écart > 50 %. Worker : le POST accepte `kind: 'item'` ; dans ce cas `median_at_submission_kamas` / `deviation_percent` sont calculés par rapport à la dernière contribution (et non la médiane). Absence de dernier prix → pas de confirmation, champs de trace `null`.
- **Rationale**: FR-006, FR-008, FR-012 ; même trace que les ressources (specs/007 FR-009), requêtable par le modérateur : `WHERE kind = 'resource' AND deviation_percent > 25` pour les ressources, `WHERE kind = 'item' AND deviation_percent > 50` pour les objets.
- **Alternatives considered**: calculer l'écart côté client seulement (la trace doit être calculée côté serveur, jamais fiée au client — specs/007).

## 5. Affichage et cache côté application

- **Decision**: hook `useSharedItemPrice(itemId, serverId)` sur le modèle de `useCommunityPrice` : lecture du cache `localStorage` (`craftcheck-latest-item-price:<server>:<item>`) au montage (affichage immédiat, marqué possiblement daté), requête réseau, rafraîchissement toutes les 5 min, `commit(amount)` qui envoie la contribution puis relit le dernier prix. Échec réseau → dernier prix en cache (FR-011).
- **Rationale**: comportement déjà éprouvé pour les ressources ; pas de carnet local supplémentaire (le dernier prix partagé *est* la valeur du Mode communautaire).
- **Alternatives considered**: carnet IndexedDB « Mode communautaire » pour les prix HDV (comme les ressources) — inutile : il n'y a pas de pré-remplissage « une fois » à protéger, le prix affiché suit toujours le dernier partagé.

## 6. Champ « Prix HDV » en Mode communautaire

- **Decision**: `MarketPriceInput` reçoit, en Mode communautaire, `lockWhenFilled`, `updatedAt` et `onCommit`, avec la même logique que `ResourcePriceInput` (verrou + crayon, validation seulement après une vraie édition, retour à la valeur précédente si la confirmation est annulée) ; la date réutilise `formatRelativeTime` et le surlignage d'ancienneté de specs/008.
- **Rationale**: FR-002, FR-003, FR-005, FR-007 ; même comportement que les champs de ressources, déjà corrigé pour le cas du focus sans édition.

## 7. Page Suivis

- **Decision**: en Mode communautaire, `EpinglesPage` prend pour chaque carte le dernier prix partagé (cache puis réseau, via la même fonction de lecture que le hook) au lieu de `pinnedItemPrices` ; Mode personnel inchangé.
- **Rationale**: FR-009, SC-004.
