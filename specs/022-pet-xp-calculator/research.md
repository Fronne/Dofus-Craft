# Research: Page Familier

## §1 — Source des données d'XP (révisé le 2026-09-27)

- **Decision** : XP par ressource = onglet « XP COMPLET » du fichier EXCEL FAMILIER du porteur du
  projet (colonne E « Nom », colonne F « XP » = XP donnée par **une** unité ; données issues de
  https://dafous.app/pet-xp ; 2 118 ressources), exporté dans `scripts/data/pet-xp-resources.csv`.
  Courbe par niveau = `EvolutiveItemTypes.d2o` du client (type 1, `experienceByLevel`, 101 valeurs,
  indice = niveau 0 à 100), exportée dans `scripts/data/pet-xp-curve.json`. Les deux fichiers source
  sont commités ; le script en tire `src/data/pet-xp-data.json`.
- **Rationale** : le porteur du projet a demandé d'abandonner entièrement Dofus Tool, dont les
  valeurs s'écartent fortement de l'Excel (ex. Alliage Ivre 375 contre 750 XP / unité). dafous.app
  ne publie pas sa courbe par niveau (API protégée) mais utilise le total 179 592 XP, identique au
  dernier palier de la courbe du client : les deux sources concordent. Un familier neuf est niveau 0.
- **Encodage** : 4 noms de l'Excel contenaient « Œ / œ » mal encodés (octets cp1252 0x8C / 0x9C),
  corrigés dans le CSV.
- **Alternatives** : Dofus Tool (abandonné) ; lire l'Excel à chaque génération (format binaire, pas de
  dépendance de lecture xlsx dans le projet).

## §2 — Rattachement des ressources au catalogue

- **Decision** : le script interroge DofusDB (`/items`) par nom exact, insensible à la casse, en
  essayant aussi « oe » ↔ « œ ». Exactement un résultat → rattaché (id, nom DofusDB, icône
  `https://api.dofusdb.fr/img/items/<iconId>.png`). Zéro ou plusieurs résultats → écarté et consigné
  dans `unmatched` avec la raison.
- **Rationale** : relevé du 2026-09-27 — 2 100 ressources sur 2 118 rattachées ; 9 ambiguës
  (« Carapace Bleue/Jaune/Rouge/Verte », « Viande Fraîche »…) et 9 introuvables. SC-004 interdit
  tout rattachement approximatif.

## §3 — Lignes inexploitables

- **Decision** : ignorer les lignes dont l'XP par unité est absente ou ≤ 0 (`zero-xp`). Un nom présent
  deux fois n'est gardé que si les valeurs sont identiques (`conflicting-duplicate` sinon).
- **Rationale** : ne jamais recommander une ressource sur une valeur incertaine (principe I).

## §4 — Prix utilisés

- **Decision** : `resourcePricesFor(priceMode).getMany(serverId, ids)` pour toutes les ressources
  rattachées. En Mode communautaire, les ressources sans entrée de carnet sont complétées par
  `getCommunityPrices(ids, serverId)` (lots de 98), **en lecture seule** : rien n'est écrit dans le
  carnet. Date affichée : `updatedAt` du carnet ou `lastContributionAt` de la médiane.
- **Rationale** : mêmes prix que les autres pages ; ~2 100 ressources = 22 requêtes groupées (lots de 98), pas 2 100.
  Écrire des centaines de médianes dans le carnet depuis une page de consultation serait un effet de
  bord inattendu.
- **Alternatives** : `fillCommunityGaps` (une requête par ressource et écriture dans le carnet).
  Médianes indisponibles → seuls les prix du carnet sont utilisés, avec un message.

## §5 — Calcul et classement

- **Decision** : `xpNeeded = cumul(cible) − (cumul(actuel) + xpDéjà)` ; `quantité = ceil(xpNeeded /
  xpParUnité)`, le quotient étant arrondi à 1e-9 avant `ceil` pour éviter les erreurs de virgule
  flottante ; `coût = quantité × prix`. Tri par coût croissant, puis nom (ou par la colonne choisie,
  FR-007 révisé). 10 premières lignes.
- **Rationale** : une seule ressource suffit (coût linéaire, spec — Assumptions). L'arrondi supérieur
  garantit d'atteindre le niveau.
- **XP déjà gagnée** : bornée à `cumul(actuel+1) − cumul(actuel) − 1`.

## §6 — Mémorisation des niveaux

- **Decision** : `localStorage` (clé `craftcheck-pet-levels`), lu et écrit dans un try/catch, comme
  les autres préférences de `src/persistence/`.
