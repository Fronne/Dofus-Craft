# Research: Design « Cosmos »

## R1 — Où brancher le nouveau design

- **Decision**: troisième valeur `cosmos` de `DesignId` ; `applyDesign` écrit
  `document.documentElement.dataset.design = designId` pour toute valeur autre que `classic`.
- **Rationale**: la préférence, sa mémorisation, l'application avant le premier rendu
  (`main.tsx`) et le réglage de Paramètres existent déjà (specs/012) ; ajouter une valeur suffit.
- **Alternatives considered**: un nouveau réglage « Thème Cosmos » séparé (rejeté : il se
  combinerait mal avec Classique/Nouveau et doublerait la logique) ; empiler Cosmos sur
  `modern` (rejeté : les deux feuilles se contrediraient et rendraient Cosmos dépendant de
  « Nouveau »).

## R2 — Isoler Cosmos pour ne rien changer ailleurs

- **Decision**: toutes les règles de `design-cosmos.css` commencent par
  `:root[data-design="cosmos"]` ; un test unitaire le vérifie, comme pour design-modern.css.
- **Rationale**: garantit FR-012 (Classique et Nouveau identiques) et permet de retirer Cosmos en
  supprimant un fichier et une entrée.

## R3 — Couleurs, thèmes et accents

- **Decision**: Cosmos redéfinit les jetons existants (`--bg`, `--panel`, `--panel-strong`,
  `--panel-soft`, `--text*`, `--border*`, `--input-bg`, `--button-bg`, `--inner-bg`, ombres) pour
  le sombre (bleu nuit) et pour le clair (lavande), et ajuste les nuances `--gold`/`--gold-bright`
  de chaque couleur principale (`data-accent`) pour le fond Cosmos ; « vert » devient le
  vert-jaune du jeu. Les jetons `--slot-*` et `--image-bg` (éléments du jeu) ne sont pas touchés.
- **Rationale**: global.css consomme ces jetons partout ; la plupart des écrans prennent l'allure
  Cosmos sans règle dédiée, et les thèmes/accents continuent de fonctionner (FR-009).

## R4 — Recherche en trois colonnes sans toucher au JSX

- **Decision**: sous 1200 px, rien ne change. À partir de 1200 px :
  `.app-page:has(> .search-panel)` devient une grille 3 colonnes à hauteur d'écran ;
  `.grid` (ItemDetail + ressources) passe en `display: contents` ; `.search-panel` occupe la
  colonne 1, `.market-price-panel` puis `.item-detail-card` la colonne 2, la carte des
  ressources la colonne 3 ; chaque fenêtre a `overflow: auto` (liste des résultats, effets,
  ressources) et les titres restent visibles (`position: sticky`). Les messages de chargement ou
  d'erreur occupent la colonne 2.
- **Rationale**: FR-008 sans modifier le DOM (donc sans risque pour les autres designs ni pour la
  visite guidée qui cible `data-tour`). `:has()` absent → disposition empilée normale.
- **Alternatives considered**: ajouter un conteneur dans RecherchePage (rejeté : modifie le DOM de
  tous les designs) ; colonnes CSS multiples (rejeté : pas de défilement indépendant).

## R5 — Police

- **Decision**: `@fontsource-variable/nunito`, importée depuis design-cosmos.css ; pile de repli
  `Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif`.
- **Rationale**: même mécanisme qu'Inter pour « Nouveau » ; la police n'est téléchargée que si une
  règle Cosmos l'utilise.

## R6 — Éléments signature

- **Decision**: fenêtres (`.panel`, `.card`, `.result`, dialogues) en dégradé + liseré + ombre ;
  titres de carte (`.card > h2:first-child`) en barre bombée ; champs et zones (`input`,
  `select`, `.item-stats`, `.filters-panel`) creusés ; `.results button`, `.profit-row`,
  `.hdv-row`, `.pinned-card`, `.price-line` en lignes bombées ; sélection (`.selected`,
  `.active`, `aria-pressed`) en liseré d'accent + halo ; `.btn-secondary`, `.icon-button` et
  `.settings-choice` biseautés en petites capitales ; `.btn-primary` et `.pin-item-button`
  hexagonaux ; `.verdict-bar-track`/`.level-slider-*` en jauges ; barres de défilement ;
  niveaux (`.result-item-level`, `.pinned-card-level`) en texte doré. Animations limitées à des
  transitions courtes, coupées par la règle `prefers-reduced-motion` déjà présente dans
  theme.css.
