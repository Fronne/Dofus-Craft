# Recherche : Refonte de la page Brisage

Chaque décision indique ce qui est retenu, pourquoi, et ce qui a été écarté.

## D1 — Source de la liste de cartes

- **Décision** : les cartes sont filtrées dans l'index local des équipements (`src/data/brisage-items.json`, déjà chargé à la demande par la recherche par stats), pour le nom comme pour les autres filtres.
- **Raison** : un seul jeu de données permet de combiner nom, catégorie, niveau et stats ; c'est instantané et sans réseau. La recherche par nom actuelle interroge le catalogue distant (`useEquipmentSearch`) et ne sait pas filtrer par stats.
- **Limite connue** : l'index ne contient que les équipements qui ont au moins une ligne brisable ; un équipement sans rune connue n'apparaît pas, ce qui est cohérent (rien à briser). À documenter dans l'interface par le message « aucun objet ».
- **Écarté** : garder deux sources (réseau pour le nom, index pour les stats) → deux listes à fusionner, résultats incohérents.

## D2 — Catégorie des objets

- **Décision** : ajouter `categoryId` à chaque objet de l'index, en régénérant le JSON avec `scripts/build-brisage-items.mjs`. La règle est celle de `equipmentCategoryId` (`dofusdb-mappers.ts`) : super type 13 (trophées, prysmaradites) → `equipment-type-151`, sinon `equipment-type-<superTypeId>`. Le script lit déjà les types d'objets (avec `superTypeId`) : il suffit de conserver le lien type → super type.
- **Raison** : les identifiants de catégorie sont ceux de la page Recherche, donc les pastilles et leurs icônes sont les mêmes.
- **Libellés** : les pastilles de catégorie sont celles que le site connaît déjà (`getCategories()` du catalogue, filtre `kind === 'Equipment'`, comme `CategoryFilter`), pas une liste figée. Les noms de la maquette (« bouclier » notamment) sont indicatifs : seules les catégories présentes dans les données sont proposées.
- **Risque** : la régénération demande DofusDB. Si le service est injoignable, le script n'écrit rien (comportement existant) ; la tâche reste bloquée plutôt que de contourner. Un test vérifie que chaque objet du JSON a une catégorie reconnue.
- **Écarté** : déduire la catégorie du nom ou des stats (faux) ; appeler le catalogue par catégorie à chaque filtre (réseau, lent).

## D3 — Groupes de stats (Caractéristiques / Dommages / Résistances)

- **Décision** : une fonction pure `statGroup(effectId)` dans `brisage-search.ts`, sur la liste explicite des identifiants d'effet :
  - **Dommages** : 112, 414, 418, 422, 424, 426, 428, 430, 225, 220, 2800, 2804, 2808, 2812, 178 (soins), 226 exclu (Puissance Pièges reste en caractéristiques, comme Puissance).
  - **Résistances** : 416, 420, 240 à 244, 210 à 214, 2803, 2807.
  - **Caractéristiques** : tout le reste, dont tacle, fuite, esquive PA/PM, retrait PA/PM (demande explicite).
- **Raison** : un groupe par défaut évite qu'une nouvelle stat ajoutée à `BRISAGE_STATS` disparaisse du panneau ; un test vérifie que chaque stat ciblable appartient à un seul groupe et qu'aucune n'est perdue.
- **Écarté** : regrouper par libellé (fragile) ; mettre le groupe dans `BRISAGE_STATS` (modifie un module de calcul, hors besoin).

## D4 — Filtre combiné et tri

- **Décision** : une fonction pure `browseItems(items, filters, …)` qui applique, dans cet ordre : nom (sans accents ni casse, tous les mots), catégorie, niveau, stats (toutes présentes, règle de `specs/064`). Avec des stats choisies, elle renvoie les `SearchResult` triés comme aujourd'hui (`runes` / `kamas` / `maxRoll`). Sans stat, elle renvoie les objets triés par niveau décroissant puis nom, avec une estimation vide.
- **Raison** : réutilise `searchItemsByStats`, `estimateTargetRunes` et `sortSearchResults` sans les modifier ; une seule porte d'entrée pour l'interface.
- **Nom** : la normalisation est locale au domaine (`String.normalize('NFD')`), pour ne pas faire dépendre le domaine du dossier `services`.
- **Écarté** : réécrire le tri ; ajouter une dépendance de recherche floue.

## D5 — Mode de prix Auto

- **Décision** : `PriceSource` gagne la valeur `'auto'`. Une fonction pure `resolveItemPrice(hdv, craft, source)` renvoie le prix retenu et sa provenance : Achat → prix HDV ; Craft → coût de la chaîne ; Auto → le plus bas des deux prix connus, ou l'unique prix connu, ou rien. Un prix `undefined`, nul ou négatif est inconnu, jamais 0.
- **Raison** : `specs/062` définit déjà les deux prix ; Auto n'est qu'une règle de choix. Pour afficher « Achat X · Craft Y » et résoudre Auto, les deux prix sont lus dès qu'un objet est choisi (aujourd'hui la chaîne de craft n'est lue que si elle est choisie) : un coût de chargement acceptable, déjà mis en cache par le hook.
- **Compatibilité** : une session enregistrée avec `'hdv'` ou `'craft'` se relit à l'identique ; un nouvel objet choisi part en `'auto'`. Le prix saisi à la main reste le repli si aucun prix n'est connu.
- **Écarté** : conserver `'hdv'` par défaut (l'utilisateur veut Auto proposé) ; remplacer `'hdv'/'craft'` (casse les sessions enregistrées).

## D6 — Curseurs de jet

- **Constat** : la page actuelle n'a **pas** de curseur de jet : chaque ligne a déjà un champ numérique avec minimum et maximum de chaque côté, et le sélecteur Min / Moyen / Max en tête. Les curseurs n'existaient que dans une piste de maquette abandonnée.
- **Décision** : aucun changement sur ce point ; FR-010 est satisfait par l'existant, et un test de la page vérifie l'absence de curseur (`type="range"`).

## D7 — Informations annexes en bas de page

- **Décision** : une ligne compacte sous le tableau avec le coefficient actuel et les trois suivants (`nextCoefficients`, déjà en place), chacun avec son gain estimé quand il est connu. Le bloc « Valeur estimée des runes » rejoint cette ligne. Le verdict / conseil reste au-dessus du tableau, en version resserrée : c'est la réponse à la question « rentable ? », pas une information annexe.
- **Raison** : conserve tous les chiffres d'aujourd'hui (SC-003) en réduisant l'espace pris (SC-002).

## D8 — Persistance de l'état

- **Décision** : `brisage-search-prefs` gagne `categoryId` et `panelOpen` (lecture tolérante : champ absent ou invalide → valeur par défaut). L'objet choisi reste dans `brisage-session`. Le texte du nom n'est pas conservé (il se retape en 2 secondes ; évite de revenir sur une liste vide).
- **Raison** : FR-013 demande de retrouver filtres et objet ; le nom saisi n'a pas besoin de survivre.

## D9 — Icônes des stats

- **Décision** : une petite fonction `statIconUrl(effectId)` renvoie l'icône si le site en connaît une (les icônes de caractéristiques du catalogue, `CHARACTERISTIC_ASSET_BY_ID`) ; sinon le composant affiche un emplacement neutre de même taille. Les icônes fournies plus tard par le propriétaire s'y branchent sans changer l'interface.
- **Écarté** : bloquer la livraison en attendant les icônes ; inventer des pictogrammes.

## D10 — Accessibilité et écran étroit

- **Décision** : pastilles et cartes sont de vrais `<button aria-pressed>` ; le bouton Filtres porte `aria-expanded` ; les filtres actifs sont des boutons « Retirer … ». Les trois colonnes de stats passent en une colonne sous ~700 px ; le tableau garde son cadre à défilement horizontal (existant).
