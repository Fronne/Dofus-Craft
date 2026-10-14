# UI Contract: page XP Familier (`/familier`)

Ce que les tests (integration, e2e) peuvent trouver par rôle et nom accessible.

## Bloc 1 — bandeau objectif (`section`, nom « Objectif du familier »)

- Champs `spinbutton` « Niveau actuel », « Niveau visé », « XP totale du familier » (inchangés).
- `progressbar` « Progression du familier », `aria-valuetext` « 26,2 %, niveau 85 ».
- Texte « Niveau 85 · 47 003 XP » et « Niveau 100 · 179 592 XP ».
- `status` contenant « XP à donner » et la valeur (« 132 589 ») ; ou « Aucune XP à donner : le
  niveau visé est déjà atteint. ».
- `switch` « Almanax du 23 juillet (+50 % d'XP) » (inchangé).

## Bloc 2 — podium (`section`, titre `heading` « Les moins chères pour cet objectif »)

- `list` de 1 à 3 `listitem` (`article`), chacun avec un `heading` de niveau 3 = nom de la
  ressource, le rang (« 1re · la moins chère », « 2e · +N kamas », « 3e · +N kamas »), le coût total, et les
  libellés « Quantité », « Prix unitaire », « XP / unité ».

## Bloc 3 — ressource précise (`section`, titre `heading` « Viser une ressource précise »)

- `searchbox` « Rechercher une ressource à viser ».
- Suggestions : `group` « Suggestions » de `button` dont le nom est celui de la ressource.
- Fiche (`region` « Fiche de <nom> ») : « Quantité », « Prix unitaire », « Coût total », « Écart avec
  la 1re », « 1 unité = » ; « Prix inconnu » sans prix ; « Non classée (plus de N unités) » au-delà du
  plafond ; « Ne correspond à aucune ressource » sans suggestion.

## Bloc 4 — tableau (`section`, titre `heading` « Toutes les ressources »)

- `searchbox` « Filtrer les ressources » (remplace « Rechercher une ressource » de 022).
- `spinbutton` « Quantité max » (inchangé).
- `group` « Trier la liste » (inchangé) précédé d'un en-tête non cliquable « Rang ».
- Chaque ligne : rang (« 4 »…), puis les cellules actuelles.

## Messages d'état conservés (022)

« Aucun serveur choisi », « Chargement des prix… », « Prix partagés indisponibles » + « Réessayer »,
« Aucune recommandation sans prix » + lien HDV, « Aucune ressource avec un prix ne correspond »,
« N ressources masquées (plus de N unités) », « Toutes les ressources demandent plus de N unités ».
