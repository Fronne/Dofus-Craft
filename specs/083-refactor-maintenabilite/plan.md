# Plan d'implémentation : Code du site facilement maintenable

**Branche** : `083-refactor-maintenabilite` | **Date** : 2026-11-02 | **Spec** : [spec.md](spec.md)

## Résumé

Réorganisation pure du code, sans changement de comportement : découper `global.css` en fichiers par
fonctionnalité (en gardant l'ordre de la cascade), scinder six gros composants en sous-composants et
hooks, découper les modules de règles, de données, d'API et du Worker par sujet, et ne garder que
npm. Chaque étape est validée par la suite de tests existante.

## Contexte technique

**Langage** : TypeScript (React, Vite), CSS, SQL (D1)
**Dépendances** : inchangées (aucune ajoutée)
**Stockage** : Cloudflare D1 (inchangé)
**Tests** : Vitest (unitaires, intégration), Playwright (e2e) ; `npm run typecheck`, `npm run lint`
**Plateforme** : site statique Cloudflare + Workers (`worker/`, `admin-worker/`)
**Type de projet** : application web + API Worker
**Contraintes** : rendu et résultats identiques ; ordre de cascade CSS conservé ; noms des scripts npm et des routes inchangés
**Périmètre** : ~32 600 lignes de code. Fichiers visés : `src/styles/global.css` (2 967 lignes), `BrisagePage.tsx` (839), `RecherchePage.tsx` (573), `EpinglesPage.tsx` (504), `FamilierPage.tsx` (408), `AppShell.tsx` (370), `RankingTab.tsx` (331), `domain/brisage.ts` (509), `domain/forgemagie.ts` (392), `data/catalogue-repository.ts` (400), `services/community-price-api.ts` (369), `worker/src/index.ts` (332), `worker/src/fm/seances.ts` (324)

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données traçables | Non concerné : aucune donnée ni source modifiée. |
| II. Correction avant optimisation | OK : les règles de calcul ne changent pas ; les tests existants servent de filet, aucun test n'est affaibli. |
| III. Décisions explicables | Non concerné : affichage identique. |
| IV. Petits changements cohérents | Exception documentée : le principe interdit le refactoring non lié ; ici le refactoring est l'objet de la fonctionnalité. Aucune abstraction ni dépendance nouvelle hors des découpages. |
| V. Données utilisateur | Non concerné. |
| Contraintes projet | Renforcées : règles, données et présentation restent séparées, adaptateurs externes isolés. |

Après conception : aucun écart nouveau.

## Structure du projet

### Documentation

```text
specs/083-refactor-maintenabilite/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md        # créé par /speckit-tasks
```

Pas de dossier `contracts/` : aucune interface externe n'est ajoutée ni modifiée (routes du Worker et
exports publics gardent leurs noms).

### Code source (cible)

```text
src/styles/
├── global.css            # uniquement des @import, dans l'ordre d'origine
└── parts/                # tranches contiguës de l'ancien fichier, nommées par fonctionnalité
                          # (base, barre du haut, boutons, recherche, épinglés, fiche objet, prix,
                          # réglages, accueil, responsive, compteur de donjon, forgemagie,
                          # couche « style du site » spec 051…)
src/features/<page>/      # chaque gros composant : <Page>.tsx court + sous-composants + use<Nom>.ts
src/domain/brisage/       # règles de brisage par sujet ; index.ts réexporte l'API actuelle
src/domain/forgemagie/    # idem
src/data/catalogue-repository/       # dépôt de données par sujet ; index.ts réexporte (même nom que l'ancien module : les vi.mock des tests restent valables)
src/services/community-price-api/    # client API par sujet ; index.ts réexporte (même raison)
worker/src/routes/        # une route ou un groupe de routes par fichier ; index.ts assemble
worker/src/fm/seances/    # séances de forgemagie par sujet
```

**Décision de structure** : les fichiers découpés gardent un point d'entrée qui réexporte l'API
publique d'origine, pour que imports et tests existants fonctionnent sans changement.

## Ordre d'exécution (du moins au plus risqué)

1. Gestionnaire de paquets (npm retenu).
2. CSS : découpage en tranches contiguës, ordre préservé.
3. Domaine, données, client API (logique pure, bien couverte par des tests).
4. Worker.
5. Composants React.
6. Passe finale : lint, types, tests unitaires + intégration + e2e, relecture.

Un commit par étape, tests lancés avant chaque commit.
