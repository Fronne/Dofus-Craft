# Modèle de données : compteurs de joueurs

## Table D1 `player_counters`

| Colonne | Type | Règle |
|---------|------|-------|
| `id` | TEXT | clé primaire (UUID) |
| `player` | TEXT | obligatoire, 1 à 40 caractères |
| `breed_id` | INTEGER | obligatoire, une des 19 classes (`src/domain/breeds.ts`) |
| `sex` | TEXT | `m` ou `f` |
| `count` | INTEGER | obligatoire, entier ≥ 0 (`CHECK (count >= 0)`) |
| `at_least` | INTEGER | 0 ou 1 (« au moins », affiche « 150+ ») |
| `unit_one` | TEXT | obligatoire, 1 à 40 caractères (« tentative de FM ») |
| `unit_many` | TEXT | obligatoire, 1 à 40 caractères (« tentatives de FM ») |
| `target_item_id` | INTEGER | obligatoire, identifiant DofusDB |
| `target_name` | TEXT | obligatoire |
| `target_icon` | TEXT | obligatoire, URL `https://api.dofusdb.fr/img/items/…` |
| `created_at` | TEXT | ISO 8601, défini à la création ; ordre d'affichage |
| `updated_at` | TEXT | ISO 8601, à chaque modification |

Reprise initiale (migration) :

| player | breed_id | sex | count | at_least | unit_one / unit_many | target |
|--------|----------|-----|-------|----------|----------------------|--------|
| Le-Lanceurdeglyphe | 1 | m | 150 | 1 | donjon sans drop / donjons sans drop | 21189 Parangon de puissance, icône 50733 |
| Nicomoux | 12 | m | 157 | 0 | tentative de FM / tentatives de FM | 14094 Amulette du Strigide, icône 1235 |

## Forme échangée (JSON)

```json
{ "id": "…", "player": "Nicomoux", "breedId": 12, "sex": "m", "count": 157, "atLeast": false,
  "unitOne": "tentative de FM", "unitMany": "tentatives de FM",
  "target": { "itemId": 14094, "name": "Amulette du Strigide", "icon": "https://api.dofusdb.fr/img/items/1235.png" },
  "createdAt": "…", "updatedAt": "…" }
```

## Appareil (localStorage)

| Clé | Contenu |
|-----|---------|
| `craftcheck-player-counters` | dernière liste reçue, affichée si le service est injoignable |
