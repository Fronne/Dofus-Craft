# Contrat d'interface : tableau de bord moderne et pages du site

Complète les contrats des specs 068 et 070 : adresses, retour, focus et visuels des cartes sont inchangés.

## Tableau de bord, de haut en bas

1. **Chiffres clés** : `<ul>` de quatre cartes — Pages actives (« 6 sur 7 »), Lignes ce mois-ci, Visiteurs du
   jour, Limite du jour. Une carte est un lien vers sa section sauf « Visiteurs du jour » (aucune section). Valeur
   en grand, titre en petit, état en texte (« Proche de la limite », « Indisponible »). Quatre colonnes en
   large, deux en moyen, une en étroit.
2. **Grandes cartes de graphiques** : Utilisation Cloudflare, Clés de l'outil de prix, Prix communautaires,
   Visites. Deux colonnes à partir de 1100 px, une en dessous. Chaque carte garde son lien (titre + résumé) et son
   visuel de la spec 070.
3. **Cartes secondaires** : Pages du site, Bandeau d'information, Compteurs, Mapping. Grille adaptative.

Les titres des chiffres clés sont distincts de ceux des cartes de section : un nom accessible ne désigne jamais
deux liens.

## Habillage

- Fond à dégradés bleu-vert ; cartes à grand rayon, bordure fine, lueur discrète (`box-shadow` colorée) qui
  s'intensifie au survol et au focus.
- Thème clair : mêmes formes, lueur et dégradés atténués ; textes au contraste lisible.
- États : la couleur et la lueur sont décoratives ; l'état est toujours écrit.
- `prefers-reduced-motion` : aucune animation de survol.

## Section « Pages du site »

- Sept lignes dans l'ordre de la navigation : « Page <Nom> : **Activée / Désactivée** » et un bouton
  « Activer » / « Désactiver » (nom accessible : « Désactiver la page <Nom> »).
- Désactiver la **dernière** page active : le bouton devient « Confirmer la désactivation » avec le message
  « C'est la dernière page active : le site n'aura plus aucune page disponible. » et un bouton « Annuler ».
- Retour de l'enregistrement : « Page <Nom> activée. » / « désactivée. » ; échec : message d'erreur, l'état
  affiché reste celui enregistré.

## Site public

- Navigation : seules les pages activées ont un lien ; Paramètres reste toujours présent.
- Adresse d'une page désactivée : titre de la page, message « <Nom> est momentanément indisponible », lien vers
  la première page encore active (« Aller à <Nom> »).
- Accueil, logo et adresse inconnue : mènent à la première page encore active.
- Aucune page active : message « Aucune page n'est disponible pour le moment. » avec lien vers Paramètres.
- Pendant la première lecture des réglages : « Chargement… » (jamais « indisponible » à tort).
