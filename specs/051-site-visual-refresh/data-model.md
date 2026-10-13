# Data Model: Nouveau style visuel pour tout le site

Cette fonctionnalité ne crée ni ne modifie aucune donnée de jeu, aucun prix, aucune table. Les
seules « données » concernées sont les jetons de style et deux préférences locales.

## Jetons de style (`src/styles/theme.css`)

Valeurs du thème sombre reprises de la maquette ; valeurs du thème clair conçues ici, à confirmer
par le test de contraste puis par l'utilisateur.

| Rôle | Jeton | Sombre | Clair |
| --- | --- | --- | --- |
| Fond de page | `--bg` | `#08181c` | `#eaf3f1` |
| Halos du fond | `--bg-glow` | turquoise + vert + or, sur dégradé `#0d2f36 → #071619` | mêmes halos, très atténués, sur `#eef6f4 → #e2efec` |
| Panneau | `--panel` | `rgba(18,52,58,.78)` | `rgba(255,255,255,.86)` |
| Panneau opaque | `--panel-strong` | `#11333a` | `#ffffff` |
| Surface secondaire | `--panel-soft` | `#16424a` | `#dcebe8` |
| Zone en creux, champ | `--input-bg`, `--inner-bg` | `rgba(3,14,17,.55)` | `rgba(13,60,66,.06)` |
| Barre de navigation | `--nav-bg` | `rgba(8,28,32,.72)` | `rgba(255,255,255,.78)` |
| Texte | `--text` | `#f6eed6` | `#0f2d33` |
| Texte secondaire | `--text-muted` | `#c5d8d4` | `#3d5a5f` |
| Texte discret | `--text-faint` | `#93b0ac` | `#52706f` |
| Accent (action, sélection, gagnant) | `--accent` | `#a5d43a` | `#3f7d0c` |
| Accent vif (texte, focus) | `--accent-bright` | `#b6e24a` | `#2f6406` |
| Texte posé sur l'accent | `--on-accent` | `#10200a` | `#ffffff` |
| Bouton plein | `--accent-gradient` | `#b1dc35 → #84b41c` | `#4d9412 → #3a770a` |
| Kamas | `--kamas`, `--kamas-edge` | `#ffc94d`, `#c98f1f` | `#8a5a00`, `#b97f12` |
| Lien, action secondaire, répartition | `--link`, `--link-strong` | `#5fd9cb`, `#2aa79b` | `#0b6f68`, `#0e8a80` |
| Avertissement, prix vieillissant | `--warning` | `#ffb84d` | `#8a5300` |
| Erreur, prix périmé, destructif | `--danger` | `#ff8a75` | `#b3391f` |
| Gain | `--success` | `#a5d43a` | `#3f7d0c` |
| Séparateur | `--border` | `rgba(120,220,205,.18)` | `rgba(13,60,66,.14)` |
| Contour de champ | `--border-control` | `#5f8f8b` | `#6f8f8c` |
| Contour d'une case d'objet | `--slot-border` | `rgba(120,220,205,.24)` | `rgba(13,60,66,.2)` |
| Police de titre | `--font-display` | Rowdies | identique |
| Police de texte | `--font-body` | Lexend | identique |

Règles :

- Les teintes dérivées (`--accent-soft`, `--link-soft`, `--kamas-soft`, `--warning-soft`,
  `--danger-soft`, `--border-strong`) se calculent par `color-mix()` à partir du jeton de base.
- Les jetons d'échelle (espacements, rayons, hauteurs de champ, durées) ne changent pas.
- Les jetons qui reproduisent le jeu (cases d'équipement, voiles sur image) gardent leurs valeurs,
  hors `--slot-border` pour les cases d'objet du site.
- Jetons supprimés : `--accent-<couleur>-*` (les vingt valeurs des cinq accents), `--gold*`.

## Préférences locales (`localStorage`)

| Clé | Avant | Après |
| --- | --- | --- |
| `craftcheck-theme` | thème clair ou sombre | inchangé |
| clé du design (module `design-preference`) | `classic` ou `modern` | plus lue ; effacée au démarrage |
| clé de l'accent (module `accent-color-preference`) | l'un des cinq accents | plus lue ; effacée au démarrage |

Validation : l'effacement ne doit jamais lever d'erreur, y compris quand le stockage est
indisponible (navigation privée, stockage bloqué).

## Attributs posés sur `<html>`

| Attribut | Avant | Après |
| --- | --- | --- |
| `data-theme` | `dark` / `light` | inchangé |
| `data-design` | `classic` / `modern` | supprimé |
| `data-accent` | l'un des cinq accents | supprimé |
