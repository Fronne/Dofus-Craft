# Data Model — Simplification de la page Brisage

## EffectRange (lecture, non persistée)
`{ effectId: number; from: number; to: number }` — fourchette d'une ligne de l'objet (DofusDB, déjà en cache).
Règle : jet moyen = `floor((from + to) / 2)`.

## BrisageLineDraft (état de page)
`{ effectId; from; to; override?: string }` — `override` vide = jet moyen ; sinon jet saisi.

## StoredCoefficient (persisté, appareil)
| Champ | Type | Règle |
|---|---|---|
| clé | `"<serverId>:<itemId>"` | une entrée par objet et par serveur |
| `coefficient` | number | 0 < c ≤ 100 |
| `savedAt` | ISO 8601 | date de la dernière saisie |

Transitions : saisie valide → remplace l'entrée (date du jour) ; saisie vide/invalide → entrée inchangée.
Stockage illisible ou corrompu → traité comme « jamais brisé ».

## ItemCost (lecture)
Prix épinglé `marketPriceKamas` du couple (serveur, objet) ; absent → saisie manuelle non persistée.
