# Data Model: Mise en évidence des prix de ressources obsolètes

Aucune nouvelle entité ni changement de schéma (client ou worker/D1). Cette fonctionnalité dérive
un état d'affichage à partir d'une donnée déjà existante.

## Entité existante réutilisée

### ResourcePrice (`src/domain/types.ts`)

| Champ | Type | Rôle dans cette fonctionnalité |
|---|---|---|
| `resourceId` | `string` | Non utilisé directement par la classification (portée par le composant appelant) |
| `unitPriceKamas` | `number` | Non utilisé par la classification d'ancienneté |
| `updatedAt` | `string` (ISO date) | Entrée de `classifyPriceAge` : date de référence pour calculer l'ancienneté |

Aucun champ n'est ajouté à `ResourcePrice`. `updatedAt` peut être absent au niveau du composant
(prop optionnelle sur `ResourcePriceInput`), ce cas correspond à l'état `'unknown'` (FR-005).

## Nouveau concept dérivé (non persisté)

### PriceAgeStatus

Union de valeurs, calculée à la volée, jamais stockée :

| Valeur | Condition | Effet visuel |
|---|---|---|
| `'unknown'` | `updatedAt` absent | Aucune coloration (état actuel inchangé) |
| `'fresh'` | ancienneté < 3 jours | Aucune coloration |
| `'stale'` | 3 jours ≤ ancienneté < 7 jours | Fond/texte orange (`--warning`) |
| `'expired'` | ancienneté ≥ 7 jours | Fond/texte rouge (`--danger`) |

**Règle de transition** : recalculée à chaque rendu à partir de `updatedAt` et de l'heure actuelle
— pas de machine à états persistante, pas d'effet de bord (FR-007 : se met à jour automatiquement
dès que `updatedAt` change, ex. après une nouvelle saisie).
