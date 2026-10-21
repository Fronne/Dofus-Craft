# Plan d'implémentation : Lignes à jet négatif, page Brisage

**Branche**: `067-brisage-lignes-negatives` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Entrée**: spécification `specs/067-brisage-lignes-negatives/spec.md`

## Résumé

La page Brisage garde les **lignes à jet négatif** de l'objet, les affiche en rouge sans action de focus, et les fait entrer dans le calcul du focus avec la règle de Kama Master : poids = `0,015 × niveau × poids de la stat × jet + 1` appliqué au jet négatif, ramené à 0 s'il est négatif, compté à 50 % dans un focus, aucune rune.

Approche : les lignes négatives ne passent **pas** par les lignes de rune. Elles forment une liste à part (`negatives`) que l'analyse reçoit en plus des lignes positives. Elles n'ajoutent donc aucun rendement (`yields`), ce qui évite toute collision avec une ligne positive de la même stat. Côté données, une nouvelle fonction lit les plages négatives de l'objet **sans toucher** à `effectRangesOf`, qui sert aussi à l'index de recherche par stats (spec 064) et au script de build : la recherche ne doit pas trouver un objet à cause d'un malus, et `brisage-items.json` n'a pas à être régénéré.

## Contexte technique

**Langage/Version** : TypeScript (React 18, Vite), tests Vitest

**Dépendances principales** : aucune nouvelle

**Stockage** : aucun changement. Les jets saisis restent dans la session existante (`craftcheck-brisage-session`, clé `rolls`) ; les lignes négatives y utilisent des index qui suivent ceux des lignes positives.

**Tests** : `npm run test` (Vitest, `tests/unit`, `tests/integration`), `npm run lint`, `npm run build`

**Plateforme cible** : navigateur ordinateur et téléphone

**Type de projet** : application web monopage (front seul)

**Objectifs de performance** : recalcul instantané (calcul pur en mémoire)

**Contraintes** : aucun résultat existant ne change pour un objet sans ligne négative (SC-002) ; aucune valeur inventée ; page utilisable à 390 px

**Échelle/Périmètre** : 1 module de domaine étendu, 1 fonction de données ajoutée, 1 page modifiée, un peu de style

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données traçables | OK : la règle vient du code de Kama Master (`research.md`), DoFocus écarté et documenté dans `docs/dofocus-brisage.md` ; signalée comme estimation. |
| II. Correction avant optimisation | OK : règle dans `src/domain/brisage.ts`, tests unitaires (jet positif de poids, borne à 0, focus, objet à lignes seulement négatives). |
| III. Décisions explicables | OK : la ligne négative est visible, rouge, avec une note « aucune rune ». |
| IV. Changements petits et cohérents | OK : aucune dépendance ; `effectRangesOf` et le script de build restent inchangés. |
| V. Données utilisateur | OK : aucune nouvelle donnée stockée. |

**Revérification après conception** : mêmes verdicts.

## Structure du projet

### Documentation (cette fonctionnalité)

```text
specs/067-brisage-lignes-negatives/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── page-brisage-negatives.md
└── tasks.md             # créé par /speckit-tasks
```

### Code source (racine du dépôt)

```text
src/
├── data/catalogue-repository.ts      # + negativeRangesOf / getItemNegativeRanges
├── domain/brisage.ts                 # + negativeLineWeight, négatives dans buildOption / analyses
└── features/brisage/BrisagePage.tsx  # lignes négatives : lecture, jet, rendu rouge
src/styles/global.css                 # style de la ligne négative
docs/dofocus-brisage.md               # + section sur les lignes négatives (Kama Master retenu)
tests/unit/brisage-negative.test.ts   # règle de poids, focus, objet sans ligne positive
tests/unit/catalogue-item-effect-lines.test.ts  # + plages négatives
tests/integration/brisage-page.test.tsx         # ligne rouge, pas de focus
```

**Décision de structure** : un seul module de domaine, une seule page ; pas de nouveau fichier source.

## Phases

### Phase 0 : recherche
Voir [research.md](research.md) : lecture de Kama Master, écart avec DoFocus, choix de ne pas toucher à `effectRangesOf`.

### Phase 1 : conception
- [data-model.md](data-model.md) : `NegativeLine`, `negativeLineWeight`, changements de `analyzeBrisage` et `analyzeFocusAdvice`.
- [contracts/page-brisage-negatives.md](contracts/page-brisage-negatives.md) : ce que la page montre et refuse.
- [quickstart.md](quickstart.md) : scénarios de validation.
