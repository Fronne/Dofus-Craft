# Research: Page Saisie HDV

Relevés faits le 2026-09-28 sur le client Dofus 3 installé du porteur du projet
(`Dofus_Data/StreamingAssets/Content/Data/*.bundle`, lus avec UnityPy) et sur l'API DofusDB.

## §1 — D'où vient la correspondance type d'objet → HDV

- **Constat** : le client contient bien les HDV (`AuctionHousesDataRoot` : 7 HDV, ids 1261 à 1267,
  chacun avec un `typeId` 1 à 7 et les lots autorisés `[1, 10, 100, 1000]`), mais **aucune liste des
  types d'objets vendus par HDV**. Les types d'objets (`ItemTypesDataRoot`, 239 types) n'ont pas de
  champ HDV non plus. Cette liste est envoyée par le serveur quand on ouvre un HDV en jeu ; elle
  n'est lisible ni dans le client ni dans DofusDB.
- **Constat** : la catégorie DofusDB ne suffit pas : « Nourriture pour familier » (type 209) est en
  catégorie 2 (Ressources) alors que le porteur du projet la voit à l'HDV Animaux.
- **Decision** : une correspondance **écrite à la main et validée en jeu** par le porteur du projet,
  commitée dans `scripts/data/hdv-type-map.json` (type d'objet → `resources` | `consumables` |
  `animals` | `null` = hors périmètre), avec sa source (« relevé en jeu ») et sa date. Règle de départ
  proposée : catégorie DofusDB 2 → Ressources, catégorie 1 → Consommables, puis les exceptions de
  §2. Un type absent du fichier n'est jamais deviné : ses objets ne sont pas listés, et le script
  de génération les signale.
- **Rationale** : constitution I (données traçables, jamais inventées) : l'HDV d'un type est une
  donnée de jeu qu'on ne peut pas lire automatiquement ; mieux vaut une table courte, explicite et
  vérifiée qu'une déduction fragile.
- **Alternatives** : catégorie DofusDB seule (fausse pour la nourriture pour familier) ; capture du
  message serveur à l'ouverture d'un HDV (lourd, hors du cadre de l'app).

## §2 — Types concernés et répartition proposée (à valider en jeu)

Objets utiles à l'app (clarification du 2026-09-28) = ingrédients d'au moins une recette (4 858
recettes du client, 2 957 ingrédients distincts) ∪ ressources du tableau d'XP familier (2 100) =
**3 140 objets**, tous échangeables d'après DofusDB, répartis sur 86 types.

| HDV proposé | Types (id DofusDB) | Objets |
|---|---|---|
| Ressources | tous les types de catégorie 2 sauf ceux listés ci-dessous (Ressource diverse 15, Fragment de carte 175, Os 47, Clef 84, Poil 54, Vêtement 164, Peau 59, …) | ≈ 2 800 |
| Consommables | tous les types de catégorie 1 : Fée d'artifice 74, Bière 37, Poisson comestible 49, Friandise 42, Potion 12, Boisson 79, Éklâme 310, Pain 33, Viande comestible 69, Potion de téléportation 43, Objet utilisable 94, Cadeau 89 | ≈ 130 |
| Animaux | Nourriture pour familier 209 (**toute** celle qui est échangeable, FR-004b), Familier 18 (ingrédients seulement) | 35 + 1 |
| Exclus (inutiles, décision du porteur du projet) | Certificat de Dragodinde 97 | 69 |
| Hors périmètre (HDV Runes) | Rune de forgemagie 78, Rune de transcendance 211, Rune astrale 233 | 186 |
| Hors périmètre (HDV équipements / armes) | Trophée 151, Épée 6, Amulette 1, Chapeau 16, Bottes 11, Marteau 7, Bouclier 82, Cape 17 | 193 |
| **À confirmer en jeu** | Potion de forgemagie 26, Orbe de forgemagie 189, Gravure de forgemagie 258 (HDV Runes ?), Pierre d'âme spéciale non transformée 309 (HDV Âmes ?), Fragment de carte 175, Ressource de quête 312, Caution 197, Haïku 232 | 325 |

- **Constat important pour le porteur du projet** : le tableau d'XP familier ne contient qu'une seule
  croquette (« Croquette enrichie », 500 XP) ; les autres croquettes n'y figurent pas, la page
  Familier ne peut donc pas les recommander. Sans les certificats de dragodinde (exclus à la demande
  du porteur du projet), l'onglet Animaux ne contiendrait que 2 objets : le porteur du projet a
  choisi d'y lister toute la nourriture pour familier échangeable (35 objets, FR-004b), même si la
  page Familier ne peut utiliser que la Croquette enrichie. Le vrai manque de prix est l'HDV **Consommables** (≈ 130 ingrédients) et
  les 170 ressources du tableau familier qui ne sont l'ingrédient d'aucune recette.

## §3 — Liste des objets de chaque HDV : générée une fois, pas à l'exécution

- **Decision** : un script lancé à la main, `scripts/build-hdv-items.mjs` (même principe que
  `build-pet-xp-data.mjs`), produit `src/data/hdv-items.json` : pour chaque objet utile d'un type
  rattaché à un HDV, `{ id, name, imageUrl, typeId }`, plus la table des noms de types, la source,
  la date de relevé et la liste des types non rattachés. Ingrédients : toutes les recettes DofusDB
  (`/recipes`, paginé) ; ressources familier : `src/data/pet-xp-data.json` ; détails et
  échangeabilité : DofusDB `/items` par lots de 50 ids. Le fichier est chargé à la demande
  (`import()` dynamique) par la page, pas dans le bundle initial.
- **Rationale** : le catalogue DofusDB change très rarement ; parcourir 4 858 recettes à chaque
  visite serait lent et inutile. Même approche déjà acceptée pour les données familier. ≈ 3 000
  objets × ≈ 110 octets ≈ 330 Ko non compressés, ≈ 60 Ko gzip, hors du bundle principal.
- **Alternatives** : interroger DofusDB par type à l'ouverture d'un onglet (ne sait pas dire quels
  objets sont des ingrédients sans parcourir toutes les recettes) ; lire les bundles du client dans
  l'app (impossible côté navigateur).

## §4 — Réutiliser le champ de prix de la page Recherche

- **Decision** : extraire `CommunityResourcePriceRow` de `RecherchePage.tsx` vers
  `src/features/comparison/CommunityResourcePriceRow.tsx`, sans changer son comportement, et en
  faire un composant partagé `PriceEntryField` (mode personnel : `ResourcePriceInput` + écriture au
  blur ; mode communautaire : `CommunityResourcePriceRow`). La page Recherche et la page HDV
  l'utilisent toutes les deux. Stockage : `useResourcePrices(serverId, ids, resourcePricesFor(mode))`
  sur les ids **affichés**, le même carnet que la Recherche (FR-007 garanti par construction).
- **Mode communautaire** : chaque ligne affichée monte `useCommunityPrice` (cache localStorage lu
  d'abord, puis une requête) et reprend le préremplissage par la médiane comme la Recherche (FR-006).
  Les lignes sont affichées par pages de 25 au défilement (§5), ce qui borne le nombre de requêtes.
- **Rationale** : FR-006 exige un comportement identique ; un seul composant évite deux
  implémentations qui divergeraient (validation, confirmation d'un prix inhabituel, verrou, historique).
- **Alternatives** : dupliquer la logique dans la page HDV (divergence assurée) ; lecture groupée
  des médianes par lots de 98 (utile pour le décompte, voir §6, mais ne remplace pas la ligne).

## §5 — Liste longue : filtrage en mémoire, affichage progressif

- **Decision** : filtre nom (sans accents ni casse, `normalizeSearchText` existant) + type +
  « Sans prix » / « Prix ancien » appliqués en mémoire sur la liste de l'onglet, triée par nom ;
  affichage par tranches de 25 au défilement, avec le même mécanisme que la page Prix, extrait dans
  un hook partagé `useLoadMoreOnScroll`.
- **Rationale** : ≈ 2 800 objets filtrés en mémoire restent bien sous la seconde (SC-005).

## §6 — Décompte « N sur M ont un prix » et filtres Sans prix / Prix ancien

- **Decision** : ces trois fonctions lisent le carnet du mode actif pour **tous** les ids de
  l'onglet en une lecture groupée (`repository.getMany`, déjà utilisée par la page Prix), séparée de
  la lecture des lignes affichées. « A un prix » = une entrée dans le carnet du mode actif ;
  « prix ancien » = même règle d'âge que la Recherche (`src/domain/price-age.ts`, états `stale` ou
  `expired`). En mode communautaire, une médiane pas encore copiée dans le carnet ne compte pas.
- **Rationale** : même définition que les autres pages (un prix utilisé par les calculs est un prix
  du carnet) ; pas de requête réseau pour un simple décompte.

## §7 — Navigation : entrée HDV, retrait de l'Accueil

- **Decision** : `ROUTES.hdv = '/hdv'` ; entrée « HDV » (icône existante `coins` déjà prise par
  Prix, donc une icône « balance »/« store » à ajouter à `Icon`) entre Prix et Familier. L'entrée
  Accueil est retirée de `NAV_ITEMS` ; la route `/accueil` redirige vers `/` (Recherche) avec
  `<Navigate replace>` ; `AccueilPage.tsx` reste dans le code, non routé (FR-001b). L'onglet ouvert
  est mémorisé en localStorage (clé `craftcheck-hdv-tab`, lecture/écriture protégées).
- **Rationale** : même mécanisme de redirection que `/epingles` → `/suivis`.
