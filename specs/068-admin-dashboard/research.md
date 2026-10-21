# Recherche : Tableau de bord de l'administration

## D1 - Un panneau à la fois, pas d'onglets

- **Décision** : cartes sur l'accueil ; un clic ouvre la section seule ; bouton de retour.
- **Raison** : le plus simple à utiliser (rien à chercher, pas de défilement) et à tester ; les cartes servent déjà de menu.
- **Alternatives** : onglets en haut (doublonnent les cartes) ; toutes les sections visibles avec défilement vers l'ancre (garde la longue pile, ce que la demande veut éviter).

## D2 - Navigation par `location.hash`, sans routeur

- **Décision** : ancre `#pages`, `#bandeau`, `#compteurs`, `#cles`, `#correspondances`, `#cloudflare` ; pas d'ancre ou ancre inconnue = tableau de bord. Un hook lit `location.hash` et écoute `hashchange`.
- **Raison** : le bouton précédent marche seul, les liens se partagent, aucune dépendance (principe IV). Le worker d'administration sert déjà une seule page : une ancre ne demande aucun changement serveur.
- **Alternatives** : bibliothèque de routage (dépendance inutile) ; état React seul (le bouton précédent quitterait l'administration).

## D3 - Les résumés réutilisent les appels existants

- **Décision** : à l'ouverture du tableau de bord, lecture en parallèle de `getSettings`, `getMessage`, `list`, `listSnifferKeys`, `listSnifferMappings`, `getUsage(7)`. Chaque résultat devient un résumé indépendant (`loading` / `ok` / `unavailable`). Un échec n'affecte pas les autres cartes.
- **Raison** : aucune API nouvelle, état toujours frais au retour (FR-007) car le tableau de bord se remonte à chaque retour.
- **Alternatives** : endpoint de synthèse côté worker (changement serveur et contrat de plus pour six lectures déjà disponibles).

## D4 - Niveau Cloudflare

- **Décision** : réutiliser `usageLevel` / `usagePercent` / `USAGE_LEVEL_TEXT` ; la carte prend le pire niveau parmi les trois métriques et affiche la métrique la plus haute en pourcentage. États `not-configured`, `denied`, `unavailable` : texte explicite, carte cliquable.
- **Raison** : mêmes seuils que la section (hypothèse de la spec), pas de duplication.

## D5 - Sections montées seulement quand elles sont ouvertes

- **Décision** : une section n'est rendue que si l'ancre la désigne. Chaque éditeur charge ses données à son montage, comme aujourd'hui.
- **Raison** : comportement des éditeurs inchangé (FR-005) ; pas de six chargements doubles.
- **Impact** : les tests d'intégration existants de `AdminPage` doivent d'abord ouvrir la section (ancre) ; leurs assertions sur le fonctionnement restent identiques.

## D6 - Accessibilité

- Chaque carte est un vrai lien (`<a href="#…">`), donc focus, clavier et clic droit gratuits ; état en texte (« Proche de la limite »), pas seulement en couleur (FR-009). Au changement de vue, le titre de la vue reçoit le focus.
