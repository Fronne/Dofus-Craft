# Research: Actualiser les prix d'une recette sur la page Recherche

Source de référence : le site en ligne, sauvegardé dans
`backups/production-2026-10-12/site-index-original.js` (code minifié). Les positions citées sont des
décalages en caractères dans ce fichier.

## 1. Ce que fait le site en ligne

- **Decision**: reproduire à l'identique.
- **Relevé** (≈ 355 500 et 358 300) :
  - bouton `btn btn-secondary btn-small` dans un bloc `prices-refresh`, lui-même dans l'en-tête
    `prices-head` à côté du `<h2>Prix des ressources</h2>` ; rendu seulement si Mode communautaire,
    serveur choisi et objet choisi ;
  - icône `refresh` de 16 px, classe `prices-refresh-icon--busy` pendant la demande ;
  - libellé « Actualiser les prix » / « Actualisation… » ; message dans un `<p role="status">` ;
  - identifiants envoyés : `[objet, ...ressources de la chaîne]`, dédoublonnés, filtrés par `^\d+$`,
    coupés à 90 ;
  - l'état (occupé, message) est rangé avec la clé `serveur:objet` et n'est affiché que si cette clé est
    celle de la page : changer d'objet ou de serveur efface le message sans effet supplémentaire.
- **Messages** : `ok` et `refreshed > 0` → « Prix actualisés. » ; `ok` et 0 → « Les prix sont déjà à
  jour. » ; `too-soon` → « Réessaie dans quelques secondes. » ; `not-read` → « Les prix de ce serveur ne
  sont pas relus. » ; sinon « Actualisation impossible pour le moment. ».

## 2. La demande à l'API

- **Decision**: une fonction dédiée `refreshRecipePrices(serverId, itemId, ids)` dans
  `src/services/community-price-api.ts`, à côté de `refreshExternalPrices` (046).
- **Rationale**: les deux appels visent la même route mais pas le même contrat : celui de la recette
  envoie `itemId` (l'API note alors que cet objet est un de ceux que les joueurs regardent) et jamais
  `tab` ; celui de l'onglet HDV envoie `tab`/`last` et connaît la limite horaire. Les fusionner
  obligerait chaque appelant à connaître les règles de l'autre.
- **Réponses** (relevé ≈ 304 200) : 429 → `too-soon` ; 404 → `not-read` ; autre échec, réponse illisible
  ou panne réseau → `unavailable` ; 200 avec `refreshed` numérique → `ok`. Après un `ok`, les lectures
  suivantes sont des lectures fraîches (`freshReadsUntil`), comme après une contribution de l'appareil.
- **Alternatives considered**: réutiliser `RefreshOutcome` de 046 — écarté : il distingue des cas
  (`disabled`, `unreachable`, `hourly-limit`) que cet écran ne montre pas, et le site en ligne ne les
  distingue pas.

## 3. Faire relire les prix après une réponse réussie

- **Decision**: un compteur `reload` dans `RecherchePage`, incrémenté à chaque `ok` (même quand rien n'a
  été relu, comme en ligne). Il sert de :
  - dépendance à `useSharedItemPrice` (troisième paramètre) : le prix HDV partagé est relu ;
  - suffixe de la `key` des lignes d'ingrédients (`chemin:reload`) : chaque ligne est remontée, donc son
    `useCommunityPrice` relit le prix et le range dans le carnet s'il est plus récent ;
  - dépendance de l'effet qui remplit les ressources non affichées, dont la liste « déjà demandé » est
    remise à zéro.
- **Rationale**: c'est exactement le mécanisme du site en ligne (≈ 353 300 : `H3(…, t, E)`,
  `key: \`${V}:${E}\``, dépendance `E`), et il ne crée aucune nouvelle voie de lecture : la règle « le plus
  récent gagne » et la protection de la saisie en cours restent celles des lignes.
- **Saisie en cours** : les valeurs tapées vivent dans `RecherchePage` (`inputs`), pas dans la ligne ; un
  remontage ne les perd pas, et `isEditing` continue d'empêcher le remplacement (FR-007).
- **Alternatives considered**: exposer une fonction « relire » sur chaque crochet — plus de code et un
  comportement différent du site en ligne, sans bénéfice.

## 4. La mention de fragilité

- **Decision**: `CommunityResourcePriceRow` calcule la mention et la passe à `ResourcePriceInput`
  (nouvelle propriété `priceNote`), qui l'affiche après la date : « Dernière mise à jour : … · peu de
  relevés », dans un `<span class="price-note">`.
- **Condition** (relevé ≈ 349 400) : dernière origine `external`, pas de saisie en cours, et le carnet est
  vide ou daté exactement de la dernière observation ; libellés de `FRAGILE_LABELS` (046).
- **Prix gardé sur l'appareil** : `readCache` de `useCommunityPrice` ne relisait pas `latestOrigin` ni
  `latestFragile` (pourtant écrits par `writeCache`, qui range l'objet entier). Il les relit, avec les
  mêmes garde-fous que le client de l'API (origine connue ; mention `stale` / `provisional` seulement).

## 5. Tests

- **Decision**: règles pures en test unitaire (`recipe-refresh`), fonction de service en test unitaire
  avec `fetch` simulé, et un test d'intégration de la page calqué sur
  `tests/integration/recherche-instant-cache.test.tsx` (catalogue et API simulés, `fake-indexeddb`).
- Identifiants numériques dans le test d'intégration : les jeux de données existants utilisent
  `item-1` / `resource-1`, que la règle écarterait.
