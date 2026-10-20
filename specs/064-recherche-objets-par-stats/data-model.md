# Modèle de données : Recherche d'objets par stats ciblées

**`BrisageItemsIndex`** (fichier `src/data/brisage-items.json`)
`source`, `sourceUrl`, `retrievedAt`, `items: IndexedItem[]`

**`IndexedItem`** : `id: string` (identifiant DofusDB, stable) · `name: string` · `level: number` ·
`imageUrl?: string` · `effects: { effectId: number; from: number; to: number }[]` (jets positifs, `from ≤ to`,
uniquement des stats de `BRISAGE_STATS`).

**`SearchSelection`** (préférences locales `craftcheck-brisage-search`) : `effectIds: number[]` ·
`sort: 'runes' | 'kamas' | 'maxRoll'` (défaut `runes`) · `minLevel?: number` · `maxLevel?: number`.
Lecture défensive : toute valeur invalide → défauts.

**`SearchResult`** (calculé) : `item: IndexedItem` · `perStat: { effectId; from; to; runes: number }[]` ·
`totalRunes: number` · `valueKamas?: number` (absent si un prix de rune manque).

## Règles
- Stat ciblable : `effectId ∈ BRISAGE_STATS` et ≠ 696969.
- Un objet correspond si, pour **chaque** `effectId` choisi, il a une ligne de jet positif.
- Plage de niveaux : bornes incluses ; `min > max` → refusée avec message.
- Tri `runes` : `totalRunes` décroissant, puis niveau décroissant, puis nom ; `kamas` : `valueKamas` décroissant, inconnus en dernier ; `maxRoll` : plus grand `to` sur les stats choisies. Égalité finale : nom puis `id` (ordre stable).
