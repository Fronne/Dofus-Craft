# Specification Quality Checklist: Partage communautaire des prix

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-16
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Révision du 2026-09-16 (première révision) : le pré-remplissage du champ de prix par le prix
  communautaire, la séparation stricte des carnets Mode personnel / Mode communautaire, et le
  partage groupé (remplaçant la contribution par ressource) ont été clarifiés avec le joueur avant
  l'écriture de cette révision — aucun marqueur [NEEDS CLARIFICATION] n'a été nécessaire. Déjà
  implémentée.
- Révision du 2026-09-16 (révision 2) : retrait du réglage de consentement explicite et du
  mécanisme de retrait rétroactif — le partage groupé devient la valeur par défaut du Mode
  communautaire, sans étape de configuration préalable ; clarifié avec le joueur (mécanique du
  partage : toujours via le bouton existant, jamais automatique en continu ; retrait rétroactif :
  supprimé) avant l'écriture de cette révision, aucun marqueur [NEEDS CLARIFICATION] nécessaire.
  `/speckit-plan` devra traiter cela comme une simplification du code existant (retrait de
  `ShareConsent` et de `LocalContributionRecord`), pas un ajout. Validation passée sans question
  ouverte ; prêt pour `/speckit-plan`.
- Révision du 2026-09-16 (révision 3, documentation a posteriori) : le verrouillage par défaut des
  champs de prix déjà remplis en Mode communautaire (FR-016), avec bouton de déverrouillage et
  reverrouillage automatique au blur, était déjà implémenté et testé (`tests/unit/resource-price-input.test.tsx`)
  avant l'écriture de cette section — cette révision documente le comportement livré plutôt que de
  le planifier en amont. Aucun marqueur [NEEDS CLARIFICATION] nécessaire, le comportement exact
  avait été clarifié avec le joueur avant l'implémentation.
- Révision du 2026-09-17 (révision 4) : remplacement du partage groupé (bouton dans les Paramètres,
  révisions 1-3) par une transmission automatique par ressource à la perte de focus du champ, avec
  réaffichage de la médiane à jour et incrémentation du nombre de contributions (FR-017 à FR-020).
  Portée (Mode communautaire uniquement), déclencheur (perte de focus, pas à chaque frappe) et
  devenir du bouton de partage groupé (supprimé) ont été clarifiés avec le joueur via question à
  choix multiples avant l'écriture de cette révision — aucun marqueur [NEEDS CLARIFICATION]
  nécessaire. Cette révision n'est pas encore implémentée : prête pour `/speckit-clarify` (si besoin)
  ou `/speckit-plan`.
- Révision du 2026-09-18 (révision 5) : ajout d'un identifiant d'appareil anonyme, transmis et
  stocké avec chaque contribution (User Story 5, FR-010 révisée, FR-021 à FR-023). Le type
  d'identifiant (anonyme par appareil, plutôt qu'un pseudo ou un compte utilisateur) a été clarifié
  avec le joueur via question à choix multiples avant l'écriture de cette révision — aucun marqueur
  [NEEDS CLARIFICATION] nécessaire. Cette révision n'est pas encore implémentée : prête pour
  `/speckit-plan`.
