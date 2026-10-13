# Research: Nouveau style visuel pour tout le site

## 1. Où porter le changement de palette

- **Decision**: réécrire les jetons de `src/styles/theme.css` ; ne toucher aux règles des composants
  que là où la maquette change une forme ou un rôle.
- **Rationale**: `global.css` et `comparison.css` ne contiennent aucune couleur en dur (vérifié :
  zéro valeur hexadécimale ou `rgba()`), tout passe par les jetons. Changer les jetons repeint tout
  le site, administration comprise, d'un seul geste.
- **Alternatives considered**: une nouvelle feuille de surcharges à la manière de
  `design-modern.css` — rejetée : elle ferait un troisième design à entretenir, ce que
  l'utilisateur a écarté.

## 2. Nom des jetons d'accent

- **Decision**: renommer `--gold` / `--gold-bright` / `--gold-soft` en `--accent` /
  `--accent-bright` / `--accent-soft`, et introduire `--kamas` (or), `--link` (turquoise) et leurs
  variantes douces. `--warning` devient l'ambre, `--danger` le corail.
- **Rationale**: avec un vrai or pour les kamas, garder « gold » pour désigner le vert serait une
  source d'erreurs. `DESIGN.md` signalait déjà ce nom comme historique. Le renommage est mécanique
  (rechercher-remplacer sur les feuilles de style).
- **Alternatives considered**: garder les noms — rejeté pour la confusion ; renommer aussi
  `--success` — inutile, le vert de gain reste un rôle à part entière.

## 3. Rôle « lien » distinct de l'accent

- **Decision**: les liens textuels et les boutons-liens (`.btn-link`, « Voir la recette »,
  « Réinitialiser les filtres », « Afficher N de plus ») passent au jeton `--link`. Les états
  sélectionnés, le bouton plein et le focus restent sur l'accent.
- **Rationale**: c'est la règle « une couleur par rôle » de la maquette (FR-003).
- **Alternatives considered**: tout laisser sur l'accent — rejeté, c'est ce qui rendait la page
  monochrome.

## 4. Polices

- **Decision**: `@fontsource-variable/lexend` (texte) et `@fontsource/rowdies` (titres, graisse
  400), importées depuis les feuilles de style ; retrait de `@fontsource-variable/inter`.
- **Rationale**: même mécanisme que la police actuelle ; fichiers servis par le site, donc aucune
  requête vers un tiers (principe V) et pas de dépendance à un service externe au chargement.
- **Alternatives considered**: feuille Google Fonts dans `index.html` — rejetée (requête tierce,
  blocage possible) ; polices système — rejetées, la maquette validée repose sur ces deux polices.

## 5. Barre de navigation en haut

- **Decision**: au-dessus de 960 px, `.app-shell` passe en colonne et `.app-nav` devient une barre
  `position: sticky` en haut, centrée dans la largeur du contenu, avec trois groupes : marque,
  rubriques, puis serveur / paramètres / thème. Le balisage de `AppShell` est réordonné une fois
  (le sélecteur de serveur rejoint le groupe de droite). Sous 960 px, les règles actuelles de la
  navigation du bas sont conservées.
- **Rationale**: le seuil de 960 px est celui que le site utilise déjà ; `sticky` garde la barre
  accessible (FR-015) sans réserver de hauteur fixe ni décaler les ancres.
- **Alternatives considered**: `position: fixed` — rejeté, il impose une marge haute à maintenir et
  gêne le retour à la ligne de la barre aux largeurs intermédiaires ; deux composants de navigation
  distincts — rejeté, un seul balisage suffit et évite de dupliquer la règle Forgemagie.

## 6. Translucidité

- **Decision**: la barre du haut utilise un fond semi-transparent avec `backdrop-filter: blur()` ;
  les panneaux sont légèrement translucides sans flou. Dans une règle
  `@supports not (backdrop-filter: blur(1px))`, la barre reprend un fond opaque. Menus, dialogues et
  bulles gardent `--panel-strong`, opaque.
- **Rationale**: le flou n'a de sens que là où du contenu défile dessous ; l'appliquer à chaque
  panneau coûterait en rendu sans rien apporter. Le repli garantit la lisibilité (cas limite de la
  spec).
- **Alternatives considered**: flou sur tous les panneaux — rejeté (coût, lisibilité des chiffres).

## 7. Fond de page

- **Decision**: le dégradé et les halos sont portés par un jeton `--bg-glow` appliqué au fond de la
  coque avec `background-attachment: fixed`, pour que la lumière reste dans la fenêtre quelle que
  soit la longueur de la page. Sur les appareils tactiles, où ce mode est mal pris en charge, le
  fond défile avec la page.
- **Rationale**: la maquette place les halos en haut d'une page longue ; fixés à la fenêtre, ils
  profitent à toutes les pages.
- **Alternatives considered**: pseudo-élément fixe plein écran — équivalent, gardé comme solution
  de repli si le mode `fixed` pose un problème de défilement.

## 8. Thème clair

- **Decision**: fond clair teinté de bleu-vert (`#eaf3f1`), panneaux blancs légèrement translucides,
  texte bleu-vert très sombre, et les mêmes rôles dans des nuances foncées : vert d'action sur
  lequel le texte est blanc, or foncé, turquoise foncé, ambre foncé, corail foncé. Les halos sont
  conservés, très atténués.
- **Rationale**: demande explicite de l'utilisateur (« adapte-le ») ; mêmes rôles, mêmes formes,
  contrastes vérifiés par le test automatique.
- **Alternatives considered**: laisser le thème clair actuel — rejeté par l'utilisateur ; fond
  crème — rejeté, il casserait la parenté avec le thème sombre.

## 9. Couleurs des caractéristiques

- **Decision** (révisée le 2026-10-13) : les effets gardent l'icône de caractéristique déjà
  utilisée par l'application (`CharacteristicIcon`). Les jetons `--stat-*` et la table
  `stat-tones.ts` ont été retirés.
- **Rationale**: FR-025 ; l'utilisateur a préféré les icônes existantes aux losanges colorés.
- **Alternatives considered**: un losange coloré par élément — essayé, puis rejeté par
  l'utilisateur.

## 10. Nombre de résultats

- **Decision**: `RESULTS_PAGE_SIZE` passe à 6 pour l'affichage initial ; une seconde constante fixe
  le pas à 12 pour « Afficher 12 de plus ». Le paramètre `limit` de l'adresse garde son sens.
- **Rationale**: FR-020 et l'hypothèse notée dans la spec.
- **Alternatives considered**: pas de 6 — possible, mais la maquette validée écrit « 12 de plus ».

## 11. Préférences devenues sans objet

- **Decision**: supprimer les modules de design et d'accent ; un petit module efface au démarrage
  les deux clés de `localStorage` correspondantes, sans erreur si le stockage est indisponible.
  L'attribut `data-theme` reste ; `data-design` et `data-accent` ne sont plus posés.
- **Rationale**: FR-026, FR-027 ; ne pas laisser de données inutiles sur l'appareil (principe V).
- **Alternatives considered**: laisser les clés en place — sans danger mais sans raison.

## 12. Vérification des contrastes

- **Decision**: un test unitaire lit `theme.css`, résout les jetons des deux thèmes et vérifie les
  couples texte/fond et icône/fond listés dans le contrat (4,5:1 et 3:1). Les jetons translucides
  sont composés sur le fond de page avant le calcul.
- **Rationale**: SC-003 devient vérifiable à chaque modification de la palette, y compris pour le
  thème clair qui n'a pas de maquette.
- **Alternatives considered**: contrôle visuel seul — insuffisant pour une palette entière.

## 13. Feuille `design-modern.css`

- **Decision**: la supprimer. Les quelques règles dont le nouveau style a besoin (apparition douce
  des panneaux, arrondis) sont reprises dans `global.css` sans préfixe ; le reste disparaît.
- **Rationale**: FR-026 ; un seul style.
- **Alternatives considered**: la garder en la vidant de son préfixe — rejeté, elle redéfinit des
  jetons que `theme.css` définit désormais lui-même.
