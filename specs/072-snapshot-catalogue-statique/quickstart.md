# Quickstart : valider le snapshot

1. `npm run snapshot:catalogue` → crée `public/catalogue-snapshot/{meta,items,item-sets}.json` ; `meta.json` indique les totaux.
2. `npm run build` → `dist/catalogue-snapshot/` présent (le `prebuild` régénère le snapshot).
3. Servir `dist/`, données du site vidées, DofusDB bloqué : la recherche est complète, 3 requêtes `catalogue-snapshot/*` (meta + 2 fichiers), aucune `items?$skip=`.
4. Rouvrir : aucune requête `items.json`, au plus 2 requêtes `$limit=0` vers DofusDB (puis aucune pendant 6 h).
5. Écart : modifier `totals` dans `dist/catalogue-snapshot/meta.json` (ou simuler dans le test) → rafraîchissement en fond, catalogue gardé mis à jour.
6. Échec de génération : réseau coupé puis `npm run snapshot:catalogue` → code de sortie ≠ 0, ancien snapshot intact.
7. `npm test` et `npm run build` passent.
