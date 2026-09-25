# Contrat : `GET /price-history` (Worker)

Lecture anonyme (pas de clé requise), comme `GET /community-price` et `GET /latest-price`.

`GET /price-history?kind=<resource|item>&id=<id>&serverId=<id>`

| Cas | Statut | Corps |
|---|---|---|
| paramètre manquant, ou `kind` autre que `resource` / `item` | 400 | `{ "error": "kind (resource or item), id and serverId are required" }` |
| aucun prix dans les 90 jours | 200 | `{ "day": [], "week": [], "month": [] }` |
| prix trouvés | 200 | voir ci-dessous |

```json
{
  "day":   [{ "periodStart": "2026-09-14", "medianAmountKamas": 1200, "sampleSize": 2 },
            { "periodStart": "2026-09-21", "medianAmountKamas": 1350, "sampleSize": 1 }],
  "week":  [{ "periodStart": "2026-09-14", "medianAmountKamas": 1200, "sampleSize": 2 },
            { "periodStart": "2026-09-21", "medianAmountKamas": 1350, "sampleSize": 1 }],
  "month": [{ "periodStart": "2026-09-01", "medianAmountKamas": 1250, "sampleSize": 3 }]
}
```

- « Aucun prix » renvoie **200 avec des listes vides**, et non 404. L'absence d'historique est un
  résultat normal, que le client distingue d'une panne (statut non 2xx, réseau, corps invalide →
  `unavailable`).
- Calcul : data-model.md et research.md §3. Seules les lignes du `kind` demandé comptent, et une
  ressource et un objet de même identifiant ne se mélangent jamais.
- La réponse ne contient **jamais** de `device_id`, d'horodatage individuel ni de montant individuel
  (FR-006). Un point avec `sampleSize: 1` porte le montant d'un seul prix, sans date précise : c'est
  accepté (hypothèse de la spec).
- Aucune migration. La purge hebdomadaire ne change pas.

## Client : `getPriceHistory(kind, id, serverId)` (`src/services/community-price-api.ts`)

Renvoie `{ status: 'found', history: PriceHistory } | { status: 'unavailable' }` et **ne lève
jamais d'exception**. Toute erreur réseau, tout statut non 2xx ou tout corps dont un point n'a pas
les trois champs typés attendus donne `unavailable`.

## Tests obligatoires

- regroupement : deux contributions à 23:30 et 00:30 heure de Paris tombent sur deux jours ; une
  contribution à 22:30 UTC en été compte pour le lendemain ; un dimanche et le lundi suivant sont dans
  deux semaines différentes ; le 31 et le 1er sont dans deux mois différents ; changement d'heure
  d'octobre ;
- un appareil qui saisit 3 prix le même jour compte une fois (son dernier prix) ; sur deux jours, il
  compte une fois par jour ; les lignes à `device_id` vide comptent chacune ;
- une valeur aberrante (≥ 4 valeurs, écart interquartile non nul) est écartée et n'entre pas dans
  `sampleSize` ; une période qui ne contenait que cette valeur disparaît ;
- une ligne de plus de 90 jours est ignorée, même la dernière d'un objet gardée pour
  `/latest-price` ;
- `kind=item` ignore les lignes `'resource'` du même identifiant, et inversement ; un autre serveur
  est ignoré ;
- médiane interpolée (2 valeurs 1000 et 1500 → 1250) ;
- 400 sans paramètre ou avec un `kind` invalide ; 200 avec listes vides sans données ;
- client : corps valide → `found` ; 500, réseau coupé ou corps invalide → `unavailable`, sans
  exception.
