# Feature Specification: Thèmes de couleurs des Dofus primordiaux

**Feature Branch**: `074-dofus-color-themes`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Thèmes de couleurs des 6 Dofus primordiaux. Dans la page Paramètres, l'utilisateur voit 6 Dofus cliquables (émeraude, pourpre, turquoise, ocre, ébène, ivoire). Cliquer sur un Dofus applique son thème de couleurs à tout le site (accent actuellement vert émeraude, fond et lueurs inclus, en gardant les modes clair et sombre existants) et remplace l'icône d'émeraude du site (actuellement prise sur DofusDB) par l'image du Dofus choisi, également prise sur DofusDB. Le choix est mémorisé. Émeraude reste le thème par défaut."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choisir un Dofus et voir le site changer de couleurs (Priority: P1)

Dans la page Paramètres, une section « Dofus » montre les six Dofus primordiaux (émeraude, pourpre, turquoise, ocre, ébène, ivoire), chacun avec son image. L'utilisateur clique sur l'un d'eux : les couleurs du site (couleur d'accent, fond, lueurs) prennent immédiatement la teinte de ce Dofus. Le Dofus actif est mis en évidence.

**Why this priority**: c'est le cœur de la demande : sans le changement de couleurs, il n'y a pas de fonctionnalité.

**Independent Test**: ouvrir Paramètres, cliquer sur chaque Dofus l'un après l'autre et vérifier que les couleurs du site changent à chaque clic, sur plusieurs pages.

**Acceptance Scenarios**:

1. **Given** le site à l'état initial, **When** l'utilisateur ouvre Paramètres, **Then** six Dofus sont affichés et l'émeraude est signalé comme actif.
2. **Given** la page Paramètres ouverte, **When** l'utilisateur clique sur le Dofus pourpre, **Then** la couleur d'accent, le fond et les lueurs du site passent à des teintes pourpres, sans rechargement de la page.
3. **Given** un Dofus choisi, **When** l'utilisateur navigue vers une autre page du site, **Then** le même thème de couleurs s'y applique.
4. **Given** le mode clair ou le mode sombre actif, **When** l'utilisateur choisit un Dofus, **Then** le mode reste inchangé et le thème du Dofus s'applique dans ce mode, avec des textes lisibles.

---

### User Story 2 - L'icône du site devient le Dofus choisi (Priority: P1)

L'icône d'émeraude affichée en haut du site (barre de navigation) est remplacée par l'image du Dofus sélectionné.

**Why this priority**: c'est la seconde moitié explicite de la demande, et ce qui rend le thème reconnaissable d'un coup d'œil.

**Independent Test**: choisir chaque Dofus et vérifier que l'icône de la barre de navigation montre ce Dofus.

**Acceptance Scenarios**:

1. **Given** le thème émeraude, **When** l'utilisateur choisit le Dofus ocre, **Then** l'icône de la barre de navigation affiche le Dofus ocre.
2. **Given** un Dofus choisi, **When** l'utilisateur change de page, **Then** l'icône reste celle du Dofus choisi.

---

### User Story 3 - Le choix est conservé (Priority: P2)

Le Dofus choisi est mémorisé : l'utilisateur le retrouve à sa prochaine visite, sans le rechoisir, et sans flash de l'ancienne couleur au chargement.

**Why this priority**: sans mémorisation, le choix serait perdu à chaque visite, mais la fonctionnalité reste utilisable sans.

**Independent Test**: choisir un Dofus, recharger la page puis fermer et rouvrir le site : le même Dofus est actif.

**Acceptance Scenarios**:

1. **Given** le Dofus turquoise choisi, **When** l'utilisateur recharge la page, **Then** le site s'affiche directement en turquoise, avec l'icône turquoise.
2. **Given** un nouveau visiteur ou aucun choix mémorisé, **When** il ouvre le site, **Then** le thème émeraude est appliqué.

---

### Edge Cases

- Le choix mémorisé est absent, illisible ou ne correspond à aucun des six Dofus : le thème émeraude s'applique.
- L'image d'un Dofus ne se charge pas (DofusDB indisponible) : un repli visible remplace l'image, et les couleurs du thème restent appliquées.
- Le Dofus ébène (sombre) et le Dofus ivoire (clair) donnent des couleurs proches du noir ou du blanc : le texte, les boutons et les états sélectionnés restent lisibles et suffisamment contrastés dans les modes clair et sombre.
- Les couleurs à signification fixe (kamas en or, avertissement, erreur) gardent leur rôle quel que soit le Dofus.
- Les illustrations déjà colorées (images d'objets, d'équipements) ne sont pas recolorées.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La page Paramètres MUST proposer une section présentant les six Dofus primordiaux (émeraude, pourpre, turquoise, ocre, ébène, ivoire), chacun avec son nom et son image.
- **FR-002**: L'utilisateur MUST pouvoir choisir un Dofus en cliquant dessus ; le Dofus actif MUST être mis en évidence et annoncé comme sélectionné aux technologies d'assistance.
- **FR-003**: Le choix d'un Dofus MUST appliquer immédiatement son thème à tout le site : couleur d'accent, fond, lueurs et états sélectionnés.
- **FR-004**: Le thème d'un Dofus MUST s'appliquer en mode clair comme en mode sombre, sans modifier le mode choisi par l'utilisateur.
- **FR-005**: L'icône du site dans la barre de navigation MUST afficher l'image du Dofus sélectionné.
- **FR-006**: Les images des six Dofus MUST provenir de DofusDB, comme celle de l'émeraude aujourd'hui.
- **FR-007**: Le choix MUST être mémorisé d'une visite à l'autre et appliqué dès l'affichage de la page, sans flash de l'ancien thème.
- **FR-008**: Le thème émeraude MUST rester le thème par défaut. Son rendu reste celui d'origine, à une exception demandée après la livraison : ses lueurs de fond sont adoucies comme celles des autres thèmes.
- **FR-009**: Les textes, boutons et indicateurs MUST rester lisibles avec chacun des six Dofus dans les deux modes (contraste suffisant).
- **FR-010**: Les couleurs à signification fixe (kamas, avertissement, erreur) MUST garder leur rôle avec tous les thèmes.

### Key Entities

- **Dofus primordial**: l'un des six œufs (émeraude, pourpre, turquoise, ocre, ébène, ivoire) ; porte un nom, une image et une palette de couleurs pour chaque mode.
- **Préférence de Dofus**: le choix de l'utilisateur, un seul Dofus actif à la fois, émeraude par défaut.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur change de Dofus en un seul clic depuis Paramètres, et le site change de couleurs en moins d'une seconde, sans rechargement.
- **SC-002**: Les six Dofus donnent six rendus visuellement distincts, reconnaissables à leur teinte dominante.
- **SC-003**: 100 % des pages du site prennent le thème choisi, sans élément resté dans la couleur de l'émeraude (hors couleurs à signification fixe).
- **SC-004**: Le choix est retrouvé à 100 % après rechargement, sans flash de l'ancien thème.
- **SC-005**: Les textes courants atteignent un contraste d'au moins 4,5:1 avec chacun des six Dofus, dans les deux modes.

## Assumptions

- Le thème de couleurs (Dofus) est indépendant du mode clair/sombre existant : les deux se combinent, soit douze rendus possibles.
- La mémorisation se fait dans le navigateur de l'utilisateur, comme le choix clair/sombre actuel ; il n'y a pas de compte ni de synchronisation entre appareils.
- Les images des Dofus viennent de DofusDB, comme celle de l'émeraude ; si elles étaient absentes, un repli visuel s'affiche.
- Les teintes de chaque Dofus s'inspirent de ses couleurs dans le jeu (ébène : noir bleuté, ivoire : blanc crème, etc.), ajustées pour garder le texte lisible.
- Hors périmètre : recolorer les illustrations d'objets, et changer les couleurs à signification fixe (kamas, avertissement, erreur).
