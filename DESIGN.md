# DESIGN.md — règles visuelles de Dofus Craft

Ce document décrit le design tel qu'il est codé. Toute nouvelle page ou tout nouveau composant le
suit ; si une règle doit changer, on la change ici et dans `src/styles/theme.css` en même temps.

Les valeurs vivent dans `src/styles/theme.css` (jetons), les composants dans `src/styles/global.css`
et `src/styles/comparison.css`. Le site a un seul style (specs/051-site-visual-refresh), décliné en
thème sombre et en thème clair.

## 1. Principes

- **Un outil, pas une vitrine** : dense, lisible. Le contenu utile (prix, verdict) passe avant tout
  le reste ; la couleur sert à le faire ressortir, pas à décorer.
- **Une seule action principale par écran** : un seul bouton plein (`.btn-primary`) visible à la fois.
- **Une couleur par rôle** : la même couleur veut dire la même chose sur toutes les pages (section 2).
- **Jamais de valeur écrite en dur** : couleur, espacement, rayon, ombre et durée viennent d'un jeton.
  Seule exception : la durée d'une boucle de chargement (`spin`, `skeleton-shimmer`).
- **Deux thèmes** : tout doit rester lisible en sombre et en clair (`data-theme` sur `<html>`).
- **Pas de visuel d'Ankama** dans l'habillage : le motif du site est le losange, dessiné en CSS. Les
  images d'objets et de ressources viennent du catalogue.

## 2. Couleurs

### Rôles

| Rôle | Jeton | Où |
| --- | --- | --- |
| Action principale, sélection, choix gagnant | `--accent` (vert) | bouton plein, résultat choisi, rubrique active, option active, verdict, barre du montant le plus bas |
| Kamas mis en avant | `--kamas` (or) | économie du verdict, mention « acheté » |
| Lien, action secondaire | `--link` (turquoise) | liens, boutons-liens, icône de recherche, pastilles de filtre, mention « crafté », barres de répartition |
| Prix vieillissant, avertissement | `--warning` (ambre) | date d'un prix ancien, bandeau d'avertissement |
| Prix périmé, erreur, destructif | `--danger` (corail) | date d'un prix périmé, messages d'erreur, boutons de suppression |

### Valeurs

| Rôle | Jeton | Sombre | Clair |
| --- | --- | --- | --- |
| Fond de page | `--bg` | `#08181c` | `#eaf3f1` |
| Lumière derrière la page | `--bg-glow` | halos turquoise et vert | les mêmes, atténués |
| Carte (translucide) | `--panel` | `rgba(18,52,58,.78)` | `rgba(255,255,255,.86)` |
| Carte opaque (menus, bulles) | `--panel-strong` | `#11333a` | `#ffffff` |
| Surface secondaire | `--panel-soft` | `#16424a` | `#dcebe8` |
| Barre de navigation | `--nav-bg` | `rgba(8,28,32,.72)` | `rgba(255,255,255,.78)` |
| Texte | `--text` | `#f6eed6` | `#0f2d33` |
| Texte secondaire | `--text-muted` | `#c5d8d4` | `#3d5a5f` |
| Texte discret (dates, notes) | `--text-faint` | `#93b0ac` | `#4a6665` |
| Accent | `--accent` | `#a5d43a` | `#3f7d0c` |
| Accent vif (texte, focus) | `--accent-bright` | `#b6e24a` | `#2f6406` |
| Dégradé du bouton plein | `--accent-gradient` | `#b1dc35` → `#84b41c` | `#3f7d0c` → `#33690a` |
| Texte posé sur l'accent | `--on-accent` | `#10200a` | `#ffffff` |
| Kamas | `--kamas` | `#ffc94d` | `#8a5a00` |
| Lien | `--link` | `#5fd9cb` | `#0b6f68` |
| Avertissement | `--warning` | `#ffb84d` | `#8a5300` |
| Erreur / destructif | `--danger` | `#ff8a75` | `#b3391f` |
| Séparateur | `--border` | `rgba(120,220,205,.18)` | `rgba(13,60,66,.14)` |
| Contour d'un champ | `--border-control` | `#5f8f8b` | `#6f8f8c` |
| Fond d'un champ | `--input-bg` | `rgba(3,14,17,.55)` | `rgba(13,60,66,.06)` |
| Voile derrière un dialogue | `--scrim` | `rgba(3,12,14,.66)` | `rgba(9,30,34,.5)` |
| Texte posé sur une image | `--on-image` | `#ffffff` | identique |

Règles :

- Les teintes dérivées se calculent avec `color-mix()` à partir d'un jeton (`--accent-soft`,
  `--link-soft`, `--kamas-soft`, `--border-strong`…), jamais avec un `rgba()` recopié.
- `--success` vaut l'accent : un gain et un choix gagnant ont la même couleur.
- Les effets d'un objet gardent l'icône de caractéristique du jeu (`CharacteristicIcon`), pas un
  losange ; le nom de la caractéristique reste toujours écrit.
- Un texte posé sur une image utilise `--on-image`, avec le voile `--image-veil` ou l'ombre
  `--on-image-shadow` pour rester lisible. Ces trois jetons ne changent pas avec le thème.
- Sur écran large (à partir de 1340 px), les marges de part et d'autre du contenu portent chacune une moitié de l'illustration « Songe infini » d'Ankama (`public/backgrounds/`), à 40 % d'opacité (22 % en thème clair). Elles ne passent jamais sous le contenu ; leur fondu et leurs couleurs adoucies sont enregistrés dans les fichiers par `scripts/build-side-illustrations.mjs`.
- Les cases d'équipement des filtres de catégorie sont neutres (`--slot-bg`, `--slot-border`, `--slot-glyph`) ; seule celle de la catégorie choisie prend la couleur d'accent.
- Les surfaces translucides (`--panel`, `--nav-bg`) laissent passer la lumière du fond ; un menu, un
  dialogue ou une bulle, qui passent au-dessus du contenu, sont opaques (`--panel-strong`).
- Contraste minimal : 4,5:1 pour tout texte, 3:1 pour le contour d'un champ, une icône seule et un
  losange. `tests/unit/theme-contrast.test.ts` le vérifie dans les deux thèmes à partir de
  `theme.css` : un jeton modifié est contrôlé sans toucher au test.
- Une couleur ne porte jamais seule une information : un prix ancien a aussi son libellé, un gain a
  son signe, une erreur son message.

## 3. Typographie

Deux polices embarquées : **Rowdies** (`--font-display`, une seule graisse, 400) pour les titres, en
capitales ; **Lexend** (`--font-body`, variable) pour tout le reste. Corps à `1rem` (16 px),
interligne `1.5`.

| Usage | Règle |
| --- | --- |
| Titre de page (`h1`) | Rowdies, capitales, `clamp(1.6rem, 3.4vw, 2rem)`, espacement `.01em` |
| Titre de section (`h2`) | Rowdies, capitales, `1.25rem`, espacement `.02em` ; aligné à gauche dans une carte, centré sur la fiche d'un objet |
| Sous-titre (`h3`) | Rowdies, capitales, `1.05rem` |
| Rubrique d'une carte (`.card h3`) | `.82rem`, capitales, `--text-muted` |
| Titre du verdict | Rowdies, capitales, `1.6rem`, `--accent-bright` quand le verdict est tranché |
| Corps | Lexend, `1rem`, 400 ; phrase d'en-tête de page à `1.02rem`, interligne `1.6` |
| Texte secondaire, libellé de champ | `.85rem` à `.9rem` (libellé de champ : `.88rem`, 700) |
| Note, date, légende | `.8rem`, 400 |
| Sur-titre (`.eyebrow`) | `.76rem`, capitales, espacement `.12em`, 700 |

- Une page a un seul `h1`, puis des `h2`, puis des `h3` : on ne saute pas de niveau.
- Les montants en kamas, les champs de saisie et les prix affichés utilisent des chiffres tabulaires
  (`font-variant-numeric: tabular-nums`).
- Aucun texte sous `.72rem` (11,5 px). Seule exception : le libellé de la barre de navigation basse,
  qui descend jusqu'à `.62rem` sur un écran étroit pour ne pas être coupé.

## 4. Espacement

Base de 4 px. Seuls ces pas sont utilisés :

| Jeton | Valeur | Usage type |
| --- | --- | --- |
| `--space-1` | 4 px | entre une icône et son texte |
| `--space-2` | 8 px | entre deux éléments d'une même ligne |
| `--space-3` | 12 px | marge intérieure d'un bouton, d'une ligne de liste |
| `--space-4` | 16 px | entre deux blocs d'une carte, gouttière mobile |
| `--space-5` | 24 px | entre la barre de navigation et le contenu |
| `--space-6` | 32 px | entre deux cartes, marge intérieure d'une carte |
| `--space-7` | 48 px | respiration d'un état vide |

## 5. Rayons, ombres, mouvement

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `--radius-xs` | 6 px | pastilles, petits boutons, mentions « acheté » / « crafté » |
| `--radius-sm` | 8 px | images d'objet, petits blocs, rubriques de la navigation |
| `--radius-md` | 10 px | boutons, champs, lignes, barre de navigation |
| `--radius-lg` | 14 px | cartes, dialogues |
| `--radius-pill` | 999 px | badges, avatars, pastilles de filtre |

- Ombres : `--shadow-sm` (élément posé), `--shadow-md` (menu, bulle, survol d'une carte),
  `--shadow` (dialogue). Trois niveaux, pas d'ombre écrite à la main. Une lueur de la couleur
  d'accent accompagne le bouton plein, l'élément sélectionné et le losange du verdict.
- Mouvement : `--transition-fast` (180 ms) pour les survols ; `--transition-enter` (160 ms) pour
  l'apparition d'un panneau, d'un onglet ou d'un bloc déplié (`rise-in`, `fade-in`) et pour une
  valeur qui glisse (jauge, chevron). Les cartes entrent en 280 ms et la bulle des compteurs en
  200 ms (`modern-rise`). Rien ne bouge sans raison, et tout s'arrête sous
  `prefers-reduced-motion` (côté CSS, et `prefersReducedMotion()` côté script).
- Animations ponctuelles : le verdict entre à chaque changement (losange qui rebondit, barres qui
  se remplissent, économie qui compte — `useCountUp`), un champ de prix s'éclaire à
  l'enregistrement (`playOnce`), une carte des Suivis s'efface avant de partir (`leaveThen`), les
  listes arrivent en cascade, le losange du menu glisse d'une page à l'autre, le thème change en
  fondu. Le halo du logo (Dofus Émeraude) est la seule animation continue.
- Sur ordinateur (≥ 1024 px) toute l'interface est rendue à 90 % (`--ui-zoom`).

## 6. Composants

### Navigation

- **961 px et plus** : une barre flottante en haut (`.app-nav`), arrondie, de la largeur du contenu,
  qui reste en haut pendant le défilement. De gauche à droite : la marque, les rubriques, puis à
  droite le serveur actif, Paramètres et la bascule de thème. Fond `--nav-bg` avec un flou
  (`backdrop-filter`), opaque là où le flou n'existe pas. La rubrique active a un fond
  `--accent-soft` et un losange `--accent` à cheval sur le bord bas de la barre. Quand tout ne tient
  pas sur une ligne, la barre passe sur deux lignes sans rien masquer.
- **960 px et moins** : la barre basse à onglets, avec le serveur actif épinglé en haut de l'écran.
  Jamais de `backdrop-filter` sur `.app-nav` à ces largeurs : il deviendrait le bloc de référence
  du sélecteur de serveur, qui est fixé à la fenêtre.

### Boutons

| Classe | Rôle | Quand |
| --- | --- | --- |
| `.btn .btn-primary` | plein, `--accent-gradient`, texte `--on-accent` | l'action principale de l'écran, une seule |
| `.btn .btn-secondary` | contour | toutes les autres actions |
| `.btn .btn-danger` | contour et texte `--danger` | supprimer, archiver |
| `.icon-button` | icône seule, toujours avec `aria-label` | actions répétées dans une ligne |
| `.btn-small` | variante compacte | à l'intérieur d'une carte ou d'un tableau |
| bouton-lien (`.reset-filters`, `.results-collapse`…) | texte `--link`, sans contour, zone de 44 px | action secondaire dans une phrase ou une ligne |

Un lien qui mène à une autre page et sert d'action principale d'un état vide prend aussi
`.btn .btn-primary`.

Un bouton fait 44 px de haut (36 px en `.btn-small`, 40 px pour `.icon-button`, 32 px pour
`.icon-button--sm`), avec le rayon `--radius-md`, et se soulève de 1 px au survol.

### Champs

- Hauteur : `--control-lg` (56 px) pour la grande recherche de la page Recherche et le bouton
  Filtres à sa droite uniquement, `--control-md` (44 px) partout ailleurs, `--control-sm` (36 px)
  dans un tableau.
- Contour `--border-control`, fond `--input-bg`, rayon `--radius-md`. Au focus : contour `--accent`
  et halo de 4 px `--accent-soft`.
- Chaque champ a un libellé visible ou un `aria-label` ; le texte d'exemple ne remplace jamais le libellé.
- Un champ de prix valide avec Entrée et reprend sa valeur d'origine avec Échap.

### Cartes et pages

- Une page = un `<header class="page-header">` (`h1` + une phrase), puis des `.panel`.
- `.panel` : fond `--panel`, contour `--border`, rayon `--radius-lg`, ombre `--shadow-sm`, marge
  intérieure `--space-6`. Sous 720 px : marge `--space-4` et rayon `--radius-md`.
- Les grilles utilisent `minmax(0, 1fr)` pour ne jamais déborder sur mobile.

### Page Recherche

De haut en bas :

- En-tête : titre et phrase à gauche, bouton d'aide rond à droite (`.page-header--with-action`).
- Recherche posée sur la page, sans panneau (`.search-panel`, une grille à qui `.search` et
  `.results-block` prêtent leurs enfants) : le champ et le bouton Filtres ; puis une ligne partagée
  entre les filtres appliqués à gauche (pastilles `.filter-chip` qui se retirent d'un clic) et, à
  droite, « N objets trouvés », « 6 sur N », « Afficher 12 de plus » et « Réduire » ; puis les
  résultats, 6 par ligne sur grand écran. Les filtres restent repliés.
- Un seul panneau pour l'objet choisi et son verdict (`.item-verdict-panel`) : image, nom, pastilles
  catégorie et niveau, boutons Historique et Suivre à droite ; dessous, le verdict.
- Une rangée (`.detail-row`) : « Prix des ressources » prend la place, « Effets » est à côté, et
  passe dessous quand la largeur manque.

Détails :

- 6 résultats d'abord, puis « Afficher 12 de plus » ; « Réduire » revient à 6.
- Verdict tranché (fabriquer ou acheter) : bloc teinté d'accent, coche dans un losange, titre en
  Rowdies, économie en `--kamas`, la barre du montant le plus bas en accent et l'autre neutre. Un
  verdict incomplet ou à égalité reste sobre.
- Verdict : à gauche le losange, le choix en grand et l'économie dessous ; à droite les deux
  montants, chacun sur une ligne « libellé, barre, montant » (le champ du prix HDV tient la place du
  montant). Sous 720 px, le montant repasse au-dessus de sa barre.
- Lignes de ressources compactes (au-dessus de 720 px) : image, nom et quantité avec l'ancienneté
  du prix dessous, prix unitaire, sous-total avec sa barre de répartition juste dessous. Une
  ressource craftable ajoute une seule ligne : choix, mention, montants, « Voir la recette ».
- Prix des ressources : colonnes Ressource / Prix unitaire / Sous-total nommées une fois au-dessus
  des lignes (`.prices-columns`, masquées sous 720 px) ; sous chaque ligne, une barre `--link` dit ce
  qu'elle pèse dans le coût de craft (`.share-bar`, décorative : les montants sont écrits) ; en
  pied, « Total du craft » en `--kamas`.

### Champs de prix

Les champs en kamas (`.kamas-input-wrap` : prix unitaire d'une ressource, prix HDV) se modifient
directement, sans état verrouillé ni bouton « Modifier » (specs/052-direct-price-entry). Le montant
est aligné à droite et s'arrête avant le symbole kamas ; le focus sélectionne tout le montant ; la
sortie du champ (Entrée, clic ailleurs, Tab) enregistre, Échap annule. La logique commune est dans
`src/features/comparison/usePriceEntry.ts`.

### Badges

`.badge` : pastille en forme de pilule (`--radius-pill`), texte à `.92rem` et graisse 750.

| Classe | Fond | Texte | Quand |
| --- | --- | --- | --- |
| `.badge-success` | `--panel-soft` | `--success` | verdict favorable |
| `.badge-warning` | `--warning-soft` | `--warning` | point à vérifier |
| `.badge-neutral` | `--panel-soft` | `--text-muted` | information sans jugement |

Le libellé porte l'information ; la couleur ne fait que la renforcer.

### Onglets

`role="tablist"` + `role="tab"` + un `role="tabpanel"` portant `.tab-panel`. Un seul onglet est dans
l'ordre de tabulation ; les flèches, Début et Fin passent de l'un à l'autre
(`src/components/tab-keys.ts`).

### Dialogues et bulles

- Confirmation bloquante : l'élément `<dialog>` (`.outlier-confirm-dialog`), « Annuler » à gauche,
  l'action à droite.
- Bulle non bloquante (historique des prix, compteur) : `role="dialog"`, le focus y entre à
  l'ouverture et revient au bouton à la fermeture ; Échap et un clic à l'extérieur la ferment.

## 7. États — chaque écran les prévoit tous

| État | Règle |
| --- | --- |
| Chargement | squelette ou `<p class="empty" role="status">…</p>` ; jamais un écran vide ni « Aucun résultat » avant la fin du chargement |
| Vide | `EmptyState` : icône, titre, une phrase qui dit quoi faire, et un bouton quand une action existe |
| Erreur | dit ce qui n'a pas marché, sans jargon, et propose **« Réessayer »** ; `role="alert"` |
| Erreur de saisie | message sous le champ, `aria-invalid` et `aria-describedby` sur le champ |
| Désactivé | opacité `.55`, curseur `not-allowed`, pas d'effet de survol |
| En cours | le bouton est désactivé et son libellé change (« Enregistrement… ») |
| Survol / appui | tout élément cliquable a un survol et un état `:active` |
| Focus | contour de 2 px `--accent-bright`, décalé de 2 px, sur tout élément atteignable au clavier ; un champ prend à la place un contour `--accent` et un halo de 4 px `--accent-soft` |
| Destructif | une confirmation avant, ou un « Annuler » juste après |

## 8. Mobile

- Largeur minimale prise en charge : 320 px, sans défilement horizontal de la page. Un tableau large
  défile dans son propre conteneur (`.fm-table-scroll`).
- Cible tactile : 44 × 44 px au moins (règle appliquée sous `(pointer: coarse), (max-width: 960px)`).
- Sous 960 px, la navigation passe en barre basse ; le contenu garde une marge pour ne pas passer dessous.
- Les hauteurs plein écran utilisent `dvh`. La même règle en `vh` est écrite juste avant, pour les
  navigateurs qui ne connaissent pas `dvh`.
- Taille de police des champs : 16 px au moins, pour éviter le zoom automatique d'iOS.
- La lumière du fond est fixée à la fenêtre ; sur un appareil tactile, elle défile avec la page.

## 9. Ton et libellés

- Français, vouvoiement, phrases courtes. Exception assumée : la page Forgemagie tutoie, comme le
  bot Discord qu'elle prolonge — et elle tutoie partout.
- Un bouton dit ce qu'il fait : « Réessayer », « Supprimer la liste », pas « OK ».
- Points de suspension : le caractère « … » pour une action en cours.
- Guillemets français « » dans les textes visibles.
- Les termes du jeu gardent leur forme en jeu : HDV, kamas, FM, familier.

## 10. Accessibilité

- Lien « Aller au contenu » en premier élément de la page ; à chaque changement de page, le titre de
  l'onglet change et le focus va sur `<main>`.
- Tout ce qui se fait à la souris se fait au clavier (le glisser-déposer des Suivis a une liste
  déroulante équivalente).
- Les messages qui apparaissent sans action directe portent `role="status"` (information) ou
  `role="alert"` (erreur).
- Un texte réservé aux lecteurs d'écran utilise `.visually-hidden`.
