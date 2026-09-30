# Data Model: Captures d'une séance FM et rattachement d'objet par son nom

Aucune table ni colonne nouvelle. Ce qui est lu :

## Capture (`fm_captures`, existante)

| Champ | Utilisation |
|---|---|
| `id` | identifiant de la capture dans la réponse |
| `session_id` | rattachement à la séance lue |
| `discord_user_id` | auteur (→ `playerView`, masqué s'il est privé) |
| `origin` | `bot` → « Discord », `capture` → « Site » |
| `spent_kamas` | montant de la capture ; la somme des captures = total de la séance |
| `created_at` | date et heure ; ordre d'affichage (puis `id`) |

## Ligne d'achat (`fm_purchase_lines`, existante)

Regroupée par capture et par `item_name` : `SUM(quantity)`, `SUM(total_kamas)`, prix moyen
`round(total / quantité)`. Une capture sans ligne a un récap vide.

## Objet en FM (`fm_items`, existant)

Peut désormais être créé par le rattachement d'une séance (`label` = NULL). Règle ajoutée : un objet
créé ainsi n'existe que s'il est rattaché à la séance (R4).

## Vue « capture » renvoyée au site

```text
FmCapture = {
  id: string
  createdAt: string (ISO)
  origin: 'bot' | 'capture'
  player: PlayerView
  spentKamas: number
  items: FmItemSummary[]   // même forme que le récap global
}
```
