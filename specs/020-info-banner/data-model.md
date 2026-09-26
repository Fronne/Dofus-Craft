# Data Model: Bandeau d'information

## Message d'information (D1 `info_message`)

| Colonne | Type | Règle |
|---|---|---|
| `id` | TEXT PK | toujours `'current'` |
| `text` | TEXT | 1 à 280 caractères après suppression des espaces aux extrémités |
| `tone` | TEXT | `'info'` ou `'important'` |
| `ends_at` | TEXT NULL | ISO 8601 UTC, strictement dans le futur à la publication |
| `updated_at` | TEXT | ISO 8601, mis à jour à chaque publication |

## JSON (`InfoMessage`)

`{ text: string; tone: 'info' | 'important'; endsAt: string | null; version: string }` —
`version = updated_at`.

## Entrée de publication (`InfoMessageInput`)

`{ text: string; tone: 'info' | 'important'; endsAt?: string | null }`. Erreurs de
`validateInfoMessageInput` (champ, message en français) :
- `text` vide → « Le message ne peut pas être vide. » ; > 280 → « 280 caractères au plus. » ;
- `tone` inconnu → « Style inconnu. » ;
- `endsAt` illisible ou passé → « La date de fin doit être dans le futur. »

## Fermeture (appareil)

`localStorage['craftcheck-info-banner-dismissed'] = version` ; illisible ou indisponible → rien
de fermé.

## Affichage

Bandeau visible ⇔ message reçu ∧ (`endsAt` nul ∨ `endsAt` > maintenant) ∧ `version` ≠ version fermée.
