# Modèle de données : Prix de l'objet sur la page Brisage

## BrisageSession (existant, `src/persistence/brisage-session.ts`)

| Champ | Type | Règle |
|---|---|---|
| `priceSource` | `'hdv' \| 'craft'` | **nouveau** ; absent ou valeur inconnue à la lecture → `'hdv'` |
| `manualCost` | `string` | inchangé ; commun aux deux sources |
| autres champs | — | inchangés |

## ItemCraftCostState (nouveau, retourné par `useItemCraftCost`)

| Champ | Type | Règle |
|---|---|---|
| `status` | `'loading' \| 'ready'` | `loading` tant que l'arbre de recettes et le carnet ne sont pas lus |
| `costKamas` | `number \| undefined` | défini seulement si la chaîne est complète et le total > 0 |
| `reason` | `'incomplete' \| 'no-recipe' \| undefined` | défini quand `ready` sans montant |

## Prix retenu (calculé dans la page, rien de stocké)

`source = priceSource`; `montant = (source === 'craft' ? craft.costKamas : hdv.costKamas) ?? saisie manuelle`.
La provenance affichée est `hdv`, `craft` ou `manuel` selon ce qui a fourni le montant.

## Transitions

- Bascule HDV ↔ craft : met à jour `priceSource`, la saisie manuelle est conservée.
- Changement d'objet, de serveur ou de mode de prix : les deux prix sont recalculés.
