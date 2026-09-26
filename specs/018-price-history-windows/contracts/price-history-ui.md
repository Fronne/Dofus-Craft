# Contrat : popover d'historique — révisé par la spec 018

Inchangé (spec 017) : bouton en Mode communautaire seulement (lignes de ressources, fiche objet),
popover en portail, fermeture Échap / extérieur / « Fermer », titre et serveur, chargement,
« Historique indisponible pour le moment ».

## Sélecteur

Boutons « Jour », « Semaine », « Mois » (`aria-pressed`), défaut « Semaine », choix retenu.
Groupe `aria-label="Période"`.

## États (data-model.md « Affichage »)

- `empty` : « Pas encore d'historique pour ce serveur. »
- `none-in-window` : « Aucun prix partagé sur cette période. » + bouton « Voir <fenêtre> » si
  `longerWindow`.
- `single` : le prix, puis « le 24 sept. à 14:05 » + bouton « Voir <fenêtre> » si `longerWindow`.
- `chart` : la courbe.

## Courbe

- un cercle par prix (focusable, `aria-label` « 24 sept. à 14:05 : 2 720 000 kamas ») relié par une
  ligne ;
- axe horizontal = fenêtre entière (début → instant du chargement) ; étiquettes d'extrémité en
  heures pour « Jour », en jours sinon ;
- info-bulle : prix en kamas, puis date et heure (heure de Paris) ;
- table cachée pour les lecteurs d'écran : colonnes « Date », « Prix ».
