# UI Contract: Nouveau style visuel

Ce que le joueur doit retrouver à l'écran, indépendamment de la réalisation. Les valeurs des
jetons sont dans [data-model.md](../data-model.md).

## 1. Rôles de couleur

| Rôle | Jeton | Où |
| --- | --- | --- |
| Action principale | `--accent` | bouton plein (un seul par écran), pastille du compteur de filtres |
| Sélection | `--accent` | résultat choisi, option active d'un sélecteur segmenté, rubrique active, tuile de catégorie choisie |
| Choix gagnant | `--accent` | titre et fond du bloc verdict, barre du montant le plus bas |
| Kamas mis en avant | `--kamas` | économie du verdict, symbole des kamas, mention « acheté » |
| Lien, action secondaire | `--link` | liens, boutons-liens, icône de recherche, pastilles de filtre, mention « crafté », barres de répartition |
| Prix vieillissant, avertissement | `--warning` | icône horloge, bandeau d'avertissement |
| Prix périmé, erreur, destructif | `--danger` | icône alerte, messages d'erreur, boutons de suppression |

Une couleur ne porte jamais seule une information : icône, texte ou forme l'accompagnent.

## 2. Couples à contraste garanti

Texte ≥ 4,5:1, icône ou contour ≥ 3:1, dans les deux thèmes. Vérifiés par
`tests/unit/theme-contrast.test.ts`.

| Premier plan | Fond |
| --- | --- |
| `--text`, `--text-muted`, `--text-faint` | `--bg`, `--panel`, `--panel-strong`, `--panel-soft`, `--nav-bg` |
| `--accent-bright`, `--link`, `--kamas` | `--bg`, `--panel`, `--panel-strong` |
| `--on-accent` | `--accent`, les deux extrémités de `--accent-gradient` |
| `--text` | `--accent-soft`, `--link-soft`, `--kamas-soft`, `--warning-soft` posés sur `--panel` |
| `--warning`, `--danger` (icônes) | `--panel`, `--panel-strong` (3:1) |
| `--border-control` (contour) | `--panel`, `--bg` (3:1) |
| `--stat-*` (losanges) | `--panel` (3:1) |

Les fonds translucides sont composés sur `--bg` avant le calcul.

## 3. Navigation

**Écran d'au moins 961 px**

- Une barre en haut, arrondie, détachée du bord, centrée dans la largeur du contenu.
- De gauche à droite : marque (« DC » + « DofusCraft »), rubriques, puis à droite le serveur actif,
  l'icône Paramètres, la bascule de thème.
- Rubriques : Recherche, Suivis, Rentabilité, HDV, XP Familier, et Forgemagie si la page est
  activée. Mêmes libellés, mêmes icônes, mêmes adresses qu'aujourd'hui.
- Rubrique active : texte et icône `--accent-bright`, fond `--accent-soft`, losange `--accent` à
  cheval sur le bord bas de la barre. Elle garde `aria-current="page"`.
- La barre reste en haut pendant le défilement ; aux largeurs où tout ne tient pas sur une ligne,
  elle passe sur deux lignes sans rien masquer.
- Le lien « Aller au contenu » reste le premier élément atteint au clavier.

**Écran de 960 px ou moins**

- Navigation en bas d'écran, organisation actuelle, nouvelles couleurs.

## 4. Composants communs

| Composant | Règle |
| --- | --- |
| Panneau (carte) | fond `--panel`, contour `--border`, rayon inchangé |
| Champ | fond `--input-bg`, contour `--border-control`, hauteur inchangée |
| Bouton plein | `--accent-gradient`, texte `--on-accent`, capitales espacées |
| Bouton secondaire | contour `--border-control`, fond transparent, texte `--text` |
| Bouton-lien | texte `--link`, zone ≥ 44 px |
| Titres de page et de section | `--font-display`, capitales |
| Case d'objet ou de ressource | image du jeu ; sans image, case teintée avec un losange |
| Montants | chiffres tabulaires, symbole des kamas `--kamas` |
| Menu, dialogue, bulle | fond `--panel-strong` (opaque) |
| Focus clavier | contour 2 px `--accent-bright`, décalé de 2 px |

## 5. Page Recherche

| Bloc | Contrat |
| --- | --- |
| Recherche | champ large, bouton Filtres à droite avec le nombre de filtres actifs |
| Filtres actifs | pastilles retirables sous le champ, panneau replié ; « Réinitialiser les filtres » |
| Résultats | 6 par défaut ; « N objets trouvés », « 6 sur N », « Afficher 12 de plus » |
| Résultat choisi | contour et fond d'accent, `aria-pressed="true"` |
| Verdict | bloc teinté d'accent ; losange coché ; choix gagnant en titre ; économie en `--kamas` ; deux barres (la plus basse en accent, l'autre neutre) |
| Ressources | colonnes Ressource / Prix unitaire / Sous-total ; ancienneté par icône + texte ; barre de répartition `--link` sous chaque sous-total |
| Sous-recette | trait vertical `--link` atténué ; mentions « acheté » (teinte or) et « crafté » (teinte turquoise) |
| Effets | une ligne par effet, losange de la couleur de la caractéristique, valeur en `--text`, nom écrit |

## 6. Ce qui ne change pas

Adresses des pages, libellés, ordre des rubriques, contenu et calculs de chaque page, réglages
autres que Design et Accent, mémorisation du thème, comportement de la navigation mobile.
