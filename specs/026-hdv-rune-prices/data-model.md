# Data Model: Prix des runes dans la page HDV

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Aucune donnée nouvelle, ni en base ni sur l'appareil. Seuls des types et fonctions du site évoluent.

## Types et fonctions (`src/domain/hdv.ts`)

- `HdvId = 'resources' | 'consumables' | 'animals' | 'runes'` ; `HDV_TABS` gagne
  `{ id: 'runes', label: 'Runes' }` en dernière position (FR-001). `isHdvId('runes')` est vrai, donc
  l'onglet retenu dans `localStorage` (`craftcheck-hdv-tab`) peut être « runes » (FR-008).
- `filterByPrice<T extends { id: string }>(items: T[], …): T[]` et
  `countPriced<T extends { id: string }>(items: T[], …)` : même règle, sur n'importe quelle liste
  identifiée (FR-004).
- `itemsForHdv(data, 'runes')` renvoie `[]` : `hdv-items.json` ne contient aucune rune (type 78
  exclu, test existant) ; l'onglet Runes lit `rune-items.json`.

## Types et fonctions (`src/domain/forgemagie.ts`)

- `filterRunes(runes: RuneItem[], { query, stat }: { query: string; stat: string }): RuneItem[]` :
  nom sans accents ni casse, stat exacte, ordre de `rune-items.json` conservé (FR-002, FR-003).
- `runeStatLabels(runes)` : inchangée.

## Données lues

| Source | Utilisée par | Changement |
|---|---|---|
| `src/data/rune-items.json` | onglet Runes de la page HDV | aucun (auparavant lue par la page Forgemagie) |
| `GET /community-prices` (`latestOrigin`) | onglet Runes, Mode communautaire | aucun |
| Carnet de prix (IndexedDB) | onglet Runes | aucun : même carnet que les autres onglets |
