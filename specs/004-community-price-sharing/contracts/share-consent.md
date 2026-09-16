# Share Consent Contract

## Scope

Ce contrat fixe les frontières observables du consentement de partage communautaire (FR-004,
FR-005, FR-006), distinct du `PriceModePreference` déjà défini en
[`../../003-community-price-mode/contracts/price-mode-preference.md`](../../003-community-price-mode/contracts/price-mode-preference.md).
Activer le mode communautaire ne donne jamais ce consentement automatiquement.

## Share consent preference

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `getShareConsent` | aucun | `boolean` | Lecture synchrone disponible dès le premier rendu ; retourne toujours `false` si aucune valeur valide n'est en stockage (comportement sûr par défaut, principe constitutionnel V). |
| `setShareConsent` | `boolean` | succès | Écrit immédiatement ; passer de `true` à `false` MUST empêcher toute nouvelle `submitCommunityPrice` (voir [`community-price-api.md`](./community-price-api.md)) à partir de ce moment (FR-006). |

## UI interaction contract

| Surface | Inputs | Outputs / states |
|---------|--------|-------------------|
| Interrupteur de consentement (paramètres, visible uniquement en mode communautaire) | activer/désactiver | remplace `ShareConsent.given` ; l'état actif est immédiatement confirmé de façon claire (FR-005, SC-004 : effectif en moins de 10 secondes). |
| Action « retirer mes contributions déjà envoyées » (paramètres, visible si `LocalContributionRecord` non vide) | confirmation de l'action | appelle `withdrawCommunityContribution` pour chaque contribution locale connue, puis vide `LocalContributionRecord` (User Story 4, scénario 3). |
| Zone de prix communautaire (recette, item consulté) | dérivé de `PriceModePreference.mode` et `ShareConsent.given` | propose de contribuer uniquement si `mode === 'community'` ; si `given === false`, l'action de contribution demande d'abord le consentement plutôt que d'envoyer silencieusement (FR-004). |

## Validation visible

- Aucun prix personnel n'est observable, dans les outils réseau du navigateur, en direction du
  service communautaire tant que `ShareConsent.given === false` (FR-004, SC-002) — vérifiable en
  interceptant les requêtes réseau pendant un scénario où le joueur saisit des prix personnels
  sans avoir donné son consentement.
- Le retrait du consentement (`setShareConsent(false)`) n'affecte jamais la disponibilité ni
  l'exactitude des prix personnels eux-mêmes (FR-006, Edge Cases spec.md).
- `ShareConsent.given` et `PriceModePreference.mode` sont deux états indépendants : tester chaque
  combinaison des deux (personnel/communautaire × consentement donné/non donné) ne doit jamais
  produire une transmission de prix personnel hors du seul cas `mode === 'community'` **et**
  `given === true`.
