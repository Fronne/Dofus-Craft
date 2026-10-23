# Contrat d'interface : tableau de bord de l'administration

> Complété par la spec 070 : les cartes reçoivent des visuels (graphiques) et deux cartes en lecture seule sont ajoutées, voir [`specs/070-admin-dashboard-graphiques/contracts/admin-dashboard-ui.md`](../../070-admin-dashboard-graphiques/contracts/admin-dashboard-ui.md). Les adresses, la navigation, le retour et le focus décrits ci-dessous ne changent pas.

Aucune API serveur nouvelle ni modifiée. Contrat de l'interface uniquement.

## Adresses

| Adresse | Vue |
|---|---|
| `/` ou `/#` | Tableau de bord |
| `/#pages` `/#bandeau` `/#compteurs` `/#cles` `/#correspondances` `/#cloudflare` | La section seule |
| toute autre ancre | Tableau de bord |

## Tableau de bord

- En-tête inchangé (« Administration », « Connecté : … »).
- Liste de six cartes (`<ul>` de `<a href="#section">`), dans l'ordre : Pages du site, Bandeau d'information, Compteurs, Clés de l'outil de prix, Correspondances, Utilisation Cloudflare.
- Chaque carte : titre (h2), résumé (texte), état d'alerte en texte pour Cloudflare. Nom accessible = titre + résumé.
- Résumé en cours de lecture : « Chargement… » ; lecture échouée : « Indisponible » ; la carte reste un lien actif.
- Une grille adaptative : plusieurs colonnes en large, une seule colonne en étroit.

## Vue de section

- Lien « ← Retour au tableau de bord » (`href="#"`) avant la section, titre de vue (h1 conservé, h2 de la section inchangé).
- La section est rendue telle qu'avant ; rien d'autre n'est affiché.
- Au changement de vue, le focus va sur le titre de la vue.

## Compatibilité

Les messages, libellés et comportements des six sections sont inchangés. Le message de confirmation des compteurs (« notice ») reste dans la section Compteurs.
