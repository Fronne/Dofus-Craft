# DESIGN.md — règles visuelles de Dofus Craft

Ce document décrit le design tel qu'il est codé. Toute nouvelle page ou tout nouveau composant le
suit ; si une règle doit changer, on la change ici et dans `src/styles/theme.css` en même temps.

Les valeurs vivent dans `src/styles/theme.css` (jetons), les composants dans `src/styles/global.css`
et `src/styles/comparison.css`. `src/styles/design-modern.css` ne contient que les retouches du
design « Moderne », toutes préfixées par `:root[data-design="modern"]`.

## 1. Principes

- **Un outil, pas une vitrine** : dense, lisible, sans décor. Le contenu utile (prix, verdict) passe
  avant tout le reste.
- **Une seule action principale par écran** : un seul bouton plein (`.btn-primary`) visible à la fois.
- **Jamais de valeur écrite en dur** : couleur, espacement, rayon, ombre et durée viennent d'un jeton.
  Seule exception : la durée d'une boucle de chargement (`spin`, `skeleton-shimmer`).
- **Deux thèmes, cinq accents, deux designs** : tout doit rester lisible dans chaque combinaison
  (`data-theme`, `data-accent`, `data-design` sur `<html>`).

## 2. Couleurs

| Rôle | Jeton | Sombre | Clair |
| --- | --- | --- | --- |
| Fond de page | `--bg` | `#0b1018` | `#eef1f5` |
| Carte | `--panel` | `rgba(19,29,44,.88)` | `rgba(255,255,255,.92)` |
| Carte opaque (menus, bulles) | `--panel-strong` | `#172236` | `#ffffff` |
| Surface secondaire | `--panel-soft` | `#202d42` | `#e5eaf1` |
| Texte | `--text` | `#edf2f7` | `#253246` |
| Texte secondaire | `--text-muted` | `#93a4ba` | `#566477` |
| Texte discret (dates, notes) | `--text-faint` | `#8a9ab0` | `#5f6d80` |
| Accent | `--gold` | `#5b9dee` | `#2f6fd1` |
| Accent vif (liens, focus) | `--gold-bright` | `#7db4f5` | `#1f57ad` |
| Texte posé sur l'accent | `--on-accent` | `#0b1018` | `#ffffff` |
| Séparateur | `--border` | `rgba(148,171,201,.18)` | `rgba(45,67,94,.16)` |
| Contour d'un champ | `--border-control` | `#6b7c93` | `#8794a6` |
| Succès / gain | `--success` | `#4fbf74` | `#1f7038` |
| Avertissement | `--warning` | `#e2b04f` | `#85600a` |
| Erreur / destructif | `--danger` | `#f38b8b` | `#b94b4b` |
| Voile derrière un dialogue | `--scrim` | `rgba(9,13,20,.6)` | identique |
| Texte posé sur une image | `--on-image` | `#ffffff` | identique |

Le design « Moderne » remplace cinq de ces valeurs ; toutes les autres sont communes aux deux designs.

| Jeton | Moderne sombre | Moderne clair |
| --- | --- | --- |
| `--bg` | `#0a0f17` | `#f3f5f9` |
| `--panel-strong` | `#141d2c` | `#ffffff` |
| `--panel-soft` | `#1c2739` | `#eef1f6` |
| `--border` | `rgba(148,171,201,.11)` | `rgba(45,67,94,.09)` |
| `--input-bg` | `rgba(5,9,16,.45)` | `#f5f7fb` |

Règles :

- `--gold` et `--gold-bright` suivent l'accent choisi par le joueur (bleu, rouge, vert, violet,
  orange). Leur nom est historique : ce sont **l'accent**, pas une couleur dorée.
- Les teintes dérivées se calculent avec `color-mix()` à partir d'un jeton (`--gold-soft`,
  `--border-strong`, `--success-soft`…), jamais avec un `rgba()` recopié.
- Un texte posé sur une image (bannière d'accueil, coche d'une pastille de couleur) utilise
  `--on-image`, avec le voile `--image-veil` ou l'ombre `--on-image-shadow` pour rester lisible. Ces
  trois jetons ne changent pas avec le thème, parce que l'image ne change pas.
- Les cases d'équipement gardent les couleurs du jeu (`--slot-bg`, `--slot-border`, `--slot-glyph`) :
  elles ne suivent ni l'accent ni le design.
- Contraste minimal : 4,5:1 pour tout texte, 3:1 pour le contour d'un champ et pour une icône seule.
  `--text-faint` est la teinte la plus claire autorisée pour du texte.
- Une couleur ne porte jamais seule une information : un prix ancien a aussi son libellé, un gain a
  son signe, une erreur son message.

## 3. Typographie

Police : Inter, puis la police système. Seul le design « Moderne » utilise la police embarquée
« Inter Variable » (`@fontsource-variable/inter`) ; en « Classique », Inter s'affiche si elle est
installée sur l'appareil, sinon c'est la police système. Corps à `1rem` (16 px), interligne `1.5`.

| Usage | Classique | Moderne |
| --- | --- | --- |
| Titre de page (`h1`) | `clamp(1.75rem, 4vw, 2.5rem)`, 700, espacement `-.03em` | `clamp(2rem, 4vw, 2.75rem)`, 760, espacement `-.035em` |
| Titre de section (`h2`) | `1.15rem`, 700 | identique, espacement `-.02em` |
| Titre d'une carte (`.card h2`) | `1.3rem`, centré | `1.2rem`, aligné à gauche (centré sur la fiche d'un objet) |
| Sous-titre (`h3`) | `1rem`, 700 | identique |
| Rubrique d'une carte (`.card h3`) | `.82rem`, capitales, 800, `--text-muted` | identique |
| Corps | `1rem`, 400 | identique ; phrase d'en-tête de page à `1.02rem`, interligne `1.6` |
| Texte secondaire, libellé de champ | `.85rem` à `.9rem` (libellé de champ : `.88rem`, 700) | identique |
| Note, date, légende | `.8rem`, 400 | identique |
| Sur-titre (`.eyebrow`) | `.76rem`, capitales, espacement `.16em`, 800 | `.76rem`, capitales, espacement `.12em`, 700 |

- Une page a un seul `h1`, puis des `h2`, puis des `h3` : on ne saute pas de niveau.
- Les montants en kamas utilisent des chiffres tabulaires (`font-variant-numeric: tabular-nums`) dès
  qu'ils sont alignés en colonne. Le design « Moderne » l'applique aussi aux champs de saisie et aux prix affichés.
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
| `--space-5` | 24 px | marge intérieure d'une carte (Classique) |
| `--space-6` | 32 px | entre deux cartes, marge intérieure d'une carte (Moderne) |
| `--space-7` | 48 px | respiration d'un état vide |

## 5. Rayons, ombres, mouvement

| Jeton | Classique | Moderne | Usage |
| --- | --- | --- | --- |
| `--radius-xs` | 6 px | 6 px | pastilles, petits boutons |
| `--radius-sm` | 8 px | 10 px | images d'objet, petits blocs |
| `--radius-md` | 12 px | 16 px | boutons, champs, lignes, bulles |
| `--radius-lg` | 16 px | 22 px | cartes, dialogues |
| `--radius-pill` | 999 px | 999 px | badges, avatars |

- Ombres : `--shadow-sm` (élément posé), `--shadow-md` (menu, bulle, survol d'une carte),
  `--shadow` (dialogue). Trois niveaux, pas d'ombre écrite à la main. Le design « Moderne » redéfinit
  ces trois jetons en ombres plus larges et plus douces ; il ajoute une lueur de la couleur d'accent
  sous le bouton principal et sous l'élément sélectionné.
- Mouvement : `--transition-fast` pour les survols (120 ms en Classique, 180 ms en Moderne) ;
  `--transition-enter` (160 ms) pour l'apparition d'un panneau, d'un onglet ou d'un bloc déplié
  (`rise-in`, `fade-in`) et pour une valeur qui glisse (jauge, chevron). En « Moderne », les cartes
  entrent en 280 ms et la bulle des compteurs en 200 ms (`modern-rise`). Rien ne bouge sans raison,
  et tout s'arrête sous `prefers-reduced-motion` (côté CSS, et `prefersReducedMotion()` côté script).

## 6. Composants

### Boutons

| Classe | Rôle | Quand |
| --- | --- | --- |
| `.btn .btn-primary` | plein, couleur d'accent, texte `--on-accent` | l'action principale de l'écran, une seule |
| `.btn .btn-secondary` | contour | toutes les autres actions |
| `.btn .btn-danger` | contour et texte `--danger` | supprimer, archiver |
| `.icon-button` | icône seule, toujours avec `aria-label` | actions répétées dans une ligne |
| `.btn-small` | variante compacte | à l'intérieur d'une carte ou d'un tableau |

Un lien qui mène à une autre page et sert d'action principale d'un état vide prend aussi
`.btn .btn-primary`.

Un bouton fait 44 px de haut (36 px en `.btn-small`, 40 px pour `.icon-button`, 32 px pour
`.icon-button--sm`), avec le rayon
`--radius-md`. En « Moderne », le bouton principal porte un dégradé de `--gold-bright` vers `--gold`
et tout bouton se soulève de 1 px au survol.

### Champs

- Hauteur : `--control-lg` (56 px) pour la grande recherche de la page Recherche uniquement,
  `--control-md` (44 px) partout ailleurs, `--control-sm` (36 px) dans un tableau.
- Contour `--border-control`, fond `--input-bg`, rayon `--radius-md`.
- Chaque champ a un libellé visible ou un `aria-label` ; le texte d'exemple ne remplace jamais le libellé.
- Un champ de prix valide avec Entrée et reprend sa valeur d'origine avec Échap.

### Cartes et pages

- Une page = un `<header class="page-header">` (`h1` + une phrase), puis des `.panel`.
- `.panel` : fond `--panel-gradient` (égal à `--panel` en Classique ; en Moderne, `--panel-strong`, avec un
  léger reflet clair en haut en thème sombre),
  contour `--border`, rayon `--radius-lg`, ombre `--shadow-sm`, marge intérieure `--space-5`
  (`--space-6` en Moderne). Sous 720 px : marge `--space-4` et rayon `--radius-md` dans les deux designs.
- Les grilles utilisent `minmax(0, 1fr)` pour ne jamais déborder sur mobile.

### Badges

`.badge` : pastille en forme de pilule (`--radius-pill`), texte à `.92rem` et graisse 750. En
« Moderne », le badge du verdict de prix est un peu plus petit (`.88rem`).

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
| Focus | contour de 2 px `--gold-bright`, décalé de 2 px, sur tout élément atteignable au clavier ; en « Moderne », un champ prend à la place un contour `--gold` et un halo de 4 px `--gold-soft` |
| Destructif | une confirmation avant, ou un « Annuler » juste après |

## 8. Mobile

- Largeur minimale prise en charge : 320 px, sans défilement horizontal de la page. Un tableau large
  défile dans son propre conteneur (`.fm-table-scroll`).
- Cible tactile : 44 × 44 px au moins (règle appliquée sous `(pointer: coarse), (max-width: 960px)`).
- Sous 960 px, la navigation passe en barre basse ; le contenu garde une marge pour ne pas passer dessous.
- Les hauteurs plein écran utilisent `dvh`. La même règle en `vh` est écrite juste avant, pour les
  navigateurs qui ne connaissent pas `dvh`.
- Taille de police des champs : 16 px au moins, pour éviter le zoom automatique d'iOS.

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
