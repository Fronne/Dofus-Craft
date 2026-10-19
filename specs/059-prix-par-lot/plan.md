# Plan d'implémentation : prix par taille de lot

**Spec** : [spec.md](./spec.md)

## Décision de stockage (écart assumé)

La consigne évoquait une colonne « taille de lot, défaut 1 » sur `community_price_contributions`.
Les lecteurs de cette table (médiane, dernier prix, historique, purge…) n'ont **qu'un** prix par
ressource : y mêler des lignes par lot fausserait médianes et historique (FR-002), et filtrer
`lot_size = 1` partout changerait le prix affiché sur le site. Choix : **table dédiée
`community_price_lots`**, migration `0020`, qui ne réécrit **aucune** ligne existante. Les
contributions existantes restent lues comme prix du lot 1 (FR-003) : même résultat, sans copie ni
coût sur le quota D1.

## Données — `community_price_lots`

`(resource_id, server_id, lot_size ∈ {1,10,100,1000}, lot_price_kamas INTEGER ≥ 0, observed_at TEXT,
device_id TEXT)`, clé primaire `(resource_id, server_id, lot_size)` : dernier prix vu seulement
(upsert), pas d'historique, pas de purge nécessaire.

## Worker

- `worker/src/lot-prices.ts` : `lotPriceStatements(db, serverId, itemId, ladder, keyId, now)` (upsert
  des lots en vente + `DELETE` des lots absents) ; `lotPricesResponse(db, url)` pour
  `GET /community-lot-prices?serverId&resourceIds` (`contracts/community-lot-prices.md`).
- `sniffer.ts` : ajoute ces instructions au `db.batch` existant ; `rows_written` et le plafond
  comptent les ressources seulement (FR-006).
- `index.ts` : route GET publique, mise en cache comme `/community-prices`.

## Domaine (front, pur)

- `src/domain/lot-price.ts` : `LOT_SIZES`, `pickLotPrice(quantity, lots)` — la règle.
- `pet-xp.ts` : `PetFoodPrice.lots?` ; `planPetFood` et `petFoodTarget` calculent le prix par
  `pickLotPrice(quantité, lots)` avec le prix existant comme lot 1 de repli ;
  `PetFoodRecommendation.lotSize`.

## Front

- `services/community-price-api.ts` : `getCommunityLotPrices`.
- `usePetFoodPrices.ts` : en mode communautaire, charge les lots et les place dans `PetFoodPrice.lots`.
- `FamilierPage` / `PetFoodPodium` / `PetFoodTarget` : mention « lot ×N » sous le prix unitaire.

## Tests (Vitest)

`lot-price.test.ts` (250→100, 5→1, descente, jamais > N, aucun prix), extension de `pet-xp.test.ts`,
`sniffer-routes.test.ts` (écriture/suppression des lots, rows_written), route de lecture,
migration appliquée sur schéma existant avec données conservées.

## Déploiement

Aucun. Migration `0020` testée en local d'abord (skill cloudflare-d1-deploy) ; `--remote` et
`wrangler deploy` seulement sur accord. Ordre prévu : migration → Worker → site.

## Constitution

I (date du prix de lot affichée) ✓ ; II (règle testée avec bornes) ✓ ; III (lot utilisé affiché) ✓ ;
IV (une table, pas de refonte) ✓ ; V (`device_id` jamais exposé) ✓.
