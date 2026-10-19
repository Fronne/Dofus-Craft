# Implementation Plan: Page Brisage

**Spec** : [spec.md](spec.md) · **Constitution** : I (aucune valeur fabriquée), II (tests des formules),
III (hypothèses visibles), IV (changement cohésif).

## Technique
React/Vite + vitest. Pas de Worker ni de base : lecture seule des prix existants.

## Fichiers
| Fichier | Rôle |
|---|---|
| `src/domain/brisage.ts` | Formules pures, table des stats, réglages par défaut, classement |
| `src/persistence/brisage-settings.ts` | Réglages en `localStorage` (try/catch) |
| `src/data/catalogue-repository.ts` | `getItemEffectLines(id)` : lignes numériques d'un objet |
| `src/features/brisage/useRunePrices.ts` | Prix des runes (carnet + communautaire) |
| `src/features/brisage/BrisagePage.tsx` | Page |
| `src/app/router.tsx`, `AppShell.tsx` | Route `/brisage`, titre ; **pas** d'entrée de menu |
| `src/styles/global.css` | Styles `.brisage-*` (réutilise `stat-tile`, `fm-*`) |
| `tests/unit/brisage.test.ts`, `tests/integration/brisage-page.test.tsx` | Tests |

## Contrats
- `BrisageSettings` (défauts = H2–H4) ; `analyzeBrisage(input, settings, prices)` →
  `{ options[], best, thresholdCoef, itemsCount, descent[] }`.
- Une rune sans prix n'est jamais valorisée : l'option porte `missingPrices`.
