# Feature Specification: Fiche d'arme façon tooltip du jeu

**Feature Branch**: `009-weapon-tooltip-layout`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Affichage détaillé des armes dans la fiche d'objet (ItemDetail), pour ressembler au tooltip du jeu Dofus. Bloc d'informations d'arme (Coût PA, Portée, Lancer par tour, Critique %, Bonus critique, Zone), section 'Effets de l'arme' avec les dommages/vol de l'arme, puis section 'Effets' avec le type d'arme et les autres bonus de caractéristiques."

## User Scenarios & Testing *(mandatory)*

> **Révisé le 2026-09-21 (retour utilisateur, capture d'écran)** : après une première
> implémentation, l'utilisateur a demandé de retirer le bloc d'informations de combat (User Story
> 1 ci-dessous) et de ne garder que les deux sections d'effets ("Effets de l'arme" et "Effets").
> User Story 1 et ses exigences associées (FR-002, FR-007, FR-008, SC-001) sont donc **retirées du
> périmètre** de cette fonctionnalité ; elles restent documentées ci-dessous à titre d'historique
> mais ne sont plus implémentées.
>
> **Révisé une seconde fois le 2026-09-21 (retour utilisateur, capture d'écran)** : une fois les
> deux sections restantes visibles en conditions réelles, l'utilisateur a signalé qu'elles
> prenaient trop de place verticalement. Deux ajustements en ont découlé : (1) User Story 3
> (ligne de catégorie en tête de "Effets") s'est révélée faire doublon avec la ligne "Catégorie :
> ..." déjà affichée plus haut et a été retirée à son tour (voir sa section ci-dessous) ; (2) les
> marges/espacements des sections "Effets*" ont été resserrés (`src/styles/global.css`). Seule
> User Story 2 (séparation des effets) reste en vigueur.

### User Story 1 - Voir les informations de combat d'une arme en un coup d'œil (Priority: P1) — RETIRÉE (voir note de révision ci-dessus)

Un joueur consulte la fiche d'une arme dans le catalogue pour savoir si elle correspond à son
style de jeu. Il veut voir immédiatement le coût en PA, la portée, le nombre de lancers par tour,
le taux de critique et le bonus critique, sans avoir à les retrouver mélangés au milieu de la
liste des caractéristiques.

**Why this priority**: C'est l'information la plus consultée avant d'envisager de fabriquer ou
d'équiper une arme ; sans elle, la fiche actuelle ne permet pas de juger l'arme comme dans le jeu.

**Independent Test**: Ouvrir la fiche d'une arme dans le catalogue et vérifier que le coût en PA,
la portée, le nombre de lancers par tour, le taux de critique et le bonus critique apparaissent
dans un bloc dédié, avant la liste des effets.

**Acceptance Scenarios**:

1. **Given** une arme dont les données incluent un coût en PA, une portée et un taux de critique,
   **When** l'utilisateur ouvre sa fiche, **Then** un bloc d'informations d'arme affiche ces
   valeurs de façon lisible, séparément des effets.
2. **Given** une arme avec une portée fixe (portée minimale égale à la portée maximale),
   **When** l'utilisateur consulte le bloc d'informations, **Then** la portée est affichée comme
   une valeur unique plutôt que comme un intervalle.
3. **Given** une arme avec une portée variable (portée minimale différente de la portée maximale),
   **When** l'utilisateur consulte le bloc d'informations, **Then** la portée est affichée comme
   un intervalle (minimum à maximum).

---

### User Story 2 - Distinguer les dégâts de l'arme des autres bonus de l'objet (Priority: P2)

Un joueur veut savoir combien de dégâts une arme inflige réellement (dommages et vol par élément)
sans que cette information se noie parmi les bonus de caractéristiques (Vitalité, Force, Chance,
Résistances, etc.) que l'objet apporte par ailleurs.

**Why this priority**: C'est la deuxième information la plus recherchée après les informations de
combat de base, et la confusion actuelle entre "ce que l'arme inflige" et "ce que l'objet donne en
bonus passif" est la source directe du problème signalé par l'utilisateur.

**Independent Test**: Ouvrir la fiche d'une arme ayant à la fois des effets de dommages/vol et des
bonus de caractéristiques, et vérifier que les deux catégories apparaissent dans deux sections
distinctes et clairement intitulées.

**Acceptance Scenarios**:

1. **Given** une arme qui inflige des dommages et/ou du vol sur un ou plusieurs éléments,
   **When** l'utilisateur consulte sa fiche, **Then** ces lignes apparaissent dans une section
   "Effets de l'arme" distincte, avec l'icône de l'élément concerné.
2. **Given** la même arme, qui apporte aussi des bonus de caractéristiques (ex. Vitalité, Force),
   **When** l'utilisateur consulte sa fiche, **Then** ces bonus apparaissent dans une section
   "Effets" séparée de la section "Effets de l'arme".
3. **Given** un objet qui n'est pas une arme (ex. une ressource ou un équipement sans dommages),
   **When** l'utilisateur consulte sa fiche, **Then** l'affichage reste inchangé : une seule
   section "Effets" regroupant toutes les statistiques, comme aujourd'hui.

---

### User Story 3 - Repérer la catégorie de l'arme (Priority: P3) — RETIRÉE

> **Révisé le 2026-09-21 (retour utilisateur, capture d'écran)** : implémentée puis testée
> visuellement, cette user story s'est révélée redondante : le libellé de catégorie que "Effets"
> réutilisait (`category.label`) affiche la même valeur générique que la ligne "Catégorie : ..."
> déjà visible plus haut dans la fiche (ex. "Arme"), pas un type d'arme plus précis comme
> "Marteau"/"Épée". La répéter en tête de "Effets" n'ajoutait donc aucune information et prenait
> de la place inutilement — retirée à la demande de l'utilisateur, qui cherchait au contraire à
> réduire la hauteur de la fiche.

~~Un joueur veut voir à quelle catégorie d'arme appartient l'objet (ex. Marteau, Épée, Dague) mise
en avant dans la section "Effets", comme un repère visuel rapide en plus du nom de catégorie déjà
affiché plus haut dans la fiche.~~

~~**Why this priority**: C'est un confort visuel qui rapproche l'affichage du tooltip du jeu, mais
l'information (catégorie de l'arme) est déjà disponible ailleurs dans la fiche ; son absence ne
bloque aucune décision du joueur.~~

~~**Independent Test**: Ouvrir la fiche d'une arme et vérifier qu'une ligne de catégorie d'arme
apparaît en tête de la section "Effets".~~

~~**Acceptance Scenarios**:~~

~~1. **Given** une arme de type "Marteau", **When** l'utilisateur consulte la section "Effets",
   **Then** une ligne dédiée indique la catégorie de l'arme en tête de cette section.~~

---

### Edge Cases

- Que se passe-t-il si une arme ne fournit aucune des données de combat (coût PA, portée,
  critique) ? Le bloc d'informations d'arme n'affiche que les valeurs disponibles ; une donnée
  absente est omise plutôt que remplacée par une valeur inventée (conformément à l'exigence de ne
  jamais fabriquer de données).
- Que se passe-t-il si une arme n'inflige aucun dommage ni vol direct (aucun effet à ranger dans
  "Effets de l'arme") ? La section "Effets de l'arme" n'est pas affichée, et tous les effets vont
  dans la section "Effets" comme avant.
- Que se passe-t-il si une arme n'a aucun bonus de caractéristique en dehors de ses dommages
  (aucun effet à ranger dans "Effets") ? La section "Effets" n'est pas affichée si elle serait
  vide.
- Comment la zone d'effet est-elle présentée quand elle n'est pas un simple "case ciblée" (ex.
  croix, cercle) ? Elle est décrite en texte (ex. "Zone : croix de taille 1"), sans reproduire le
  schéma graphique du jeu.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT identifier si un objet consulté est une arme (par opposition à un
  équipement, une ressource ou un consommable) à partir des données déjà disponibles pour cet
  objet.
- ~~**FR-002**~~ (RETIRÉE le 2026-09-21, retour utilisateur) : bloc d'informations de combat
  distinct (coût PA, portée, lancers par tour, critique, bonus critique). Le système DOIT
  continuer à identifier une arme (FR-001) pour piloter la séparation des sections d'effets
  (FR-003/FR-004), mais n'affiche plus ce bloc dédié.
- **FR-003**: Le système DOIT afficher, pour une arme, une section "Effets de l'arme" listant
  uniquement les effets de dommages et de vol infligés par l'arme (un par élément concerné), avec
  l'icône de l'élément correspondant.
- **FR-004**: Le système DOIT afficher, pour une arme, une section "Effets" distincte listant les
  autres statistiques apportées par l'objet (bonus de caractéristiques, résistances, etc.), à
  l'exclusion des dommages/vol déjà présentés dans "Effets de l'arme".
- **FR-005**: Le système DOIT continuer à afficher une unique section "Effets" regroupant toutes
  les statistiques pour tout objet qui n'est pas identifié comme une arme, sans changement par
  rapport au comportement actuel.
- **FR-006**: Le système DOIT masquer une section ("Effets de l'arme" ou "Effets") lorsqu'elle ne
  contiendrait aucune ligne, plutôt que d'afficher un titre de section vide.
- ~~**FR-007**~~ (RETIRÉE le 2026-09-21, retour utilisateur) : affichage textuel de la zone
  d'effet, propre au bloc d'informations de combat retiré.
- ~~**FR-008**~~ (RETIRÉE le 2026-09-21, retour utilisateur) : ne concernait que les valeurs du
  bloc d'informations de combat retiré. La règle générale de ne jamais fabriquer une donnée reste
  un principe du projet (Constitution, Principe I), pas une exigence propre à cette fonctionnalité.

### Key Entities

- **Arme** : objet du catalogue identifié comme telle (super-type DofusDB "Arme"), utilisé pour
  piloter la répartition des effets entre "Effets de l'arme" et "Effets".
- **Effet d'arme** : sous-ensemble des effets d'un objet correspondant à des dégâts ou du vol
  infligés par l'arme elle-même, par opposition aux bonus passifs qu'elle confère à son porteur.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- ~~**SC-001**~~ (RETIRÉE le 2026-09-21, retour utilisateur) : portait sur le bloc d'informations
  de combat retiré.
- **SC-002**: Sur un échantillon des armes du jeu comportant à la fois des dommages/vol et des
  bonus de caractéristiques, 100% affichent ces deux types d'information dans deux sections
  clairement distinctes.
- **SC-003**: La fiche des objets qui ne sont pas des armes reste identique à son comportement
  actuel (aucune régression visuelle ni fonctionnelle).

## Assumptions

- Une "arme" est un objet dont la catégorie appartient au super-type "Arme" des données DofusDB
  déjà consommées par le projet ; les autres catégories (équipements, ressources, consommables,
  etc.) ne sont pas concernées par ce changement d'affichage.
- ~~La ligne de catégorie d'arme affichée en tête de la section "Effets" (ex. "Marteau") reprend
  le libellé de catégorie déjà résolu ailleurs dans la fiche ; elle ne nécessite pas de nouvelle
  source de données.~~ (RETIRÉE le 2026-09-21 : cette hypothèse s'est révélée être le problème —
  le libellé réutilisé n'est pas un type d'arme précis mais la catégorie générique déjà affichée
  juste au-dessus, d'où le doublon retiré avec User Story 3.)
- La zone d'effet est présentée sous une forme textuelle simple (forme + taille) et non sous une
  forme graphique reproduisant exactement le rendu en jeu ; ce niveau de détail est jugé suffisant
  pour la décision d'équipement.
- Les intitulés visuels exacts (icônes, couleurs) suivent la charte graphique déjà utilisée dans
  la fiche d'objet actuelle plutôt qu'une reproduction pixel-perfect du tooltip du jeu.
