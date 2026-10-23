# UI Contract: Thèmes de couleurs des Dofus primordiaux

## 1. Section « Dofus » de la page Paramètres

- Titre `h2` « Dofus », placé après la section « Thème » (clair/sombre).
- Description : « Choisissez le Dofus dont le site prend les couleurs. »
- Six boutons `type="button"`, un par Dofus, dans l'ordre : émeraude, pourpre, turquoise, ocre,
  ébène, ivoire. Chacun contient l'image du Dofus et son nom en texte visible.
- Le Dofus actif porte `aria-pressed="true"` et la classe `selected` (même convention que
  `.settings-choice`) ; les autres `aria-pressed="false"`.
- Clic ou activation au clavier : applique le thème tout de suite, sans rechargement.
- Chaque image a `alt=""` (le nom est déjà dans le bouton) et des dimensions explicites.
- Image absente : le bouton reste utilisable grâce à son nom.

## 2. Document

- `<html data-dofus="<id>">` pour les cinq Dofus autres que l'émeraude ; attribut absent pour
  l'émeraude.
- `data-theme` (clair/sombre) reste indépendant.
- Posé avant le premier rendu par le script d'amorçage de `index.html`.

## 3. Icônes

- Barre de navigation (`.app-nav-brand-mark`) : `src` = image locale du Dofus actif.
- Onglet : `<link rel="icon">` = image locale du Dofus actif.
- `meta[name="theme-color"]` : couleur de fond du thème actif (sombre).
- `apple-touch-icon` et `og-image` : inchangés.

## 4. Jetons par palette

Chaque palette (`:root[data-dofus="x"]` et `:root[data-dofus="x"][data-theme="light"]`) redéfinit
les jetons listés dans [research.md](research.md) §2, et jamais `--kamas`, `--exo`, `--warning`,
`--danger`. Les paires de contraste du test `theme-contrast` doivent passer pour les 12 palettes.
