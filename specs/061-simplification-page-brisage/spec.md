# Feature Specification: Simplification de la page Brisage

**Feature Branch**: `061-simplification-page-brisage`
**Created**: 2026-10-19
**Status**: Draft
**Input**: Simplifier la page Brisage pour ne pas perdre l'utilisateur : prix de l'objet repris de la base,
dernier coefficient mémorisé, jet moyen par ligne (modifiable), résultat clair (rentable ou non, nombre de
brisages, coefficient minimal, meilleure rune à focus). Reprend et remplace l'interface de
`specs/060-page-brisage` ; les formules et hypothèses de la spec 060 restent valables.

## Contexte

La page Brisage de la spec 060 expose beaucoup de réglages (niveau, coût, coefficient, prix de runes,
poids, rendements). Le porteur veut une page **la plus simple possible** : le joueur choisit un objet, le
reste est pré-rempli ou calculé, et le résultat se lit d'un coup d'œil.

Les formules (descente du coefficient, poids de ligne, focus) et leurs hypothèses H1–H4 de la spec 060 ne
changent pas : seule l'interface et ses entrées changent. Les estimations non officielles restent
signalées sur la page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choisir un objet et lire le verdict (Priority: P1)

Le joueur cherche un objet par son nom et le sélectionne. Le coût de l'objet est repris automatiquement
de la base de données alimentée par la page Recherche (il ne varie pas pendant l'analyse). Le niveau de
l'objet vient de l'objet lui-même et n'est pas modifiable. Chaque ligne de stat reçoit un jet moyen par
défaut. La page affiche le verdict : **rentable ou non**, le **nombre de brisages** possibles avant que le
coefficient passe sous le seuil, et le **coefficient minimal de rentabilité**.

**Why this priority** : c'est la question du joueur ; sans elle la page n'a pas de valeur.

**Independent Test** : sélectionner un objet dont le prix est en base, saisir un coefficient, lire le
verdict sans toucher à un autre réglage.

**Acceptance Scenarios** :
1. **Given** un objet avec un prix en base, **When** le joueur le sélectionne, **Then** le coût est
   affiché sans saisie et aucun champ de niveau n'est proposé.
2. **Given** un coefficient et un coût, **Then** la page affiche « Rentable » ou « Pas rentable », le
   nombre de brisages avant le seuil (0 si déjà sous le seuil) et le coefficient minimal de rentabilité.
3. **Given** un objet sans prix en base, **Then** la page l'indique et propose de saisir le coût à la
   main ; aucun résultat chiffré n'est inventé.

### User Story 2 - Coefficient mémorisé ou à saisir (Priority: P1)

Si l'objet a déjà été brisé (coefficient déjà enregistré), la page affiche le **dernier coefficient et sa
date** et l'utilise. Sinon, elle demande au joueur de **saisir le coefficient** relevé en jeu après avoir
brisé l'objet. Le joueur peut mettre à jour le coefficient quand il en relève un nouveau ; la date est
alors actualisée.

**Why this priority** : sans coefficient, aucun calcul n'est possible ; le mémoriser évite de le ressaisir.

**Independent Test** : saisir un coefficient pour un objet, recharger la page, resélectionner l'objet :
coefficient et date réapparaissent.

**Acceptance Scenarios** :
1. **Given** un objet jamais brisé, **Then** un champ « Coefficient relevé en jeu après un brisage » est
   demandé et aucun résultat n'est affiché tant qu'il est vide.
2. **Given** un coefficient enregistré le 12/10, **Then** la page affiche « Dernier coefficient : 38 %
   (12/10) » et calcule avec cette valeur.
3. **Given** une nouvelle saisie, **Then** elle remplace le coefficient et la date du jour est enregistrée.

### User Story 3 - Jet moyen par ligne, modifiable (Priority: P2)

Pour chaque ligne de stat, la page prend par défaut le **jet moyen** : milieu de la fourchette arrondi à
l'entier inférieur (1–50 sagesse → 25 ; 5–10 critique → 7). Le joueur peut saisir un jet précis pour
n'importe quelle ligne ; un retour au jet moyen est possible.

**Independent Test** : sélectionner un objet, vérifier les jets moyens affichés, en modifier un et
constater que le résultat change.

**Acceptance Scenarios** :
1. **Given** une ligne 1–50, **Then** le jet par défaut est 25 ; **Given** 5–10, **Then** 7.
2. **Given** une ligne à valeur fixe, **Then** le jet est cette valeur.
3. **Given** un jet saisi à la main, **Then** le résultat utilise ce jet et la ligne est marquée comme
   modifiée.

### User Story 4 - Meilleure rune à focus (Priority: P2)

La page indique en une phrase la meilleure option : « Pas de focus » ou « Focus sur la rune X », avec le
gain par objet de cette option. Le détail des autres options n'est pas mis en avant.

**Independent Test** : sélectionner un objet dont les prix de runes sont connus et lire la recommandation.

**Acceptance Scenarios** :
1. **Given** des prix de runes connus, **Then** la meilleure option est celle au plus grand gain par objet.
2. **Given** une rune sans prix, **Then** cette option est écartée de la recommandation et signalée
   « prix manquant ».
3. **Then** la recommandation de focus affiche « estimation non officielle ».

## Requirements *(mandatory)*

- **FR-001** Le joueur sélectionne l'objet par recherche de nom ; aucune saisie manuelle de lignes.
- **FR-002** Le coût de l'objet est repris de la base de données (prix de la page Recherche, même mode de
  prix actif) ; il est fixe pendant l'analyse. À défaut de prix, le joueur peut saisir le coût.
- **FR-003** Le niveau de l'objet vient de l'objet ; aucun champ de niveau n'est proposé.
- **FR-004** Le dernier coefficient de brisage d'un objet et sa date sont mémorisés par objet et
  réaffichés à la sélection ; sans coefficient mémorisé, la page demande de le saisir.
- **FR-005** Le coefficient baisse à chaque brisage selon la formule de la spec 060 (H1) ; le nombre de
  brisages est calculé sur cette descente jusqu'au coefficient minimal de rentabilité.
- **FR-006** Chaque ligne reçoit un jet moyen par défaut (milieu arrondi à l'inférieur) ; le joueur peut
  le remplacer par un jet précis et revenir au jet moyen.
- **FR-007** Le résultat affiche : verdict rentable ou non, nombre de brisages avant de ne plus être
  rentable, coefficient minimal de rentabilité, meilleure option de focus (ou absence de focus).
- **FR-008** Les prix de runes viennent de la base ; plus de poids, rendements ni saisie de prix de rune
  sur la page principale (réglages avancés de la spec 060 retirés de l'interface).
- **FR-009** Le bandeau d'estimation non officielle (H1–H4) reste visible mais court.
- **FR-010** Aucune valeur fabriquée : donnée manquante → message explicite (Constitution I).
- **FR-011** *(planche « Page Brisage — proposition (tableau) » du canevas de design, validée le
  2026-10-19)* Disposition : objet (image, nom, niveau, coût, coefficient) → **verdict** → **tableau des
  lignes** → **gain sans focus selon le coefficient** → note d'estimation. Sur téléphone, le tableau devient
  une carte par ligne.
- **FR-012** Tableau : une ligne par stat avec jet (champ modifiable, jet moyen en valeur de départ),
  rune (icône et nom), prix unitaire de la rune, runes et valeur **sans focus**, runes et gain de l'objet
  **avec focus sur cette rune** ; pied de tableau : total de l'objet coût déduit.
- **FR-013** La ligne du meilleur focus est mise en surbrillance avec « Meilleur focus » **seulement si un
  focus rapporte plus que le brisage normal**. Si la meilleure option est de ne pas faire de focus, le
  verdict dit « Rentable sans focus » (ou « Pas rentable ») avec la mention « le focus ne rapporte pas
  plus », et aucune ligne n'est mise en surbrillance.
- **FR-014** Les montants en kamas portent l'icône des kamas du site, les runes leur icône (comme les
  autres pages) ; plus aucun rond jaune de substitution.
- **Hors périmètre** : saisie manuelle d'objet, courbe détaillée de descente, brisage en lot, partage des
  coefficients entre joueurs.

## Success Criteria

- **SC-001** Après le choix de l'objet, le verdict s'affiche avec une seule saisie au plus (le coefficient,
  si l'objet n'a jamais été brisé).
- **SC-002** Un joueur trouve en moins de 10 secondes : rentable ou non, nombre de brisages, coefficient
  minimal et rune à focus, sans défiler.
- **SC-003** Les jets moyens par défaut respectent la règle « milieu arrondi à l'inférieur » sur toutes
  les lignes d'un objet (tests unitaires).
- **SC-004** Un coefficient mémorisé réapparaît avec sa date après rechargement de la page.

## Assumptions

- Le coefficient mémorisé est conservé **sur l'appareil du joueur** (comme les réglages actuels), par
  objet ; il n'est pas partagé entre joueurs.
- Le coût de l'objet suit le mode de prix déjà choisi par le joueur dans l'application.
- Le niveau et les fourchettes de jets viennent des données de l'objet déjà chargées pour la page
  Recherche.
