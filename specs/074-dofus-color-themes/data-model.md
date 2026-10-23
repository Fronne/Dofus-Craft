# Data Model: Thèmes de couleurs des Dofus primordiaux

## Dofus primordial

Liste fixe de six entrées, définie dans le code (`src/domain/dofus-themes.ts`).

| id | Nom affiché | Objet DofusDB | iconId (image) | Fichier local |
| --- | --- | --- | --- | --- |
| `emeraude` (défaut) | Dofus Émeraude | 737 | 23002 | `/dofus-emeraude.png` |
| `pourpre` | Dofus Pourpre | 694 | 23001 | `/dofus-pourpre.png` |
| `turquoise` | Dofus Turquoise | 739 | 23003 | `/dofus-turquoise.png` |
| `ocre` | Dofus Ocre | 7754 | 23012 | `/dofus-ocre.png` |
| `ebene` | Dofus Ébène | 7114 | 23007 | `/dofus-ebene.png` |
| `ivoire` | Dofus Ivoire | 7115 | 23011 | `/dofus-ivoire.png` |

Champs : `id` (identifiant stable, sans accent), `name`, `dofusDbId` (traçabilité de la source,
principe I), `image` (chemin local), `themeColor` (valeur de `meta theme-color`, mode sombre).

Les palettes de couleurs ne sont pas dans cette liste : elles vivent dans `theme.css`, une par
`id` et par mode.

## Préférence de Dofus

- **Où** : `localStorage`, clé `craftcheck-dofus`.
- **Valeur** : un `id` de la liste ci-dessus.
- **Validation** : toute autre valeur, une valeur absente ou une erreur d'accès donne `emeraude`.
- **Cycle de vie** : écrite à chaque choix ; jamais supprimée ; lue au démarrage (script
  d'amorçage de `index.html`, puis état React).
- **Indépendance** : sans lien avec `craftcheck-theme` (clair/sombre). Les deux se combinent.
