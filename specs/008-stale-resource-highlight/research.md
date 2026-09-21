# Research: Mise en évidence des prix de ressources obsolètes

## Décision 1 — Où implémenter le calcul d'ancienneté

**Decision**: Créer `src/domain/price-age.ts`, un module pur exportant les seuils
(`PRICE_AGE_STALE_DAYS = 3`, `PRICE_AGE_EXPIRED_DAYS = 7`) et une fonction
`classifyPriceAge(updatedAt: string | undefined, now?: Date): 'fresh' | 'stale' | 'expired' | 'unknown'`.

**Rationale**: La fonctionnalité voisine `specs/007-outlier-confirmation` (`src/domain/outlier-threshold.ts`)
établit déjà le pattern local : une règle métier pure, testée unitairement, consommée par un
composant UI. Le suivre garde le changement petit et cohérent (Constitution IV), et rend la
classification testable indépendamment du rendu React.

**Alternatives considered**:
- Calculer l'ancienneté directement dans `ResourcePriceInput.tsx` : rejeté, mélangerait règle
  métier et rendu, et serait plus difficile à tester aux limites (3j/7j) sans monter le composant.
- Étendre `formatRelativeTime` (`src/domain/time.ts`) pour retourner aussi un niveau d'alerte :
  rejeté, `formatRelativeTime` a une responsabilité unique (formatage texte) déjà utilisée
  ailleurs (ex. `PinnedItemPrice`) sans notion d'alerte ; mélanger les deux romprait cette
  réutilisation.

## Décision 2 — Couleurs utilisées

**Decision**: Réutiliser les tokens CSS déjà définis dans `src/styles/theme.css` :
`--warning` / `--warning-soft` pour l'état "orange" (3-7 jours), `--danger` pour l'état "rouge"
(≥7 jours). Aucune nouvelle variable de couleur n'est introduite.

**Rationale**: Ces tokens existent déjà et sont utilisés ailleurs dans l'app pour des alertes
(`.badge-warning`, `.stat-negative`), et s'adaptent automatiquement au thème clair/sombre. Cela
correspond à la préférence déjà établie du projet de garder les couleurs de l'UI cohérentes avec
une palette unique gérée centralement plutôt que des couleurs arbitraires ajoutées au coup par
coup.

**Alternatives considered**: Introduire des couleurs orange/rouge dédiées à cette fonctionnalité —
rejeté, dupliquerait des tokens existants et casserait la cohérence clair/sombre déjà gérée par
`theme.css`.

## Décision 3 — Distinction avec l'indicateur `communityMeta.stale` existant

**Decision**: Le nouvel indicateur d'ancienneté est un état visuel de la ligne entière (classe CSS
sur `.price-line`), tandis que `communityMeta.stale` (déjà existant) reste un texte inline
("— peut-être daté") qualifiant spécifiquement une valeur de secours affichée après l'échec d'une
requête réseau. Les deux mécanismes restent indépendants et peuvent coexister sans se contredire
(FR-008).

**Rationale**: `communityMeta.stale` répond à une question différente ("cette valeur vient-elle
d'un cache après échec réseau ?") de celle posée par cette fonctionnalité ("ce prix a-t-il été
saisi il y a longtemps ?"). Les fusionner créerait un signal ambigu.

**Alternatives considered**: Réutiliser/étendre `communityMeta.stale` pour couvrir aussi
l'ancienneté — rejeté pour la raison ci-dessus, et parce que l'ancienneté s'applique aussi en mode
personnel où `communityMeta` est `undefined`.
