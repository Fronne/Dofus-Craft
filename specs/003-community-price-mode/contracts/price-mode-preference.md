# Price Mode Preference Contract

## Scope

Ce contrat fixe les frontières observables introduites par le choix de mode de gestion des prix :
lecture/écriture de la préférence de mode, et comportement de l'interface qui en dépend. Il
**complète** les contrats existants
[`../../001-craft-profit-comparison/contracts/ui-and-storage.md`](../../001-craft-profit-comparison/contracts/ui-and-storage.md)
et
[`../../002-server-scoped-prices/contracts/server-scoped-storage.md`](../../002-server-scoped-prices/contracts/server-scoped-storage.md)
sans en modifier aucune opération : aucune signature de dépôt de prix n'est changée par cette
fonctionnalité.

## Price mode preference

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `getPriceMode` | aucun | `'personal'` \| `'community'` | Lecture synchrone disponible dès le premier rendu ; retourne toujours `'personal'` si aucune valeur valide n'est en stockage (FR-001, jamais d'état bloquant). |
| `setPriceMode` | `'personal'` \| `'community'` | succès | Écrit immédiatement ; la valeur est relue à l'identique après rechargement de page ; n'effectue et ne déclenche aucune opération sur `ResourcePrice` ou `PinnedItemPrice` (FR-006, FR-007). |

## UI interaction contract

| Surface | Inputs | Outputs / states |
|---------|--------|-------------------|
| Sélecteur de mode (paramètres) | choix entre les deux modes présentés avec leur description | remplace `PriceModePreference.mode` ; le mode nouvellement actif est immédiatement identifié comme tel (FR-002, FR-004). |
| Indicateur de mode actif (paramètres) | aucun | affiche en permanence, dans les paramètres, le mode actuellement actif (FR-002). |
| Bandeau « communautaire à venir » | aucun, dérivé de `PriceModePreference.mode` | visible uniquement lorsque `mode === 'community'` ; n'affiche jamais de prix communautaire fabriqué ou estimé (FR-011). |
| Zone de prix (recette, item épinglé) | inchangé par rapport à 001/002 | lit/écrit exclusivement via les dépôts de prix personnels existants, quel que soit `PriceModePreference.mode` (FR-009, FR-012). |

## Validation visible

- Un changement de mode n'affiche jamais, même brièvement, une valeur de prix différente de celle
  déjà en vigueur avant le changement (FR-007, FR-008) — vérifiable par comparaison stricte avant
  et après un aller-retour de mode (US2).
- Aucune requête réseau liée aux prix n'est observable, dans les outils de développement du
  navigateur, pendant qu'un des deux modes est actif (FR-010, SC-002) — cette itération ne
  construit aucun client réseau pour les prix.
- Le sélecteur de mode ne propose jamais plus de deux options, et jamais de saisie libre (FR-001).
- Le bandeau « communautaire à venir » est visible à chaque fois que `mode === 'community'`, y
  compris après un rechargement de page ou un changement de ressource/item consulté (FR-011).
