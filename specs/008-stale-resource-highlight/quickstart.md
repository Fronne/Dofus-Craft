# Quickstart: Valider la mise en évidence des prix obsolètes

## Prérequis

- Dépendances installées (`npm install`), aucune nouvelle dépendance ajoutée par cette
  fonctionnalité.
- Le serveur de dev peut rester lancé d'une session à l'autre (`npm run dev`).

## Validation automatisée

```sh
npm run test -- price-age resource-price-input
```

Résultat attendu : les tests unitaires de `src/domain/price-age.ts` (limites à 3 et 7 jours, cas
`updatedAt` absent) et le test mis à jour de `ResourcePriceInput` (classe CSS appliquée selon
l'ancienneté) passent tous.

```sh
npm run typecheck
```

## Validation manuelle (scénarios de la spec)

1. Lancer `npm run dev` et ouvrir la page Recherche sur un objet dont une ressource a un prix
   personnel renseigné.
2. **Prix récent (< 3 jours)** : saisir/mettre à jour le prix d'une ressource à l'instant.
   → La ligne reste sans coloration d'alerte (US1, scénario 3).
3. **Prix "orange" (3-7 jours)** : via les DevTools ou une donnée de test, simuler un
   `updatedAt` vieux de 4 jours pour une ressource.
   → La ligne s'affiche en orange, le texte "Dernière mise à jour : ..." reste lisible
   (US1 scénario 1, US2 scénario 1).
4. **Prix "rouge" (≥ 7 jours)** : simuler un `updatedAt` vieux de 10 jours.
   → La ligne s'affiche en rouge (US1 scénario 2).
5. **Aucun prix connu** : ressource sans prix saisi.
   → La ligne n'est pas colorée par cette fonctionnalité (US2 scénario 2, FR-005).
6. **Mode communautaire** : vérifier qu'une ligne avec `communityMeta.stale = true` (valeur de
   secours après échec réseau) et un `updatedAt` ancien affiche bien les deux signaux
   distinctement (texte "— peut-être daté" + coloration de ligne), sans qu'ils se confondent
   (FR-008).

## Référence

- Règles de classification : voir [data-model.md](./data-model.md)
- Décisions de conception (couleurs, emplacement du code) : voir [research.md](./research.md)
