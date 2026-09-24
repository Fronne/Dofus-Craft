# Recherche : nouveau design « Moderne épuré » au choix

## 1. Comment faire coexister deux designs

- **Décision** : un attribut `data-design="modern"` sur `<html>`, et une feuille de style dédiée
  `src/styles/design-modern.css` dont **toutes** les règles sont préfixées par
  `:root[data-design="modern"]`. En « Classique », l'attribut est absent et aucune règle de ce
  fichier ne s'applique.
- **Justification** : c'est le mécanisme déjà utilisé pour le thème (`data-theme`) et la couleur
  d'accent (`data-accent`), qui reposent sur des variables CSS (`src/styles/theme.css`). Le
  « Classique » n'est pas touché (FR-005), et supprimer le design non retenu revient à supprimer un
  fichier et un attribut, ou à déplacer ses règles sans préfixe.
- **Alternatives écartées** : réécrire `global.css` en deux variantes (duplication de 1 100 lignes) ;
  composants React différents par design (FR-007 : même organisation, seule l'apparence change) ;
  branche git (écartée par le joueur).

## 2. Ce que le nouveau design change

- **Décision** : d'abord redéfinir les variables existantes sous le préfixe (rayons, ombres,
  espacements, dégradé des panneaux, fond de page), ce qui transforme l'app en profondeur sans
  toucher aux composants ; puis quelques règles ciblées : cartes et panneaux (bordure plus légère,
  ombre douce, survol), barre de navigation, en-têtes de page (hiérarchie typographique), boutons
  et champs (coins, états), cartes de résultats (élévation au survol), apparition des cartes.
- **Justification** : les composants utilisent déjà ces variables ; peu de règles suffisent.

## 3. Typographie

- **Décision** : police Inter en version variable, embarquée dans l'app via le paquet
  `@fontsource-variable/inter` (fichiers servis par l'app elle-même, aucun appel à un service
  tiers). Sa famille s'appelle « Inter Variable » et n'est utilisée que par le design « Nouveau ».
- **Justification** : la police actuelle déclare `Inter` mais ne la charge pas ; chaque appareil
  retombe sur sa police système, d'où un rendu inégal. Une police embarquée garantit la même
  typographie partout. Le nom de famille distinct (« Inter Variable ») garantit que le
  « Classique » ne change pas (FR-005) : le navigateur ne télécharge la police que si une règle
  l'utilise. Aucune donnée n'est envoyée à un tiers (principe V).
- **Alternatives écartées** : Google Fonts (requête vers un tiers) ; garder la police système
  (pas d'amélioration typographique visible).

## 4. Pas d'apparition de l'ancien design au chargement (FR-003)

- **Décision** : lire la préférence et poser l'attribut dans `src/main.tsx`, avant le premier rendu
  React ; `AppShell` le met ensuite à jour à chaque changement.
- **Justification** : l'écran de choix du serveur est rendu hors d'`AppShell` (`App.tsx`) ; poser
  l'attribut avant le rendu couvre aussi cet écran (cas limite de la spec).

## 5. Animations

- **Décision** : transitions de 150 à 200 ms au survol, et une apparition en fondu/glissement de
  8 px pour les cartes. La règle globale `prefers-reduced-motion` de `theme.css` les neutralise déjà
  (FR-010).

## 6. Éléments reproduisant le jeu (FR-011)

- **Décision** : aucune règle du nouveau design ne touche les variables `--slot-*` ni les fonds
  d'icônes d'objets et de ressources (`--image-bg`).
