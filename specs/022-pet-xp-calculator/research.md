# Research: Page Familier

## §1 — Source des données d'XP

- **Decision** : figer dans `src/data/pet-xp-data.json` les deux tableaux de
  https://www.dofustool.com/tableau-xp-familier-dofus/ (courbe 1→100 : 1 à 196 159 XP ; 1 065 lignes
  de ressources « nom / XP donnée / quantité nécessaire »), avec source et date de relevé.
- **Rationale** : DofusDB n'expose ni la courbe ni l'XP par ressource (toutes les routes de l'API
  vérifiées). La courbe concorde avec `EvolutiveItemTypes.d2o` du client local (type 1 :
  `experienceByLevel`, valeur dofustool niveau N = valeur client indice N+1 − 1), ce qui la
  confirme. Les données changent très rarement : un fichier statique suffit.
- **Alternatives** : lire la page dofustool à l'exécution (fragile, dépendance tierce, CORS) ; lire
  les fichiers du client (Dofus 2 seulement, et ne donne pas l'XP par ressource).

## §2 — Rattachement des ressources au catalogue

- **Decision** : un script (`scripts/build-pet-xp-data.mjs`) interroge DofusDB (`/items`) par nom
  exact, insensible à la casse, en essayant aussi « Coeur » ↔ « Cœur » (oe ↔ œ). Exactement un
  résultat → rattaché (id, nom DofusDB, icône). Zéro ou plusieurs résultats → écarté et consigné dans
  la section `unmatched` du fichier, avec la raison.
- **Rationale** : relevé du 2026-09-27 — 831 noms sur 1 064 trouvés à la casse près ; 4 ambigus
  (« Carapace Bleue/Jaune/Rouge/Verte » existent en deux objets) ; ~229 introuvables, en partie
  corrigés par œ, le reste correspond à des ressources renommées ou retirées de Dofus 3. SC-004
  interdit tout rattachement approximatif.
- **Alternatives** : rapprochement flou (risque de mauvais rattachement) ; rapprochement à
  l'exécution (le catalogue en mémoire ne contient que les équipements craftables, pas les
  ressources).

## §3 — Lignes du tableau dofustool inexploitables

- **Decision** : ignorer les lignes dont l'XP donnée ≤ 0 ou la quantité est vide / « ? » / ≤ 0.
  Pour un nom présent deux fois (« Peau de Rat »), garder la ligne au meilleur XP par unité
  seulement si les deux sont identiques ; sinon écarter le nom (données contradictoires).
- **Rationale** : ne jamais recommander une ressource sur une valeur incertaine (principe I).

## §4 — Prix utilisés

- **Decision** : `resourcePricesFor(priceMode).getMany(serverId, ids)` pour toutes les ressources
  rattachées. En Mode communautaire, les ressources sans entrée de carnet sont complétées par
  `getCommunityPrices(ids, serverId)` (lots de 100), **en lecture seule** : rien n'est écrit dans le
  carnet. Date affichée : `updatedAt` du carnet ou `lastContributionAt` de la médiane.
- **Rationale** : mêmes prix que les autres pages ; ~830 ressources = 9 requêtes groupées, pas 830.
  Écrire des centaines de médianes dans le carnet depuis une page de consultation serait un effet de
  bord inattendu.
- **Alternatives** : `fillCommunityGaps` (une requête par ressource et écriture dans le carnet).
  Médianes indisponibles → seuls les prix du carnet sont utilisés, avec un message.

## §5 — Calcul et classement

- **Decision** : `xpNeeded = cumul(cible) − (cumul(actuel) + xpDéjà)` ; `xpParUnité = xpDonnée /
  quantité` ; `quantité = ceil(xpNeeded / xpParUnité)` calculé comme `ceil(xpNeeded × quantité /
  xpDonnée)` sur valeurs arrondies pour éviter les erreurs de virgule flottante ; `coût = quantité ×
  prix`. Tri par coût croissant, puis nom. 10 premières lignes.
- **Rationale** : une seule ressource suffit (coût linéaire, spec — Assumptions). L'arrondi supérieur
  garantit d'atteindre le niveau.
- **XP déjà gagnée** : bornée à `cumul(actuel+1) − cumul(actuel) − 1`.

## §6 — Mémorisation des niveaux

- **Decision** : `localStorage` (clé `craftcheck-pet-levels`), lu et écrit dans un try/catch, comme
  les autres préférences de `src/persistence/`.
