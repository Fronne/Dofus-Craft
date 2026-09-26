# Contrat : page Prix (`/prix`)

## En-tête

- Titre « Prix » ; sous-titre « Bénéfice si vous craftez, serveur <nom>, <Mode> ».
- Champ « Rechercher un objet » ; sélecteur « Trier par » : « Bénéfice (kamas) » / « Marge (%) » ;
  sélecteur de nombre de lignes 10 / 25 / 50 / 100 ; « <n> objets ».

## Ligne (bouton ou lien vers `/?item=<id>` de la page Recherche)

- visuel + nom ;
- « Prix HDV » : montant, puis date (format de `price-age`, comme le champ « Prix HDV ») ;
- « Coût de craft » : montant ;
- bénéfice : « +12 000 kamas » / « −2 000 kamas » / « 0 kamas » et marge « +15 % » ; classe positive,
  négative ou neutre.
- Mobile : les montants passent sous le nom, sans défilement horizontal.

## États

- sans serveur : invitation à choisir un serveur (existante) ;
- chargement : « Calcul en cours… (n / total) » tant que des objets restent à calculer ;
- aucune ligne : « Aucun objet calculable : il faut un prix HDV et le prix de toutes ses ressources. »
  + lien vers Recherche ;
- panne `/item-prices` : « Impossible de charger les prix partagés pour le moment. »
