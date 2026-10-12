# Research: Charger les prix d'un onglet HDV depuis Huzounet

Tout ce qui suit a été vérifié dans le code du dépôt au 12 octobre 2026 (branche issue de `master`
après la fonctionnalité 045).

## 1. Ce que la route existante accepte vraiment

**Decision**: s'y conformer sans la modifier (FR-016).

**Constat** (`worker/src/huzounet.ts`, `refreshHuzounetPrices`, et `worker/src/index.ts`) :

- corps `{ serverId, ids }` ; `ids` : 1 à 90 chaînes de 1 à 9 chiffres, sinon 400 `invalid` ;
- serveur hors `READ_SERVERS = ['mikhal']` : 404 `unknown-server` ;
- les identifiants lus il y a moins de 2 minutes sont écartés ; s'il n'en reste aucun : 200
  `{ refreshed: 0 }` **sans** compter pour la règle des 5 secondes ;
- sinon, si la dernière lecture à la demande du serveur date de moins de 5 s : 429 `too-soon` ;
  l'instant retenu est celui où l'API **reçoit** la demande, pas celui où elle répond ;
- 90 identifiants = 2 lectures chez Huzounet (lots de 50), espacées d'une seconde ;
- Huzounet en échec : 502 `unavailable` ; lecture coupée (`HUZOUNET_SYNC` ≠ `1`) : 503 `disabled` ;
- limiteur par adresse IP (`CONTRIBUTION_LIMITER`) : 429 `too-soon` aussi ;
- `refreshed` = nombre de prix effectivement lus chez Huzounet ; s'il est > 0 l'API vide son cache de
  lecture.

Les identifiants des quatre onglets sont tous numériques (vérifié : 105 runes de
`src/data/rune-items.json`, aucun identifiant non numérique) ; le module de règles écarte malgré tout un
identifiant qui ne le serait pas, pour qu'une tranche ne soit jamais refusée en bloc.

**Alternatives considered**: ajouter une route « charger un onglet » côté Worker — rejeté : change les
règles de lecture, demande un déploiement, et le Worker vient d'être remis à l'identique de la production.

## 2. Cadence entre deux tranches

**Decision**: 5 500 ms entre deux **départs** de demande ; même attente avant de redemander une tranche
refusée pour lecture trop récente ; 3 redemandes au plus par tranche.

**Rationale**: l'API exige 5 000 ms entre deux réceptions. Mesurer de départ à départ avec 500 ms de
marge couvre une différence de latence entre deux demandes. Ressources : 29 tranches → 28 attentes de
5,5 s + la dernière demande ≈ 2 min 40, sous les 4 minutes de SC-002. Consommables et Runes : 2 tranches
≈ 8 s ; Créatures : 1 tranche ≈ 3 s (SC-001). Une demande toutes les 5,5 s respecte SC-007.

**Alternatives considered**: attendre 5 s après la *réponse* (plus sûr mais ~1 min de plus sur
Ressources) ; enchaîner sans attendre et se fier aux 429 (bruyant, et consomme le limiteur par IP).

## 3. Où vont les prix chargés

**Decision**: après chaque tranche réussie, relire `GET /community-prices` pour les identifiants de la
tranche et écrire dans le carnet du Mode communautaire les prix que `pickCommunityPrice` dit de remplacer,
datés de leur propre date — exactement ce que font déjà `usePetFoodPrices` et la ligne
`CommunityResourcePriceRow`.

**Rationale**: le compteur « N objets sur M ont un prix » et les filtres « Sans prix » / « Prix ancien »
lisent ce carnet pour tout l'onglet (`useHdvPriceSummary`) ; c'est le seul endroit qui fasse apparaître
un prix dans la liste *et* dans le compteur (FR-005). La règle « le plus récent gagne » protège un prix
que le joueur vient de saisir : sa date est plus récente que celle observée chez Huzounet. La relecture
tient en une seule demande (90 < 98, taille des lots de lecture).

La relecture doit être fraîche : les lectures sont servies avec `Cache-Control: max-age=60`. Le client a
déjà un mécanisme pour cela (`freshReadsUntil`, armé après un partage) ; `refreshExternalPrices` l'arme
de la même façon quand `refreshed > 0`.

**Alternatives considered**: laisser chaque ligne affichée se remplir seule — ne couvre que les lignes
visibles, pas le compteur ; garder les prix chargés en mémoire sans les écrire — ils disparaîtraient au
rechargement et les autres pages ne les verraient pas.

## 4. Rafraîchir l'écran sans perdre une saisie

**Decision**: après l'écriture du carnet, la page appelle `summary.refresh()`, un nouveau `reload()` de
`useResourcePrices` (relecture du carnet des lignes affichées) et incrémente la version des mentions
d'origine. Aucune ligne n'est remontée.

**Rationale**: la valeur tapée et non enregistrée vit dans l'état `inputs` de la page et passe avant le
carnet (`value = input ?? carnet`) ; relire le carnet ne la touche pas, et le champ garde le focus
puisque le composant n'est pas recréé (FR-015). `useResourcePrices` garde ses données pendant une
relecture (pas de clignotement).

**Alternatives considered**: changer la `key` des lignes pour les forcer à relire — fait perdre le focus
du champ en cours de saisie.

## 5. Lire et montrer l'origine « Huzounet »

**Decision**:

- `PriceOrigin` gagne `'external'`, libellé « Huzounet » ; `CommunityPrice` gagne
  `latestFragile?: 'stale' | 'provisional'` (« relevé ancien », « peu de relevés ») ; le client ne garde
  `latestFragile` que s'il vaut l'une de ces deux valeurs et que l'origine est `external`.
- `useLatestOrigins` renvoie, par objet, `{ origin, fragile?, contributedAt }` et porte sur les lignes
  **affichées** de l'onglet (tous onglets, plus seulement Runes), en ne demandant que les identifiants
  qu'il ne connaît pas encore.
- La mention n'est montrée que si la date du prix affiché (carnet) est `contributedAt` : sinon le prix
  montré n'est pas celui-là (le joueur en a saisi un autre depuis).

**Rationale**: principe III — ne jamais attribuer à Huzounet un prix qui n'en vient pas. Demander les
origines des 2 537 ressources à l'ouverture coûterait 26 demandes pour 40 lignes visibles.

**Conséquence à traiter**: un prix que seul Huzounet connaît arrive avec `medianAmountKamas: 0` et
`sampleSize: 0`. La confirmation d'écart de `CommunityResourcePriceRow` divise par la médiane : sans
garde, toute saisie sur une telle ligne ouvrirait la boîte de confirmation avec un écart infini. La
ligne ne compare donc que si `sampleSize > 0` (même esprit que « pas de médiane connue », spec 007
FR-008).

**Alternatives considered**: stocker l'origine dans le carnet — change le format du carnet et sa
migration pour une information que l'API donne déjà.

## 6. Arrêt et un seul chargement à la fois

**Decision**: la boucle de chargement vit dans `useHuzounetLoad`. Un jeton `{ stopped: boolean }` par
chargement est vérifié avant chaque demande, après chaque attente et après chaque réponse ; « Arrêter »
et le nettoyage de l'effet (clé : onglet + serveur + mode, et démontage) l'activent. Tant qu'un
chargement tourne, le bouton est remplacé par « Arrêter » : un second clic ne peut pas en lancer un autre
(FR-010), et le crochet refuse de démarrer s'il tourne déjà. Une demande déjà partie n'est pas
interrompue (elle dure 2 à 3 s) ; sa réponse est ignorée pour l'affichage, mais les prix que l'API a lus
restent acquis côté API.

**Rationale**: pas d'`AbortController` à propager dans le client existant ; l'attente utilise une
fonction `wait` injectable, ce qui rend la boucle testable avec les faux minuteurs de Vitest.

## 7. Serveurs relus

**Decision**: `HUZOUNET_SERVERS = ['mikhal']` dans `src/domain/huzounet-load.ts`, commentaire renvoyant à
`READ_SERVERS` (`worker/src/huzounet.ts`). Le site et le Worker sont deux projets construits séparément,
sans code partagé (même choix que `outlier-threshold.ts`).

Si le site croit un serveur relu et que l'API répond 404, le message « Les prix de ce serveur ne sont pas
relus » s'affiche et le chargement s'arrête à la première tranche (US4-3).

## 8. Ce que faisait le site en ligne

Vérifié dans la sauvegarde `backups/production-2026-10-12/site-index-original.js` (minifié) :

- une seule utilisation de `/external-prices/refresh`, depuis la page Recherche (recette par recette,
  90 identifiants au plus, avec `itemId`) ; aucun bouton sur la page HDV. Ce bouton est donc nouveau ;
- ses messages sont repris ici pour que les deux écrans parlent pareil le jour où la page Recherche
  sera réécrite : « Les prix sont déjà à jour. », « Réessaie dans quelques secondes. », « Les prix de ce
  serveur ne sont pas relus. » ;
- la mention de fragilité y est « peu de relevés » (`provisional`) et « relevé ancien » (`stale`),
  montrée seulement si l'origine est `external`, qu'aucune saisie n'est en cours et que la date du
  carnet est celle du dernier prix — la même règle que la décision 5. La spec est alignée sur ces deux
  libellés ;
- le mot « Huzounet » n'y apparaît nulle part : la mention « Huzounet » de la ligne est nouvelle
  (FR-013), ajoutée aux libellés d'origine existants (« Saisie manuelle », « Capture », « Bot Discord »).
