# Feature Specification: Nouveau design « Moderne épuré » au choix

**Feature Branch**: `012-modern-design`

**Created**: 2026-09-24

**Status**: Draft

> **Remplacée le 2026-10-13** par [specs/051-site-visual-refresh](../051-site-visual-refresh/spec.md) :
> les designs « Classique » et « Moderne » et le réglage « Design » de Paramètres n'existent plus ;
> le site a un seul style. Les règles utiles du design « Moderne » ont été reprises dans
> `src/styles/global.css`.

**Input**: User description: "Proposer un nouveau design « Moderne épuré » pour toute l'application (même organisation des pages qu'aujourd'hui, allure modernisée : typographie plus soignée, cartes plus aérées, ombres douces, coins plus arrondis, dégradés doux, micro-animations discrètes), sans changer les parcours ni les fonctionnalités. Le joueur choisit dans Paramètres entre « Classique » (le design actuel, inchangé) et « Nouveau » ; le choix s'applique immédiatement, est mémorisé sur l'appareil, et permet de revenir à l'ancien design en un clic sans redéploiement. Le nouveau design doit fonctionner en thème clair et sombre, avec les couleurs d'accent existantes, sur ordinateur et mobile. Une fois le choix définitif fait, le design non retenu sera supprimé."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Essayer le nouveau design (Priority: P1)

Le joueur ouvre Paramètres, choisit le design « Nouveau » et voit immédiatement toute
l'application prendre une allure plus moderne : cartes plus aérées aux coins plus arrondis, ombres
douces, typographie plus soignée, légères animations au survol et à l'apparition des éléments. Les
pages, leur organisation et tout ce qu'on peut y faire restent identiques.

**Why this priority**: c'est l'objet de la demande — voir le nouveau design dans l'application
réelle pour décider s'il plaît.

**Independent Test**: dans Paramètres, choisir « Nouveau », puis parcourir Accueil, Recherche,
Épinglés, Prix et Paramètres : chaque page a la nouvelle allure et tous les parcours fonctionnent
comme avant.

**Acceptance Scenarios**:

1. **Given** le design « Classique » actif, **When** le joueur choisit « Nouveau » dans Paramètres,
   **Then** toute l'application change d'allure immédiatement, sans rechargement.
2. **Given** le design « Nouveau » actif, **When** le joueur utilise n'importe quelle page
   (recherche, saisie de prix, épinglage, collections, changement de serveur, visite guidée),
   **Then** tout fonctionne exactement comme en « Classique ».
3. **Given** le design « Nouveau » actif, **When** le joueur passe en thème clair ou sombre ou
   change la couleur d'accent, **Then** le nouveau design s'adapte, lisible dans les deux thèmes.

---

### User Story 2 - Revenir à l'ancien design en un clic (Priority: P1)

Si le nouveau design ne plaît pas, le joueur choisit « Classique » dans Paramètres et retrouve
exactement l'application d'aujourd'hui.

**Why this priority**: c'est la condition posée pour accepter d'essayer le nouveau design.

**Independent Test**: passer en « Nouveau », puis revenir en « Classique » : l'application est
visuellement identique à ce qu'elle était avant cette fonctionnalité.

**Acceptance Scenarios**:

1. **Given** le design « Nouveau » actif, **When** le joueur choisit « Classique », **Then**
   l'application retrouve immédiatement son apparence actuelle, à l'identique.
2. **Given** un design choisi, **When** le joueur recharge la page ou revient plus tard sur le même
   appareil, **Then** le design choisi est toujours appliqué, dès l'affichage de la page.

---

### Edge Cases

- Stockage local indisponible ou vidé : le design « Nouveau » s'applique, sans erreur.
- Écran de choix du serveur (avant tout accès à Paramètres) : il suit le design mémorisé sur
  l'appareil.
- Éléments qui reproduisent le jeu (icônes de catégorie, cases et fonds d'icônes d'objets et de
  ressources, icônes de caractéristiques) : leurs couleurs restent celles du jeu dans les deux
  designs.
- Joueur qui préfère réduire les animations (réglage du système) : les animations du nouveau design
  sont désactivées.
- Petits écrans : le nouveau design reste sans défilement horizontal, avec la même navigation
  mobile qu'aujourd'hui.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Paramètres MUST proposer un réglage « Design » avec deux choix : « Classique » et
  « Nouveau », présentés comme les autres réglages de la page, le choix actif mis en évidence.
- **FR-002**: Le changement de design MUST s'appliquer immédiatement à toute l'application, sans
  rechargement ni redéploiement.
- **FR-003**: Le choix MUST être mémorisé sur l'appareil et appliqué dès l'affichage de
  l'application lors des visites suivantes, sans apparition visible de l'autre design au
  chargement.
- **FR-004**: Sans choix mémorisé (nouvel appareil, stockage vidé ou indisponible), le design
  « Nouveau » MUST s'appliquer (révision 2026-09-24 ; auparavant « Classique »). Seul un clic du
  joueur dans Paramètres mémorise un design. Les choix enregistrés avant cette révision sont
  ignorés (ils pouvaient avoir été enregistrés sans choix réel) : tous les appareils repartent sur
  « Nouveau ».
- **FR-005**: Le design « Classique » MUST rester visuellement identique au design actuel.
- **FR-006**: Le design « Nouveau » MUST couvrir toutes les pages et éléments de l'application :
  navigation, choix du serveur, Accueil, Recherche (y compris la visite guidée et la confirmation
  de prix inhabituel), Épinglés, Prix, Paramètres.
- **FR-007**: Le design « Nouveau » MUST garder la même organisation des pages, les mêmes libellés
  et les mêmes fonctionnalités que le design « Classique ». Seule l'apparence change.
- **FR-008**: Le design « Nouveau » MUST fonctionner en thème clair et en thème sombre, avec
  chacune des couleurs d'accent existantes, avec un contraste de texte au moins équivalent au
  design actuel.
- **FR-009**: Le design « Nouveau » MUST apporter : coins plus arrondis, ombres douces, espacements
  plus généreux dans les cartes, typographie plus soignée (hiérarchie des titres plus marquée),
  dégradés doux en arrière-plan, et des animations discrètes au survol et à l'apparition des
  éléments (durée courte, jamais bloquantes).
- **FR-010**: Les animations du design « Nouveau » MUST être désactivées quand le système du joueur
  demande de réduire les animations.
- **FR-011**: Les éléments qui reproduisent le jeu MUST garder les couleurs du jeu dans les deux
  designs.
- **FR-012**: Le choix du design MUST rester local à l'appareil : rien n'est envoyé au serveur.

### Key Entities

- **Préférence de design** : « Classique » ou « Nouveau », mémorisée sur l'appareil, comme les
  préférences de thème et de couleur d'accent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Passer d'un design à l'autre prend un seul clic dans Paramètres et s'applique en
  moins d'une seconde.
- **SC-002**: Revenu en « Classique », l'application est visuellement identique à la version
  précédant cette fonctionnalité sur toutes les pages.
- **SC-003**: Tous les parcours existants (recherche, saisie de prix, épinglage, collections,
  changement de serveur et de mode, visite guidée) fonctionnent à l'identique dans les deux
  designs.
- **SC-004**: Aucun défilement horizontal ni texte illisible dans le design « Nouveau », en thème
  clair et sombre, sur ordinateur et sur mobile.
- **SC-005**: Le joueur peut décider de garder ou non le nouveau design après l'avoir utilisé dans
  ses parcours habituels.

## Assumptions

- Le design « Nouveau » est le défaut (révision 2026-09-24), y compris pour les autres joueurs :
  « Classique » reste disponible en un clic dans Paramètres, le temps de décider.
- Le réglage est visible par tous les joueurs dans Paramètres pendant la période d'essai.
- Une fois la décision prise, une évolution séparée supprimera le design non retenu et le réglage
  « Design » ; elle est hors du périmètre de cette spécification.
- Aucune nouvelle page, fonctionnalité ou modification de libellé n'est incluse.
- Les éléments reproduisant le jeu suivent la règle déjà établie : couleurs du jeu, pas celles du
  thème de l'application.
