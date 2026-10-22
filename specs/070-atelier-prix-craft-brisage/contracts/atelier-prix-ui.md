# Contrat d'interface : fenêtre « Prix du craft » (page Brisage)

Contrat visible par le joueur et par les tests d'intégration. Les noms accessibles ci-dessous sont ceux que
les tests interrogent.

## Bouton d'ouverture

- Nom accessible : **« Prix du craft »**, dans l'en-tête de l'objet, à côté du prix « Craft ».
- Absent si l'objet n'a pas de recette ; désactivé pendant le calcul du prix de craft.
- Au clic : ouvre la fenêtre. À la fermeture, le focus revient sur ce bouton.

## Fenêtre

- Élément `<dialog>` modal, rôle `dialog`, nom accessible **« Prix du craft de <nom de l'objet> »**.
- Contenu, de haut en bas :
  1. Titre avec le nom de l'objet et bouton **« Fermer »**.
  2. Liste défilante des lignes de ressources (voir ci-dessous).
  3. Pied fixe : **« Total du craft »** (ou « Total du craft incomplet » avec la mention des prix manquants).
- Fermeture : bouton « Fermer », touche Échap, ou clic hors de la fenêtre. Les trois enregistrent d'abord le champ en cours, puis déclenchent le recalcul de Brisage.

## Ligne de ressource

- Nom de la ressource, quantité cumulée (« × 75 »), champ de prix unitaire (nom accessible : « Prix de <ressource> »), sous-total en kamas.
- Mention d'ancienneté : « Dernière mise à jour : il y a N jours », ou « Prix manquant » quand il n'y a pas de prix.
- Les composants craftables sont dépliés ; leurs lignes enfants sont décalées sous eux, avec le choix **Auto | Acheter | Crafter** et l'indication du coût retenu, comme sur Recherche.
- Une ressource présente à plusieurs endroits affiche le même prix partout ; la modifier met toutes ses lignes à jour.

## Clavier

| Touche | Effet |
|---|---|
| Ouverture | le premier champ de prix est actif, contenu sélectionné |
| Entrée | enregistre le prix saisi, active le champ suivant (reste sur place à la dernière ligne) |
| Tab / clic ailleurs | enregistre le prix saisi |
| Échap | ferme la fenêtre |

Le focus reste dans la fenêtre tant qu'elle est ouverte.

## Prix invalide

Valeur vide, nulle, négative ou non numérique : rien n'est écrit, l'ancien prix est conservé, le champ le
signale. Un champ vidé volontairement retire le prix (comme sur Recherche) et la ligne passe à « Prix manquant ».

## Effets sur la page Brisage à la fermeture

- Le prix « Craft » de l'objet est recalculé depuis les carnets à jour.
- Le verdict, les gains et les cartes se basent sur le nouveau prix si la source choisie est Craft.
- L'objet, le coefficient, les exos et la source de prix choisie ne changent pas.
