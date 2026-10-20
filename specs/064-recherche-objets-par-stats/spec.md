# Spécification : Recherche d'objets par stats ciblées (page Brisage)

**Branche**: `064-recherche-objets-par-stats`

**Créée le**: 2026-10-20

**Statut**: Brouillon

**Entrée**: « Page Brisage : un endroit où le joueur sélectionne une ou plusieurs stats parmi celles qui existent ; le site liste et trie les objets du jeu qui possèdent ces stats, pour cibler des stats précises et savoir quels objets briser afin d'obtenir les runes correspondantes. Inspiré de DoFocus (liste filtrable, stats éligibles au focus : jets positifs, hors stat « chasse » id 696969). »

Cette spec prolonge `specs/060-page-brisage` (modèle de calcul du brisage et des poids de runes), `specs/061-simplification-page-brisage` (jet moyen par défaut, lignes d'effets d'un objet), `specs/062-prix-objet-brisage` et `specs/063-brisage-sans-coefficient`. Aujourd'hui, la page Brisage part d'un objet que le joueur cherche **par son nom** ; il n'existe aucun moyen de partir d'une **stat** (par exemple « je veux des runes Prospection ») pour trouver les objets à briser.

## Clarifications

### Session 2026-10-20

- Q : Avec plusieurs stats, quels objets lister ? → R : ceux qui portent **toutes** les stats choisies (pas d'interrupteur « au moins une » dans cette version).
- Q : Tri par défaut ? → R : **nombre estimé de runes ciblées** à 100 % de coefficient ; tri par valeur en kamas et par jet maximal proposés comme critères secondaires.

## Principe

Le joueur choisit les stats qu'il veut obtenir sous forme de runes. La page liste les objets du jeu qui portent ces stats, avec pour chacun le jet de chaque stat ciblée et une estimation des runes que son brisage donnerait. Ouvrir un objet de la liste mène à la page Brisage de cet objet, avec tout le calcul existant (prix, coefficient, focus).

Une stat est **ciblable** si elle a une rune de brisage connue du site (celles de `BRISAGE_STATS`), si le jet de l'objet est positif, et s'il ne s'agit pas de la stat « chasse » (identifiant 696969) ni d'un effet exotique (catégorie exo). C'est la règle des stats éligibles au focus de DoFocus.

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Trouver les objets qui portent une stat ciblée (Priorité : P1)

Sur la page Brisage, un sélecteur de stats permet de choisir une stat (par exemple Prospection). La page affiche la liste des objets du jeu qui ont un jet positif sur cette stat, avec leur nom, leur niveau, leur image et la fourchette de la stat.

**Pourquoi cette priorité** : c'est le cœur de la demande ; sans cette liste, le joueur ne peut pas partir d'une stat.

**Test indépendant** : choisir « Prospection » et vérifier que la liste n'affiche que des objets ayant un jet positif en Prospection, et qu'un objet connu pour en avoir y figure.

**Scénarios d'acceptation** :

1. **Étant donné** que le joueur n'a choisi aucune stat, **quand** il ouvre la recherche, **alors** aucune liste n'est affichée et un texte l'invite à choisir au moins une stat.
2. **Étant donné** la stat Prospection choisie, **quand** la liste s'affiche, **alors** chaque objet listé a un jet positif en Prospection, indiqué sur sa ligne (de X à Y).
3. **Étant donné** une stat qui n'est pas ciblable (stat « chasse », jet négatif seulement, effet exo), **quand** le joueur ouvre le sélecteur, **alors** cette stat n'y figure pas.
4. **Étant donné** que le joueur retire la stat choisie, **quand** la sélection devient vide, **alors** la liste disparaît et l'invitation revient.

---

### User Story 2 - Combiner plusieurs stats (Priorité : P1)

Le joueur sélectionne plusieurs stats à la fois (par exemple Vitalité et Sagesse). La liste ne garde que les objets qui répondent à la sélection, qui portent **toutes** les stats choisies (mode « et » ; un objet qui n'en a qu'une partie n'est pas listé).

**Pourquoi cette priorité** : le joueur cible rarement une seule rune ; il veut trouver les objets qui en donnent plusieurs d'un coup.

**Test indépendant** : choisir deux stats et vérifier que chaque objet listé respecte la règle de combinaison, et que la ligne montre le jet de chaque stat choisie.

**Scénarios d'acceptation** :

1. **Étant donné** deux stats choisies, **quand** la liste s'affiche, **alors** chaque ligne montre le jet de chacune des stats choisies que l'objet possède.
2. **Étant donné** une sélection qu'aucun objet ne satisfait, **quand** la liste est vide, **alors** un message l'explique et propose de retirer une stat.

---

### User Story 3 - Trier pour savoir quel objet briser en premier (Priorité : P1)

Les objets sont triés pour mettre en haut ceux dont le brisage donne le plus des runes ciblées. Chaque ligne affiche une estimation du nombre de runes de chaque stat ciblée, calculée avec la même formule et le même jet moyen que la page Brisage, **au coefficient de référence 100 %** (étiqueté comme tel), en brisage normal. Le tri par défaut porte sur le nombre estimé de runes ciblées (somme si plusieurs stats), sans dépendre d'aucun prix. Le joueur peut changer de critère de tri.

**Pourquoi cette priorité** : « quels objets briser » est la question posée ; une liste non triée oblige à tout ouvrir.

**Test indépendant** : avec deux objets de même niveau dont un a un jet nettement plus haut sur la stat ciblée, vérifier que celui-ci est classé avant.

**Scénarios d'acceptation** :

1. **Étant donné** la liste affichée, **quand** le joueur change le critère de tri, **alors** l'ordre est recalculé sans quitter la page.
2. **Étant donné** des estimations de runes affichées, **quand** le joueur les lit, **alors** elles sont clairement indiquées comme des estimations « à 100 % de coefficient », jamais comme un résultat réel.
3. **Étant donné** que les prix de runes du serveur manquent, **quand** le tri par valeur est demandé, **alors** les objets sans prix de rune ciblée sont classés en dernier et leur valeur affichée comme inconnue (jamais 0).

---

### User Story 4 - Ouvrir un objet de la liste dans le brisage (Priorité : P2)

En cliquant sur un objet de la liste, le joueur arrive sur la page Brisage de cet objet (jets, prix, coefficient, focus).

**Pourquoi cette priorité** : relie la recherche au calcul existant ; sans lui, la liste reste une simple consultation.

**Test indépendant** : cliquer sur un objet de la liste et vérifier que la page Brisage s'ouvre sur cet objet.

**Scénarios d'acceptation** :

1. **Étant donné** un objet de la liste, **quand** le joueur le choisit, **alors** la page Brisage affiche cet objet comme s'il avait été trouvé par son nom.
2. **Étant donné** que le joueur revient à la recherche par stats, **quand** il y retourne, **alors** sa sélection de stats et son tri sont conservés.

---

### User Story 5 - Affiner par niveau (Priorité : P3)

Le joueur limite la liste à une plage de niveaux d'objet (par exemple 150 à 200), car le niveau détermine le rendement en runes et les objets qu'il peut acheter.

**Pourquoi cette priorité** : confort ; la liste reste utilisable sans.

**Test indépendant** : fixer une plage de niveaux et vérifier que tous les objets listés sont dans la plage.

**Scénarios d'acceptation** :

1. **Étant donné** une plage de niveaux, **quand** elle est appliquée, **alors** seuls les objets dont le niveau est dans la plage restent listés.
2. **Étant donné** une plage inversée ou vide, **quand** le joueur la saisit, **alors** elle est corrigée ou refusée avec un message, sans planter.

---

### Cas limites

- Une stat ciblable qui n'a aucun objet : message « Aucun objet ne porte cette stat », pas de liste vide muette.
- Une stat qui existe sur l'objet à la fois en jet positif et en jet négatif : seul le jet positif compte ; un objet qui n'a que des jets négatifs sur la stat n'est pas listé.
- Un objet dont le jet est fixe (une seule valeur) : la fourchette s'affiche comme une valeur unique.
- Une liste très longue (stat très répandue comme Vitalité) : elle reste fluide, par pagination ou chargement progressif, et le nombre total d'objets trouvés est indiqué.
- Données d'objets indisponibles ou partiellement chargées : la page le dit, affiche ce qu'elle a et ne présente pas une liste incomplète comme complète.
- Objets sans rune de brisage utile (ressources, consommables) : jamais listés ; seuls les équipements brisables le sont.
- Objets de plusieurs versions ou doublons de nom : chacun reste distinct (même identifiant stable que le reste du site).

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La page Brisage MUST offrir un sélecteur de stats à choix multiple, qui ne propose que les stats ciblables (stat ayant une rune connue, hors stat « chasse » 696969, hors effets exo).
- **FR-002** : Le sélecteur MUST afficher les stats par leur libellé français, permettre de filtrer par saisie et de retirer une stat choisie.
- **FR-003** : Le système MUST lister les équipements brisables du jeu qui ont un jet **positif** sur la sélection, portant toutes les stats choisies (voir User Story 2).
- **FR-004** : Chaque ligne MUST afficher le nom, l'image, le niveau de l'objet et, pour chaque stat choisie, la fourchette du jet.
- **FR-005** : Chaque ligne MUST afficher une estimation des runes de chaque stat choisie, calculée avec la formule du brisage existante (`specs/060`), le jet moyen par défaut (`specs/061`, FR-006) et un coefficient de référence de 100 %, étiquetée comme estimation.
- **FR-006** : La liste MUST pouvoir être triée par défaut selon les runes ciblées estimées, et selon au moins un critère au choix (valeur en kamas, jet maximal) ; l'ordre MUST être stable et reproductible.
- **FR-007** : Le tri par valeur en kamas MUST utiliser les prix de runes du serveur actif ; un prix manquant MUST être traité comme inconnu, jamais comme 0 (constitution III).
- **FR-008** : Choisir un objet dans la liste MUST ouvrir la page Brisage de cet objet.
- **FR-009** : La sélection de stats, le tri et la plage de niveaux MUST être conservés tant que le joueur navigue entre la recherche et le brisage d'un objet.
- **FR-010** : Sans stat choisie, la page MUST afficher une invitation et aucune liste.
- **FR-011** : La page MUST indiquer le nombre d'objets trouvés et la provenance/date des données d'objets, et signaler clairement des données indisponibles ou incomplètes (constitution I, projet).
- **FR-012** : La recherche MUST NOT modifier les coefficients, prix ou sessions de brisage enregistrés du joueur.
- **FR-013** : Les règles d'éligibilité des stats, de filtrage et de tri MUST être des fonctions explicites couvertes par des tests automatisés (cas normaux, bornes, entrées vides ou invalides) (constitution II).

### Entités clés

- **Stat ciblable** : une caractéristique pour laquelle une rune de brisage existe, avec son libellé, son poids et son identifiant d'effet.
- **Objet brisable** : un équipement du jeu avec son identifiant stable, nom, niveau, image et ses lignes d'effets (jets positifs, fourchettes).
- **Sélection de recherche** : stats choisies, règle de combinaison, critère de tri, plage de niveaux.
- **Résultat de recherche** : un objet brisable avec, par stat choisie, sa fourchette de jet et les runes estimées à 100 %.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Un joueur obtient la liste des objets portant une stat donnée en moins de 3 actions (ouvrir la recherche, choisir la stat, lire la liste).
- **SC-002** : Après un premier chargement, un changement de sélection, de tri ou de niveau met la liste à jour en moins de 1 seconde dans 95 % des cas.
- **SC-003** : 100 % des objets listés ont un jet positif sur chacune des stats choisies, et 0 stat « chasse » ou exo n'apparaît comme ciblable.
- **SC-004** : Pour la stat Prospection, les 5 premiers objets du tri par défaut correspondent à ceux qu'un calcul manuel avec la formule du brisage classerait en tête.
- **SC-005** : Aucune valeur estimée n'est présentée sans l'indication « estimation à 100 % » ni aucun prix inconnu présenté comme 0.

## Hypothèses

- Le périmètre est la page Brisage ; la recherche par nom existante reste inchangée et accessible.
- Seuls les équipements (armes comprises) sont concernés ; ressources et consommables sont hors périmètre.
- Les stats ciblables sont celles déjà connues du site avec une rune (`BRISAGE_STATS`) ; une stat sans rune connue est hors périmètre, y compris les poids non confirmés, qui restent signalés comme tels.
- L'estimation en runes réutilise le modèle existant (jet moyen, formule `specs/060`) et ne dépend d'aucun coefficient saisi : elle utilise la référence à 100 % ; le joueur affine ensuite sur la page de l'objet.
- Le prix de l'objet n'entre pas dans le tri de cette première version (`specs/062` reste sur la page de l'objet) ; un tri par rentabilité nette est une évolution possible.
- Le focus reste calculé sur la page de l'objet ; la recherche n'estime que le brisage normal.
- Dépendance : les effets de tous les équipements doivent être disponibles côté site (aujourd'hui, ils sont lus objet par objet depuis la source de données d'objets) ; la manière de les obtenir est décidée au plan, mais la fonctionnalité doit rester utilisable si la source est lente ou indisponible.
- Les préférences de recherche sont propres au navigateur du joueur ; aucune donnée personnelle supplémentaire n'est collectée (constitution V).
