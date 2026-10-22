# Contrat d'interface : cartes et graphiques du tableau de bord

> Mise en page revue par la spec 071 : rangée de chiffres clés, grandes cartes de graphiques puis cartes secondaires, voir [`specs/071-admin-dashboard-moderne/contracts/admin-dashboard-ui.md`](../../071-admin-dashboard-moderne/contracts/admin-dashboard-ui.md). Les visuels décrits ci-dessous sont conservés.

Complète [le contrat de la spec 068](../../068-admin-dashboard/contracts/admin-dashboard-ui.md) : adresses,
navigation, retour et focus sont inchangés.

## Structure d'une carte

- `<li>` contenant : (1) le lien existant (`<a href="#section">` avec titre h2 et résumé), (2) un bloc
  visuel frère du lien. Le nom accessible du lien reste « titre + résumé ».
- Cartes « Prix communautaires » et « Visites » : pas de lien ni d'ancre, titre h2 et résumé en texte seul,
  puis le visuel. Aucune section nouvelle.
- Le visuel se charge à part du résumé : « Chargement… » puis le graphique, « Indisponible » ou
  « Aucune donnée ». Un visuel en échec ne change ni le résumé ni les autres cartes (FR-008).

## Visuels par carte

| Carte | Visuel | Texte équivalent |
|---|---|---|
| Consommation Cloudflare | Courbes du cumul de la journée UTC, 3 métriques en %, ligne des 100 %, repères aux franchissements de 80 % et 100 % | Phrases de franchissement (« Écritures D1 : 80 % franchi à 14 h UTC ») + tableau heure par heure dans un `<details>` |
| Clés | Sélecteur de mois, total, barres par clé (révoquée signalée en texte), colonnes par jour, pastille « active / endormie / jamais utilisée » | Tableau clé par clé et jour par jour dans un `<details>` |
| Correspondances | « Publiée il y a N jours », build actif ; « en retard » en texte si > 30 jours | Le texte lui-même |
| Prix communautaires | Colonnes empilées par jour et par origine, 30 jours ; total de la période | Tableau jour × origine dans un `<details>` |
| Visites | Colonnes par jour, 30 jours ; visiteurs du jour | Tableau jour par jour dans un `<details>` |
| Compteurs | Barres horizontales par joueur | Liste « libellé : valeur » |
| Bandeau | « Se termine dans N jours » ou « Sans fin programmée » | Le texte lui-même |
| Pages du site | Aucun visuel | — |

## Règles communes

- Distinction par motif de trait ou de remplissage en plus de la couleur ; états en texte (FR-006).
- Survol et focus d'un point ou d'une barre : valeur exacte en infobulle (`<title>` SVG) ; mêmes valeurs
  dans le `<details>` atteignable au clavier.
- Jour et mois en UTC, indiqués sur la carte ; heure en cours marquée « partielle » avec l'heure de lecture.
- `viewBox` + largeur 100 % : pas de défilement horizontal de la page sur téléphone ; thème clair / sombre
  par les variables CSS existantes.
- Beaucoup de clés ou libellé long : les 8 premières par nombre de lignes, le reste regroupé en
  « Autres (N clés) » ; libellés tronqués avec le libellé complet en infobulle et dans le tableau.
- Rien d'inventé : une valeur absente n'est pas tracée à 0 ; un vrai 0 l'est.
