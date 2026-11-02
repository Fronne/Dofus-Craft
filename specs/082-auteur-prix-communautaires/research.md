# Recherche : Auteur et date des prix communautaires

Les décisions ci-dessous répondent aux questions du plan. Aucune n'est restée en suspens.

## R1 — Ce que le site affiche comme « prix communautaire »

- **Constat** : le prix montré est le **dernier prix saisi** (spec 024 pour une ressource, spec 016
  pour un objet), avec sa date. La médiane ne sert qu'à la confirmation d'une valeur aberrante.
  `summarizeContributions` (`worker/src/median.ts`) renvoie déjà `latestAmountKamas`,
  `latestContributionAt` et `latestOrigin` pour cette dernière saisie.
- **Décision** : l'auteur affiché est celui de cette **dernière saisie**, sans calcul de plus.
  Le scénario « valeur calculée à partir de plusieurs saisies » de la spec (US1.5) est donc couvert
  par le même mécanisme : la dernière saisie prise en compte est la dernière saisie.
- **Cas Huzounet** : quand un prix lu sur Huzounet est plus récent que celui du groupe, il remplace
  la dernière saisie (`withExternalPrice`, `latest.ts`) : aucun auteur n'est renvoyé.

## R2 — Où stocker l'auteur

- **Décision** : une colonne `author_discord_user_id TEXT` (nullable) sur
  `community_price_contributions`, plus un index `(author_discord_user_id, created_at)` pour « Mes
  contributions ». Migration `0031_add_price_author.sql`, additive : les lignes existantes gardent
  NULL (« sans auteur », FR-003).
- **Pas de clé étrangère** : `fm_players` peut être supprimée ; le lien est rompu explicitement
  (R6), comme le fait déjà `deleteMe` pour `owner_discord_user_id`.
- **Alternative rejetée** : stocker le pseudo sur la contribution. Il se périmerait (changement de
  pseudo Discord, FR-007) et ne pourrait pas suivre le réglage « privé » (FR-008).

## R3 — Identifier l'auteur à la saisie

- **Constat** : `POST /community-price` utilise la clé d'application dans `Authorization: Bearer`
  (`worker/src/index.ts`). Le jeton de session du site circule aussi en `Bearer` sur les routes
  `/fm/*`. Les deux ne peuvent pas partager l'en-tête.
- **Décision** : le site ajoute l'en-tête `X-Fm-Session: <jeton>` à la saisie quand il en a un. Le
  Worker résout le jeton comme `requireSession` (hash SHA-256, non expiré). Un en-tête absent,
  inconnu ou expiré donne un prix anonyme et ne produit **aucune erreur** (FR-012). Le CORS doit
  autoriser `X-Fm-Session`.
- **Appartenance au serveur** : sans importance ici ; un non-membre connecté peut signer ses prix
  (cas limite de la spec).
- **Alternative rejetée** : envoyer le jeton dans le corps JSON. Il passerait dans les journaux de
  requêtes du corps ; l'en-tête suit la pratique des routes `/fm/*`.

## R4 — Lire le pseudo sans exposer l'identité

- **Décision** : le pseudo est résolu **à la lecture** par une jointure sur `fm_players` : le nom
  n'est renvoyé que si `is_private = 0`. Seul le pseudo sort (`latestAuthor` pour une ressource,
  `author` pour un objet), jamais l'identifiant Discord (FR-013).
- **Effet** : un changement de pseudo ou de confidentialité s'applique à tous les prix déjà saisis
  sans réécrire de données (FR-007, FR-008, SC-005).
- **Coût** : la jointure ne porte que sur la dernière ligne de chaque prix ; les requêtes de lecture
  gardent leur forme (`ORDER BY created_at`, `GROUP BY`).
- **Cache** : les lectures passent par le cache de 60 s (spec 021). `PATCH /fm/me` et `DELETE
  /fm/me` appellent `clearReadCache()` (le cache de l'isolat qui les traite) ; les autres isolats
  se mettent à jour au plus tard 60 s après. SC-005 est précisé en conséquence.

## R5 — Quelles saisies reçoivent un auteur

- **Décision** : (a) les saisies faites sur le site via `POST /community-price` (origine `manual`) ;
  (b) les prix créés par l'import d'une capture sur le site (origine `capture`, `fm/captures.ts` et
  `fm/purchases.ts`), où l'utilisateur est connecté et connu. Les prix de **origine `bot`** et
  `sniffer` restent sans auteur dans cette fonctionnalité (hypothèse de la spec), même si le bot
  connaît l'identifiant Discord.
- **Implémentation** : `Contribution` gagne `authorDiscordUserId?: string` ; `contributionInsert`
  l'écrit ; `fm/purchases.ts` ne le renseigne que pour `origin === 'capture'`.

## R6 — Suppression du profil

- **Décision** : `deleteMe` (`worker/src/fm/me.ts`) ajoute à sa transaction `UPDATE
  community_price_contributions SET author_discord_user_id = NULL WHERE author_discord_user_id = ?`
  avant de supprimer le joueur. Le prix reste, anonyme et daté (FR-011). Se reconnecter avec le même
  compte ne rattache rien (le lien n'existe plus, US4.2).

## R7 — « Mes contributions »

- **Décision** : `GET /fm/me/contributions` (session requise, ouverte aux non-membres comme `GET
  /fm/me`) renvoie `{ total, recent }` : le nombre de prix dont l'utilisateur est l'auteur (ceux
  encore conservés : les prix sont purgés après 90 jours) et ses 20 derniers, avec `resourceId`,
  `kind`, `serverId`, `amountKamas`, `createdAt`. Le site traduit `resourceId` en nom avec son
  catalogue local ; un identifiant inconnu s'affiche tel quel plutôt que d'être inventé (principe I).
- **Confidentialité** : l'utilisateur voit toujours toutes ses contributions, qu'il soit privé ou
  non (US3.3).

## R8 — Affichage

- **Décision** : un composant `PriceUpdateNote` (et une fonction pure `formatPriceUpdate`) rend
  « par Pseudo · il y a 2 h » ou « il y a 2 h », réutilise `formatRelativeTime` et met la date
  complète en `title`. Il remplace le simple texte de date dans `ResourcePriceInput`,
  `MarketPriceInput`, `RunePriceInput`, `PricesPage` et les lignes de prix des familiers.
- **Règle d'honnêteté** : le nom n'est affiché que si la date montrée est celle de la dernière
  saisie du groupe. Dans `CommunityResourcePriceRow`, quand le carnet local porte une date plus
  récente ou différente (prix perso saisi, pas encore partagé), la mention reste la date seule : on
  n'attribue pas à quelqu'un un prix qu'il n'a pas saisi.
- **Durées** : `formatRelativeTime` existe déjà (« il y a 2 h », « hier ») ; en dessous d'une minute
  il écrit « il y a N secondes ». La spec dit « il y a quelques instants » : on ajoute ce cas à
  `price-update.ts` sans modifier `formatRelativeTime`, qui sert à d'autres pages.

## R9 — Confidentialité depuis Mon profil

- **Décision** : `ProfilPage` reçoit le réglage public/privé (le contexte `AuthContext` accepte déjà
  `updateMe({ isPrivate })`) avec la phrase de FR-009. Le réglage est le même que celui de la
  Forgemagie.

## R10 — Ordre de déploiement

- Migration `0031` d'abord, puis Worker, puis site. Un site plus ancien ignore les champs en plus ;
  un Worker plus récent avec un site plus ancien enregistre simplement des prix sans auteur.
