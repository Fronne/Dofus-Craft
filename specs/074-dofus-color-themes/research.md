# Research: Thèmes de couleurs des Dofus primordiaux

Aucune zone « NEEDS CLARIFICATION » dans la spec. Les décisions ci-dessous fixent la méthode.

## 1. Mécanisme de thème

- **Decision**: attribut `data-dofus="<id>"` sur `<html>`, absent pour l'émeraude. Les palettes sont
  des blocs `:root[data-dofus="x"]` (sombre) et `:root[data-dofus="x"][data-theme="light"]` (clair)
  dans `theme.css`.
- **Rationale**: le site pilote déjà clair/sombre par `data-theme` et des jetons CSS ; `global.css`
  ne contient aucune couleur de l'émeraude en dur (vérifié : les teintes vertes n'apparaissent que
  dans `theme.css`). Le changement est donc immédiat, sans rechargement, et l'émeraude reste
  byte-for-byte le thème actuel.
- **Alternatives**: classes générées en JS (rejeté : valeurs de couleur hors CSS, contraire à
  DESIGN.md) ; une feuille de style par Dofus chargée à la demande (rejeté : flash et complexité).

## 2. Jetons redéfinis par un Dofus

- **Decision**: chaque palette redéfinit la famille d'accent (`--accent`, `--accent-bright`,
  `--accent-gradient-from/to`, `--on-accent`, `--success`), la famille de fond (`--bg`, `--panel*`,
  `--nav-bg`, `--bg-glow`, `--border`, `--border-control`, `--input-bg`, `--button-bg`,
  `--image-bg`, `--inner-bg`, `--scrim`, textes) et `--link` quand sa teinte se confondrait avec
  l'accent (turquoise). `--kamas`, `--exo`, `--warning`, `--danger` ne changent jamais (FR-010).
- **Rationale**: l'émeraude actuel colore le fond en sarcelle ; un thème qui ne changerait que
  l'accent ressemblerait à l'émeraude avec un bouton d'une autre couleur. Les statuts gardent leur
  rôle.
- **Alternatives**: changer seulement l'accent (rejeté : ne répond pas à « fond et lueurs inclus »).

## 3. Teintes des six Dofus

- **Decision** (mode sombre ; teintes mesurées sur les images des Dofus, pas déduites de leur nom,
  puis valeurs exactes validées par le test de contraste) :
  émeraude vert-jaune 65–85° (`#a5d43a`, sur fond sarcelle, actuel) ; pourpre rouge-orangé 12° sur
  fond bordeaux (pixels vifs à 15–45°) ; turquoise cyan 178° sur fond bleu nuit, lien décalé vers le
  bleu (165–205°) ; ocre jaune doré 42° sur fond brun-olive (35–55°) ; ébène accent bronze 28° sur
  fond presque noir (35 % de pixels sombres, reflets ambre) ; ivoire accent crème 44° sur fond gris
  chaud (36 % de pixels très clairs).
- **Rationale**: chaque Dofus garde la couleur de son image ; pourpre, ocre, ébène et ivoire sont
  tous dans la bande rouge-orangé-doré, donc on les distingue par la luminosité et la saturation du
  fond autant que par la teinte de l'accent. Ébène et ivoire étant presque neutres, leur accent
  doit rester assez saturé pour marquer l'état « sélectionné ».
- **Contrôle**: `tests/unit/theme-contrast.test.ts` lit déjà `theme.css`. On l'étend aux 12
  combinaisons avec les mêmes paires (texte 4,5:1, formes 3:1).

## 4. Images

- **Decision**: copier les six images DofusDB dans `public/` sous `dofus-<id>.png`, comme
  `dofus-emeraude.png` (déjà local).
  Sources, `https://api.dofusdb.fr/img/items/<iconId>.png` : pourpre 23001 (objet 694), émeraude
  23002 (737), turquoise 23003 (739), ébène 23007 (7114), ivoire 23011 (7115), ocre 23012 (7754).
- **Rationale**: pas de dépendance au réseau pour l'icône de navigation ni pour l'icône d'onglet, et
  pas de requête externe à chaque page. Les fichiers viennent bien de DofusDB (FR-006). Repli si une
  image manque : `alt` textuel dans Paramètres, et icône d'émeraude pour la navigation.
- **Alternatives**: hotlink vers DofusDB à chaque affichage (rejeté : icône d'onglet impossible à
  changer hors ligne, et panne de DofusDB visible sur toutes les pages).

## 5. Mémorisation sans flash

- **Decision**: `localStorage['craftcheck-dofus']`, valeur = id du Dofus. Un script synchrone
  dans `index.html` lit la clé et pose `data-dofus` (et l'icône d'onglet) avant le premier rendu.
  Toute valeur inconnue ou illisible (ou `localStorage` indisponible) donne l'émeraude.
- **Rationale**: `data-theme` est posé dans un `useEffect`, donc après le premier rendu ; pour un
  thème de couleurs complet, un flash de vert serait trop visible (SC-004).
- **Alternatives**: poser l'attribut dans `useEffect` seulement (rejeté : flash).

## 6. Icônes hors page

- **Decision**: l'icône d'onglet (`<link rel="icon">`) et `meta theme-color` suivent le Dofus choisi ;
  `apple-touch-icon` et `og-image` restent ceux de l'émeraude (images d'aperçu fixes).
- **Rationale**: l'icône d'onglet est une « icône du site » au sens de la demande ; les deux autres
  sont lues par des services externes qui n'exécutent pas le script.

## 7. Hors périmètre

La page d'administration (`admin/`) garde son icône pourpre et ses couleurs actuelles.
