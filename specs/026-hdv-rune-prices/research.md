# Research: Prix des runes dans la page HDV

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-30

Sources lues : `src/features/hdv/HdvPage.tsx`, `src/domain/hdv.ts`, `src/features/forgemagie/`
(`RunesTab.tsx`, `CaptureImport.tsx`, `ProfileTab.tsx`, `ForgemagiePage.tsx`) et leurs tests.

## R1. Intégrer les runes à la page HDV sans dupliquer la liste

**Decision** : `HdvId` gagne `'runes'` (et `HDV_TABS` un quatrième onglet « Runes »). `HdvPage`
choisit la **source** de l'onglet ouvert : les objets de `hdv-items.json` pour les trois onglets
existants, les runes de `rune-items.json` pour l'onglet Runes. La barre d'outils, les filtres de prix,
le compteur, le défilement progressif et la ligne de prix (`PriceEntryField`) restent **un seul code**.
Seuls diffèrent le filtre de catégorie (type ou stat) et la légende de la ligne (type, ou stat avec
icône et origine).

**Rationale** : FR-004 et FR-005 exigent le même comportement que les autres onglets ; un seul chemin
de rendu le garantit. `filterByPrice` et `countPriced` ne lisent que `id` : ils deviennent génériques
(`<T extends { id: string }>`), sans changer leur comportement.

**Alternatives considered** : déplacer tel quel `RunesTab` de Forgemagie dans un composant séparé
de la page HDV (duplique la barre d'outils, et il n'a ni filtres de prix ni compteur) ; convertir les
runes en `HdvItem` avec un faux `typeId` (mélange deux notions, et le filtre serait par type 78 unique).

## R2. Filtre par stat

**Decision** : nouvelle fonction pure `filterRunes(runes, { query, stat })` dans
`src/domain/forgemagie.ts`, avec la même recherche que `filterHdvItems` (`normalizeSearchText`, sans
accents ni casse — FR-003), et `runeStatLabels` (déjà existante) pour les choix du filtre. Le
sélecteur de la barre d'outils affiche « Toutes les stats » dans l'onglet Runes, « Tous les types »
ailleurs. Le filtre choisi est remis à zéro en changeant d'onglet, comme le type aujourd'hui.

## R3. Origine du dernier prix

**Decision** : le hook `useLatestOrigins` de `RunesTab` devient `src/features/hdv/useLatestOrigins.ts`,
appelé seulement pour l'onglet Runes en Mode communautaire (FR-006), avec les identifiants des runes
de l'onglet ; relu après chaque prix enregistré (`onSaved`), comme le compteur. Lecture groupée
existante (`getCommunityPrices`, lots de 98).

**Rationale** : l'origine n'est demandée que pour les runes ; l'étendre aux autres onglets serait un
changement de specs/023 que personne n'a demandé.

## R4. Import de capture dans l'onglet Profil

**Decision** : `CaptureImport` est affiché dans `ProfileTab`, sous les réglages, seulement quand le
profil affiché est celui du joueur connecté (FR-010). `onImported` relit le profil affiché (compteur
de version dans les dépendances de l'effet qui charge `getFmPlayer`), ce qui met les dépenses à jour
sans rechargement (FR-011). `RunesTab.tsx` est supprimé ; `ForgemagiePage` n'a plus que deux onglets.

**Rationale** : l'import enregistre des dépenses qui s'affichent dans ce même onglet, et utilise le
serveur de profil réglé juste au-dessus ; le message « Choisis d'abord ton serveur Dofus dans l'onglet
Profil » devient « … ci-dessus ».

## R5. Aucun changement côté Worker

**Decision** : aucune route, table ni contrat ne change ; pas de dossier `contracts/` pour cette
fonctionnalité. Les contrats de specs/025 restent valables.
