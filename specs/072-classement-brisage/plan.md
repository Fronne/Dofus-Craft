# Plan d'implémentation : Classement des objets les plus rentables à briser

**Branche**: `072-classement-brisage` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Entrée**: spécification `specs/072-classement-brisage/spec.md`

## Résumé

Ajouter à la page Brisage un onglet « Classement » qui calcule, pour chaque objet dont le prix HDV est connu, le même verdict que la fiche (`analyzeBrisage` avec coefficient, `analyzeFocusAdvice` sans coefficient), plus le meilleur exo, puis l'affiche dans un tableau triable et filtrable avec la fraîcheur des données. Tout est calculé dans le navigateur à partir de données déjà disponibles : l'index local des objets (`brisage-items.json`), les prix d'objets (carnet personnel ou prix partagés), les prix de runes et les coefficients (locaux + partagés). Aucune nouvelle table ni route Worker n'est nécessaire pour l'essentiel. L'accès est réservé au propriétaire par un réglage conservé dans son navigateur ; l'ouverture à tous est une dernière phase optionnelle.

## Technical Context

**Language/Version**: TypeScript (React 18, Vite), tel que dans le dépôt

**Primary Dependencies**: aucune nouvelle (React, react-router, Vitest + Testing Library existants)

**Storage**: lecture seule de l'IndexedDB (prix d'objets personnels, carnets de runes) et du `localStorage` (coefficients) ; un nouveau réglage `localStorage` pour l'accès ; phase optionnelle : la table `site_settings` D1 existante

**Testing**: Vitest (`tests/unit`, `tests/integration`), comme les specs 060 à 070

**Target Platform**: navigateur de bureau d'abord, mobile lisible

**Project Type**: application web (front React + Workers Cloudflare)

**Performance Goals**: tri ou filtre appliqué en moins d'une seconde avec plusieurs milliers de lignes (SC-003) ; premier affichage du classement en quelques secondes

**Constraints**: mêmes formules que la fiche (aucune règle de calcul dupliquée) ; aucune valeur inventée ; données manquantes signalées ; le classement ne s'exécute pas du tout pour un visiteur non autorisé

**Scale/Scope**: environ 4 000 équipements dans l'index (≈ 1 Mo), de quelques dizaines à quelques milliers d'objets avec un prix connu

## Constitution Check

*Porte à passer avant la recherche ; revérifiée après la conception.*

| Principe | Évaluation |
|----------|------------|
| I. Données traçables | OK. Chaque colonne de fraîcheur cite la date de sa source (prix, runes, coefficient) ; une donnée absente ou périmée est dite telle. |
| II. Correction avant optimisation | OK. Le calcul d'une ligne appelle les fonctions existantes ; tests unitaires de comparaison avec la fiche (SC-002) et des cas limites (prix manquant, seuil > 100 %). |
| III. Décisions explicables | OK. Le classement montre prix retenu et source, meilleur choix, seuil ; la colonne exo précise qu'une seule rune est déduite ; l'estimation sans coefficient est dite telle. |
| IV. Petits changements cohérents | OK sous réserve : un module de domaine, un hook de chargement, un composant ; pas de refonte de `BrisagePage`. La phase « ouvrir à tous » est isolée et optionnelle. |
| V. Données utilisateur | OK. Seul un indicateur d'accès est ajouté au `localStorage` ; rien n'est envoyé. |
| Contraintes projet | OK. Sources de données isolées derrière les dépôts existants ; échec de lecture = classement incomplet signalé. |

Aucune violation : la section « Suivi de la complexité » reste vide.

## Structure du projet

### Documentation (cette fonctionnalité)

```text
specs/072-classement-brisage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── classement-ui.md
└── tasks.md          # créé par /speckit-tasks
```

### Code source (racine du dépôt)

```text
src/
├── domain/
│   └── brisage-ranking.ts            # NOUVEAU : lignes, tri, filtres, exo, fraîcheur (pur, sans React)
├── persistence/
│   ├── brisage-ranking-access.ts     # NOUVEAU : réglage d'accès (localStorage) + activation par l'adresse
│   └── brisage-coefficients.ts       # + listStoredCoefficients(serverId)
├── features/brisage/
│   ├── BrisagePage.tsx               # + sélecteur d'onglets Fiche / Classement, état des filtres remonté
│   ├── RankingTab.tsx                # NOUVEAU : tableau, filtres, indicateurs de fraîcheur
│   └── useRankingData.ts             # NOUVEAU : chargement des prix d'objets, de runes et des coefficients
└── styles/global.css                 # + styles du classement (même charte que le tableau de la fiche)

tests/
├── unit/brisage-ranking.test.ts
├── unit/brisage-ranking-access.test.ts
└── integration/brisage-ranking-tab.test.tsx
```

Phase optionnelle « ouvrir à tous » (à confirmer avec le propriétaire avant de la lancer) : `src/domain/site-settings.ts`, `worker/src/site-settings.ts`, `admin-worker/src/settings.ts`, `admin/SiteSettingsEditor.tsx` (un réglage booléen `brisageRanking`, hors liste des pages).

**Structure Decision**: projet web existant, une seule application front ; le domaine reste pur et testable à part (principe de séparation données / règles / présentation).

## Conception en bref

1. **Source des objets** : l'index `brisage-items.json` (déjà utilisé par `ItemFinder`) donne id, nom, niveau, catégorie, image et lignes avec leurs bornes. Aucune lecture objet par objet.
2. **Prix d'objet** : mode personnel = `pinnedItemPrices.listAllForServer` (prix + `updatedAt`) ; mode communautaire = `getSharedItemPrices` (prix + `contributedAt`). Pas de coût de craft dans cette version.
3. **Prix de runes** : mêmes sources que `useRunePrices`, avec la date de chaque prix en plus.
4. **Coefficients** : coefficients locaux (liste complète du serveur) et coefficients partagés lus par paquets de 96 (`getSharedCoefficients`), le plus récent l'emporte (`latestCoefficient`), avec sa date.
5. **Calcul d'une ligne** : jets moyens (`averageRoll`) des lignes fusionnées par stat.
   - Coefficient connu : `analyzeBrisage` donne meilleur choix, gain, seuil (`thresholdCoefficient` / `focusThresholdCoefficient`).
   - Coefficient inconnu : `analyzeFocusAdvice` donne `normalBreakEven` / `focusBreakEven` ; le seuil retenu est celui du meilleur choix ; au-dessus de 100 % l'objet est « jamais rentable ».
   - Exo : pour chaque stat absente de l'objet dont la rune a un prix, une ligne `exo` de valeur 1 est ajoutée ; gain avec exo = gain obtenu − prix d'une rune de cette stat ; l'exo n'est recommandé que s'il dépasse le gain sans exo.
6. **Tri et filtres** : fonctions pures sur les lignes déjà calculées (le calcul lourd n'est refait que si les prix, coefficients ou le serveur changent). Valeurs inconnues toujours à la fin.
7. **Onglets** : `BrisagePage` garde la fiche telle quelle ; l'onglet Classement est monté seulement si l'accès est autorisé. Les filtres et le tri sont conservés dans `BrisagePage` pour survivre à un aller-retour vers la fiche.
8. **Accès** : un indicateur `localStorage` ; il s'active en ouvrant la page Brisage avec `?classement=1` dans l'adresse (et se retire avec `?classement=0`). Ce n'est pas une authentification (limite acceptée par la spec).

## Risques et points ouverts

- **Nombre de lectures de coefficients** : environ une requête par 96 objets ; acceptable tant que seuls les objets avec prix sont interrogés. Si le volume gêne, ajouter plus tard une lecture groupée côté Worker.
- **Coût du calcul d'exo** : une analyse par stat candidate et par objet. À mesurer ; repli prévu : calculer l'exo en différé ou seulement pour les lignes visibles.
- **Écart avec la fiche** : lignes négatives non lues par l'index (écart minime, signalé dans la spec).
- **Ouverture à tous** : demande un réglage partagé ; phase finale séparée, à lancer seulement sur confirmation du propriétaire.
