# Data Model: Page Rentabilité déjà prête à l'arrivée

## Liste Rentabilité gardée (nouveau, sur l'appareil)

Clé `localStorage` : `craftcheck-craft-profits:<serverId>:<mode>` (`mode` = `personal` | `community`).

| Champ | Type | Règle |
|-------|------|-------|
| `formatVersion` | nombre | doit valoir `1` (sinon ignorée) |
| `computedAt` | date ISO | date de fin du calcul ; ignorée si invalide ou plus de 7 jours |
| `rows` | `CraftProfitRow[]` | lignes telles qu'affichées (spec 019, `src/domain/craft-profit.ts`) ; ignorée si une ligne n'a pas `item.id`, `item.name`, `marketPriceKamas`, `craftCostKamas`, `profitKamas` numériques |

Écrite uniquement quand un calcul se termine (`ready`) ; remplacée à chaque nouveau calcul complet.

## État de la page (`CraftProfitsState`, modifié)

| Champ | Nouveau | Sens |
|-------|---------|------|
| `status` | non | `loading` / `ready` / `unavailable` |
| `rows`, `done`, `total` | non | inchangés |
| `keptAt` | oui | présent quand la liste affichée vient d'une visite précédente : sa date de calcul |
| `refreshFailed` | oui | `true` quand la mise à jour de la liste gardée a échoué |

Transitions avec une liste gardée :

```text
(ouverture) ready + keptAt
   ├─ calcul terminé ──────────▶ ready (sans keptAt) ; liste enregistrée
   └─ calcul indisponible ─────▶ ready + keptAt + refreshFailed
```
