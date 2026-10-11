# Feature Specification: Design « Cosmos » au choix

**Feature Branch**: `claude/peaceful-galileo-go5rny` (numéro de fonctionnalité 032 ; la branche de la session tient lieu de `032-cosmos-design`)

**Created**: 2026-10-09

**Status**: En pause (2026-10-09) — rendu jugé trop éloigné du style de Dofus 3 ; rien n'est fusionné dans master

**Input**: User description: "Ajouter un troisième design « Cosmos » au choix dans Paramètres (réglage Design existant : Classique, Nouveau, et maintenant Cosmos), inspiré de l'interface du jeu Dofus 3 : fenêtres bleu nuit en relief, barres de titre ardoise bombées au titre centré, zones creusées pour les filtres et champs, lignes de liste bombées façon hôtel de vente, ligne sélectionnée avec liseré de la couleur d'accent et halo, boutons secondaires biseautés en petites capitales, bouton principal hexagonal façon « JOUER », jauges creusées façon barre de pods, barres de défilement fines ardoise, fond de nébuleuse violette/turquoise étoilée, police Nunito, niveaux en texte doré sans cadre. La page Recherche, en Cosmos et sur grand écran, place côte à côte les résultats, la fiche de l'objet et les prix des ressources sur toute la hauteur, chaque longue liste défilant dans sa propre fenêtre. Le design Cosmos ne change ni les parcours, ni les libellés, ni les fonctionnalités ; il garde les icônes déjà utilisées par l'application, fonctionne en thème clair et sombre et avec les couleurs d'accent existantes, sur ordinateur et mobile, et respecte la réduction des animations. Les designs Classique et Nouveau restent inchangés. Maquette de référence : https://claude.ai/artifact/4H7eo5T3RK1jSwxzFS5kU4"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choisir le design Cosmos (Priority: P1)

Le joueur ouvre Paramètres et voit, dans le réglage « Design », un troisième choix « Cosmos » à
côté de « Classique » et « Nouveau ». En le choisissant, toute l'application prend l'allure des
fenêtres du jeu : panneaux bleu nuit en relief posés sur une nébuleuse étoilée, barres de titre
bombées, listes en lignes façon hôtel de vente, accent vif sur ce qui est actif. Toutes les pages,
leurs libellés et tout ce qu'on peut y faire restent identiques.

**Why this priority**: c'est l'objet de la demande — proposer aux joueurs une interface qui
rappelle le jeu, sans rien leur retirer.

**Independent Test**: dans Paramètres, choisir « Cosmos », puis parcourir Accueil, Recherche,
Suivis, Rentabilité, HDV, XP Familier, Forgemagie et Paramètres : chaque page a l'allure Cosmos et
chaque parcours fonctionne comme avant.

**Acceptance Scenarios**:

1. **Given** le design « Nouveau » actif, **When** le joueur choisit « Cosmos » dans Paramètres,
   **Then** toute l'application change d'allure immédiatement, sans rechargement.
2. **Given** le design « Cosmos » actif, **When** le joueur utilise n'importe quelle page
   (recherche, filtres, saisie de prix, choix acheter/crafter, historique des prix, suivi
   d'objets et collections, rentabilité, saisie HDV, XP familier, forgemagie, changement de
   serveur et de mode, visite guidée, confirmation de prix inhabituel, compteur de donjon),
   **Then** tout fonctionne exactement comme dans les autres designs.
3. **Given** le design « Cosmos » actif, **When** le joueur passe en thème clair ou sombre ou
   change la couleur principale, **Then** Cosmos s'adapte et reste lisible.
4. **Given** le design « Cosmos » choisi, **When** le joueur recharge la page ou revient plus
   tard sur le même appareil, **Then** Cosmos est toujours appliqué dès l'affichage.

---

### User Story 2 - Recherche sur trois colonnes (Priority: P2)

Sur un grand écran, en Cosmos, la page Recherche place côte à côte, sur toute la hauteur de
l'écran, la fenêtre des résultats (avec la recherche et les filtres), la fiche de l'objet choisi
(prix HDV, verdict, effets) et la fenêtre des prix des ressources. Chaque longue liste — résultats,
effets, ingrédients — défile dans sa propre fenêtre, sans laisser de vide au milieu de l'écran.

**Why this priority**: c'est la page la plus utilisée ; la disposition actuelle laisse un grand
vide et les longues recettes ou listes d'effets débordent.

**Independent Test**: en Cosmos sur un écran large, rechercher un objet de haut niveau à longue
recette : résultats, fiche et ressources sont visibles ensemble ; chaque liste défile seule ; le
verdict, avec le coût de craft, reste visible pendant qu'on fait défiler les ressources.

**Acceptance Scenarios**:

1. **Given** Cosmos actif sur un écran large, **When** le joueur ouvre Recherche et choisit un
   objet, **Then** les trois fenêtres sont visibles côte à côte sur la hauteur de l'écran.
2. **Given** un objet à longue recette ou à nombreux effets, **When** il est affiché, **Then** la
   liste concernée défile dans sa fenêtre et la page elle-même ne s'allonge pas.
3. **Given** Cosmos actif sur un écran étroit ou un mobile, **When** le joueur ouvre Recherche,
   **Then** les fenêtres s'empilent dans le même ordre, sans défilement horizontal.

---

### User Story 3 - Revenir à un autre design (Priority: P3)

Si Cosmos ne lui plaît pas, le joueur choisit « Classique » ou « Nouveau » dans Paramètres et
retrouve l'application exactement comme avant.

**Why this priority**: condition pour proposer un design de plus sans risque.

**Independent Test**: passer en Cosmos puis revenir en « Nouveau » puis en « Classique » : chaque
design est visuellement identique à ce qu'il était avant cette fonctionnalité.

**Acceptance Scenarios**:

1. **Given** Cosmos actif, **When** le joueur choisit « Nouveau » ou « Classique », **Then**
   l'application retrouve immédiatement ce design, à l'identique.

---

### Edge Cases

- Stockage local indisponible ou vidé : le design par défaut actuel (« Nouveau ») s'applique,
  sans erreur ; Cosmos n'est jamais imposé sans choix du joueur.
- Écran de choix du serveur (avant tout accès à Paramètres) : il suit le design mémorisé.
- Éléments qui reproduisent le jeu (icônes de catégorie, cases d'objets, icônes de
  caractéristiques, icône kamas, images d'objets) : ils gardent leurs images et couleurs actuelles.
- Joueur qui demande à réduire les animations : les animations et transitions de Cosmos sont
  désactivées ; le fond reste fixe.
- Thème clair : Cosmos garde sa structure (fenêtres, barres de titre, lignes, zones creusées) dans
  une variante claire lavande, avec un contraste de texte au moins équivalent aux autres designs.
- Recherche sans objet choisi, sans résultat ou en erreur : les messages actuels s'affichent dans
  leurs fenêtres, sans casser la disposition en colonnes.
- Contenus très longs (nom d'objet, prix à 9 chiffres) : ils passent à la ligne ou sont tronqués
  proprement, jamais coupés au point d'être illisibles, et sans défilement horizontal de la page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le réglage « Design » de Paramètres MUST proposer trois choix : « Classique »,
  « Nouveau » et « Cosmos », présentés comme aujourd'hui, le choix actif mis en évidence.
- **FR-002**: Choisir Cosmos MUST s'appliquer immédiatement à toute l'application, sans
  rechargement, et être mémorisé sur l'appareil comme les deux autres designs, sans apparition
  visible d'un autre design au chargement suivant.
- **FR-003**: Le design par défaut (sans choix mémorisé) MUST rester « Nouveau ».
- **FR-004**: Cosmos MUST couvrir toutes les pages et éléments : navigation (barre latérale et
  barre d'onglets mobile), choix et changement de serveur, Accueil, Recherche, Suivis,
  Rentabilité, HDV, XP Familier, Forgemagie, Paramètres, bannière d'information, visite guidée,
  dialogues (prix inhabituel, historique des prix), compteur de donjon, états vides et de
  chargement.
- **FR-005**: Cosmos MUST garder la même organisation de contenu, les mêmes libellés, les mêmes
  contrôles et les mêmes fonctionnalités que les autres designs ; seule l'apparence change, sauf
  la disposition de la page Recherche décrite en FR-008.
- **FR-006**: Cosmos MUST reprendre le langage visuel de l'interface de Dofus 3 : fenêtres bleu
  nuit en relief (dégradé, liseré clair en haut, bord sombre, ombre portée), barres de titre
  bombées au titre centré, zones creusées pour filtres et champs de saisie, lignes de liste
  bombées, ligne ou élément sélectionné entouré de la couleur principale avec un halo, boutons
  secondaires biseautés en petites capitales, bouton d'action principal hexagonal façon
  « JOUER », jauges creusées à remplissage bombé, barres de défilement fines ardoise, fond de
  nébuleuse violette et turquoise étoilée, police ronde et grasse, niveaux en texte doré sans
  cadre ni fond.
- **FR-007**: Cosmos MUST utiliser les icônes et images déjà présentes dans l'application (jeu
  d'icônes de l'application, icônes officielles de catégories et de caractéristiques, icône
  kamas, images d'objets) ; aucune icône n'est remplacée ni retirée.
- **FR-008**: En Cosmos, sur un écran assez large, la page Recherche MUST placer côte à côte, sur
  la hauteur de l'écran : (1) la recherche, les filtres et la liste des résultats, (2) la fiche de
  l'objet choisi avec son prix HDV, son verdict (qui affiche déjà le coût de craft) et ses
  effets, (3) les prix des ressources ; chaque liste longue MUST défiler dans sa fenêtre, le
  titre de la fenêtre restant visible. Sur un écran étroit, ces blocs MUST s'empiler dans cet
  ordre. (Révision plan 2026-10-09 : la page n'affiche pas de total sous la liste des
  ressources ; le coût de craft reste celui du verdict, aucun affichage n'est ajouté.)
- **FR-009**: Cosmos MUST fonctionner en thème sombre (variante principale) et en thème clair
  (variante lavande), avec chacune des couleurs principales existantes, avec un contraste de
  texte au moins équivalent aux autres designs.
- **FR-010**: Cosmos MUST rester sans défilement horizontal de la page sur ordinateur et sur
  mobile, avec la même navigation mobile qu'aujourd'hui.
- **FR-011**: Les animations et transitions de Cosmos MUST être désactivées quand le système du
  joueur demande de réduire les animations.
- **FR-012**: Les designs « Classique » et « Nouveau » MUST rester visuellement identiques à ce
  qu'ils sont avant cette fonctionnalité.
- **FR-013**: Le choix du design MUST rester local à l'appareil : rien n'est envoyé au serveur.

### Key Entities

- **Préférence de design** : « Classique », « Nouveau » ou « Cosmos », mémorisée sur l'appareil,
  comme les préférences de thème et de couleur principale.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Passer à Cosmos, ou en revenir, prend un seul clic dans Paramètres et s'applique en
  moins d'une seconde.
- **SC-002**: 100 % des parcours existants (recherche, filtres, saisie de prix, acheter/crafter,
  historique, suivis et collections, rentabilité, HDV, XP familier, forgemagie, serveur, mode,
  visite guidée) fonctionnent à l'identique en Cosmos.
- **SC-003**: En Cosmos sur un écran de 1440 × 900, la page Recherche montre résultats, fiche et
  ressources en même temps, sans zone vide de plus d'un quart de l'écran.
- **SC-004**: Une recette de 20 ingrédients ou un objet de 15 effets reste entièrement accessible
  par défilement dans sa fenêtre, le verdict et son coût de craft restant visibles.
- **SC-005**: Aucun défilement horizontal ni texte illisible en Cosmos, en thème clair et sombre,
  sur ordinateur (1440 px) et sur mobile (390 px).
- **SC-006**: Revenus en « Classique » ou « Nouveau », ces designs sont visuellement identiques à
  la version précédente sur toutes les pages.

## Assumptions

- Cosmos est un choix supplémentaire, pas un remplacement : « Nouveau » reste le défaut et le
  réglage « Design » reste visible par tous les joueurs.
- Le seuil « écran assez large » pour la disposition en trois colonnes est d'environ 1200 px de
  largeur ; en dessous, la disposition empilée s'applique.
- Les couleurs principales existantes restent les mêmes choix ; Cosmos ajuste leur nuance pour le
  fond bleu nuit, comme il le fait déjà pour les thèmes clair et sombre.
- La police ronde utilisée par Cosmos est servie avec l'application ; si elle ne se charge pas,
  une police système proche la remplace sans casser la mise en page.
- Les noms, effets et prix visibles dans la maquette de référence sont des exemples ; seules la
  structure et l'allure servent de référence.
- Aucune nouvelle page, fonctionnalité ou modification de libellé n'est incluse.
