# Quickstart : vérifier l'historique des prix

## Prérequis

- Dépendances installées (`npm install`).
- Pour le Worker local : `npm run worker:dev`, avec une base D1 locale initialisée
  (`worker/schema.sql`, puis les migrations `worker/migrations/*.sql` en local).
- Application pointée sur ce Worker local (`VITE_COMMUNITY_API_URL`).

## 1. Tests automatisés

```bash
npm test                        # unitaires + intégration (Vitest)
npm run typecheck && npm run lint
npx playwright test tests/e2e/price-history.spec.ts
```

Attendu : tous les tests passent, y compris ceux listés dans
[contracts/price-history-api.md](./contracts/price-history-api.md) et
[contracts/price-history-ui.md](./contracts/price-history-ui.md).

## 2. Route du Worker

Insérer en local quelques contributions datées pour une ressource (plusieurs jours et semaines,
deux appareils, un doublon le même jour, une valeur aberrante, une ligne de plus de 90 jours), puis :

```bash
curl "http://localhost:8787/price-history?kind=resource&id=<id>&serverId=<serveur>"
```

Attendu :
- trois listes `day`, `week` et `month` triées, sans aucun `device_id` ni horodatage individuel ;
- le doublon compte une fois, la valeur aberrante et la ligne ancienne sont absentes ;
- sans données : `{"day":[],"week":[],"month":[]}` en 200 ; sans `kind` : 400.

## 3. Parcours dans l'application

1. Mode communautaire, serveur ayant des contributions : ouvrir la fiche d'un objet craftable.
2. Cliquer sur l'icône d'historique d'une ressource : le popover s'ouvre, avec « Semaine »
   sélectionné, et le champ de prix n'a pas pris le focus.
3. Survoler un point : période, médiane et nombre de prix.
4. Passer à « Jour » puis « Mois » : la courbe change. Fermer, rouvrir sur une autre ressource : le
   dernier regroupement est conservé.
5. Ouvrir l'historique depuis « Prix HDV » : les prix HDV de l'objet s'affichent. Le prix du champ ne
   change pas.
6. Une ressource sans prix : « Pas encore d'historique pour ce serveur ».
7. Échap, clic extérieur, « Fermer » : le popover se ferme.
8. Couper le Worker puis rouvrir un popover : « Historique indisponible pour le moment », et le reste
   de la fiche fonctionne.
9. Passer en Mode personnel : plus aucun bouton d'historique.
10. Largeur 375 px : le popover tient dans l'écran, sans défilement horizontal.
