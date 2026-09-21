# Implementation Plan: Confirmation des valeurs de coût de craft aberrantes

**Branch**: `007-outlier-confirmation` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-outlier-confirmation/spec.md`

## Summary

En Mode communautaire, avant qu'un prix de ressource modifié ne soit transmis comme contribution,
le champ compare la valeur saisie à la médiane communautaire déjà connue côté client
(`useCommunityPrice`, déjà chargée pour l'affichage — aucun nouvel appel réseau pour cette
comparaison). Si l'écart dépasse 25 %, une boîte de dialogue HTML native (`<dialog>`, sans nouvelle
dépendance) bloque l'envoi jusqu'à ce que le joueur confirme ou annule ; une annulation restaure la
valeur précédente du champ. Côté serveur, le Worker (`worker/src/index.ts`) recalcule
indépendamment, à chaque contribution reçue, la médiane et l'écart à partir des contributions déjà
stockées (avant l'insertion), et les enregistre comme deux colonnes supplémentaires sur la ligne
insérée dans la table D1 existante — aucune nouvelle table, aucune nouvelle route, aucun changement
du corps JSON envoyé par le client. La trace des valeurs aberrantes (FR-009) est donc une simple vue
filtrée (`deviation_percent > 25`) de la table déjà existante, consultable directement en SQL par un
membre du groupe (cf. spec.md/Assumptions — pas d'interface de modération dédiée dans cette
révision).

## Révision 2026-09-21 (bis) : ne plus écraser la saisie du joueur après transmission

Cette feature a été entièrement implémentée une première fois (voir `tasks.md`, T001-T016, et le
« Résultat de l'exécution » de `quickstart.md`) sur la base du comportement alors spécifié par
specs/004-community-price-sharing (FR-018) : après toute transmission réussie — y compris après une
confirmation d'écart de cette feature — le champ affichait la médiane communautaire recalculée à la
place de la valeur saisie par le joueur.

Suite à un retour du joueur (« son prix est le vrai prix qui va servir au calcul »), specs/004 a été
amendée (FR-018, révision 6) et specs/007 complétée (FR-012) : le champ doit désormais continuer
d'afficher la valeur saisie par le joueur après une transmission réussie, quel que soit le chemin
(direct, ou après confirmation d'écart). Cette section documente l'impact de ce changement sur la
conception déjà livrée par cette feature ; le détail des tâches d'implémentation correspondantes est à
regénérer via `/speckit-tasks`.

**Ce qui change dans `RecherchePage.tsx`** (`CommunityResourcePriceRow.handleCommit`) : l'appel à
`commit(amount)` reste inchangé (il transmet toujours la contribution et rafraîchit le cache
`useCommunityPrice`, gardant à jour le nombre de contributions affiché, FR-019 de specs/004), mais son
résultat n'est plus repassé à `onChange` du champ. Concrètement, la ligne `if (refreshed?.kind ===
'found') onChange(String(refreshed.price.medianAmountKamas));` est supprimée ; le carnet Mode
communautaire garde la valeur que le joueur venait d'écrire (déjà présente via l'`onChange` de chaque
frappe, specs/004).

**Ce qui ne change pas** : le préremplissage initial (`onPrefill`, quand `!hasCarnetEntry`) continue
d'utiliser la médiane ; le gate de confirmation d'écart (FR-001 à FR-005 de cette feature) continue de
comparer la saisie à la médiane déjà chargée, sans lien avec ce changement d'affichage post-commit.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS (frontend) + TypeScript sur runtime Cloudflare
Workers pour le backend (`worker/`, tsconfig et typage `@cloudflare/workers-types` séparés du
frontend, sans lien de build entre les deux — cohérent avec specs/004-006). Inchangé par cette
fonctionnalité.

**Primary Dependencies**: React 19, Vite, Vitest, React Testing Library, Playwright ; `wrangler` et
`@cloudflare/workers-types` en dépendances de développement pour le Worker. Aucune nouvelle
dépendance introduite : la confirmation utilise l'élément HTML natif `<dialog>`
(`showModal()`/`close()`, méthode DOM standard déjà disponible dans tous les navigateurs modernes
ciblés par le projet), pas de bibliothèque de composants modaux.

**Storage**: Cloudflare D1 (SQLite), table `community_price_contributions` déjà existante
(specs/004). Deux colonnes nullables ajoutées : `median_at_submission_kamas` (médiane connue par le
serveur juste avant l'insertion de cette ligne, `NULL` pour la toute première contribution d'une
ressource/serveur) et `deviation_percent` (écart en pourcentage entre `amount_kamas` et cette
médiane, `NULL` dans le même cas). Migration additive (`ALTER TABLE ... ADD COLUMN`), suivant le
même pattern que `worker/migrations/0001_add_device_id.sql` et `0002_add_app_visits.sql`. Les deux
stores IndexedDB (Mode personnel/Mode communautaire) et `localStorage` (device id) ne sont pas
concernés.

**Testing**: Vitest + React Testing Library pour les fonctions pures et les composants ; Playwright
pour le scénario bout-en-bout. Nouveau `tests/unit/outlier-threshold.test.ts` (fonction pure côté
client) et `tests/unit/community-price-outlier.test.ts` (fonction pure côté Worker, même pattern que
`tests/unit/community-price-median.test.ts` qui importe déjà `worker/src/median.ts` directement) ;
extension de `tests/integration/community-auto-share.test.tsx` pour les scénarios de confirmation/
annulation ; aucun changement aux tests existants sur `getCommunityPrice`/`computeCommunityMedian`.

**Target Platform**: Navigateurs modernes sur ordinateur et mobile, application web statique
(inchangé) ; Worker Cloudflare + D1 existant, migration à exécuter une fois en production (voir
quickstart.md), sans changement de route.

**Project Type**: Application web monopage côté client avec un backend applicatif minimal existant
(Worker Cloudflare). Inchangé.

**Performance Goals**: La comparaison à la médiane et l'affichage de la confirmation doivent rester
perçus comme immédiats (pas d'appel réseau supplémentaire côté client avant l'affichage du dialogue :
la médiane déjà chargée par `useCommunityPrice` suffit). Le calcul serveur ajoute une lecture D1
avant l'écriture existante — négligeable à l'échelle visée (Scale/Scope ci-dessous).

**Constraints**: Le mécanisme reste strictement limité au Mode communautaire (FR-011) ; il ne doit ni
modifier le calcul ou l'affichage de la médiane agrégée (FR-010) ni introduire de filtrage
automatique des contributions (Assumptions, modération automatique hors périmètre) ; aucune
information identifiant personnellement le joueur n'est ajoutée (les nouvelles colonnes ne
contiennent que des montants et un pourcentage, l'identifiant d'appareil déjà stocké depuis
specs/004 servant, sans changement, à repérer un pattern répété).

**Scale/Scope**: Public restreint (~10-20 joueurs, cf. specs/004/spec.md Assumptions, repris par
specs/007/spec.md) ; le volume de lignes ajoutées reste celui des contributions déjà existantes (une
lecture D1 en plus par écriture), très loin des plafonds Cloudflare D1/Workers déjà écartés en
recherche pour specs/004.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Plan response |
|------|--------|----------------|
| I. Données de jeu exactes et traçables | PASS | La médiane affichée reste exactement celle déjà calculée par `computeCommunityMedian` (FR-010) ; les nouvelles colonnes ne font qu'ajouter une trace de contexte au moment de l'insertion, sans jamais être lues pour l'affichage d'un prix. |
| II. Calculs corrects et testables | PASS | L'écart est une fonction pure (`|valeur − médiane| / médiane × 100`, FR-002), testée indépendamment côté client (décision du joueur d'afficher ou non la confirmation) et côté serveur (valeur enregistrée dans la trace) — deux implémentations volontairement séparées car ce sont deux runtimes indépendants (voir research.md), chacune couverte par ses propres tests unitaires. |
| III. Résultats explicables | PASS | La boîte de dialogue affiche explicitement les trois valeurs qui motivent la demande de confirmation (médiane, valeur saisie, écart — FR-005), au même endroit où le joueur vient d'agir, sans navigation séparée. *(Renforcé révision bis, FR-012/FR-018 amendée)* : après transmission, le champ distingue désormais clairement la valeur saisie par le joueur (conservée) de la médiane communautaire (jamais utilisée pour l'écraser), conformément au principe « distinguer les valeurs saisies par l'utilisateur des valeurs dérivées ». |
| IV. Changements cohésifs | PASS | Aucune nouvelle table, aucune nouvelle route HTTP, aucune nouvelle dépendance ; le seul nouveau composant de production côté client est une boîte de dialogue `<dialog>` colocalisée avec `CommunityResourcePriceRow`, son seul appelant. Le calcul serveur réutilise la requête déjà écrite pour `handleGetCommunityPrice` (extraite en une fonction partagée) plutôt que de la dupliquer. |
| V. Données utilisateur sûres | PASS | Aucune nouvelle donnée identifiant personnellement le joueur ; l'enregistrement d'une valeur aberrante confirmée nécessite un geste explicite et conscient (bouton « Enregistrer quand même »), jamais automatique — cohérent avec FR-004/FR-006/FR-007 et avec le principe déjà établi en specs/004 (aucun envoi sans action consciente du joueur). |

**Post-design re-check**: PASS. Les artefacts de conception (`data-model.md`,
`contracts/outlier-confirmation-api.md`) confirment qu'aucune signature publique existante
(`submitCommunityPrice`, `getCommunityPrice`) ne change, que la migration D1 est un ajout de colonnes
rétrocompatible (valeurs `NULL` par défaut pour les lignes déjà en production), et que le nouveau
composant de dialogue est un ajout localisé sans nouvelle abstraction partagée au-delà d'un hook
`useOutlierConfirm` à un seul appelant. *(Révision bis)* : la suppression de la réécriture du champ par
la médiane recalculée après commit est une simplification (une ligne de code retirée dans
`RecherchePage.tsx`), sans nouvelle abstraction ni nouveau composant — gate IV toujours au vert.

## Project Structure

### Documentation (this feature)

```text
specs/007-outlier-confirmation/
├── plan.md                              # This file (/speckit-plan command output)
├── research.md                          # Phase 0 output (/speckit-plan command)
├── data-model.md                        # Phase 1 output (/speckit-plan command)
├── quickstart.md                        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── outlier-confirmation-api.md      # Phase 1 output (/speckit-plan command)
└── tasks.md                             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
worker/
├── migrations/
│   └── 0003_add_outlier_tracking.sql     # Nouveau : ALTER TABLE ... ADD COLUMN median_at_submission_kamas, deviation_percent (nullable), à exécuter une fois sur la base de production (voir quickstart.md)
├── schema.sql                            # Les deux colonnes ajoutées au CREATE TABLE IF NOT EXISTS (bases fraîches uniquement)
└── src/
    ├── outlier.ts                        # Nouveau : computeDeviationPercent(value, median), OUTLIER_THRESHOLD_PERCENT = 25 — fonction pure, testée isolément (même pattern que median.ts)
    └── index.ts                          # handleGetCommunityPrice et handlePostContribution partagent désormais une fonction extraite `fetchCurrentMedian(env, resourceId, serverId)` (même requête SQL + computeCommunityMedian qu'aujourd'hui, factorisée) ; handlePostContribution l'appelle avant l'INSERT pour calculer median_at_submission_kamas/deviation_percent (via outlier.ts) et les écrit sur la ligne insérée ; ContributionPayload et la route ne changent pas

src/
├── domain/
│   └── outlier-threshold.ts              # Nouveau : computeDeviationPercent(value, median), OUTLIER_THRESHOLD_PERCENT = 25 — même formule que worker/src/outlier.ts, dupliquée volontairement (deux runtimes indépendants sans lien de build, voir research.md), testée isolément côté client
└── features/
    └── comparison/
        ├── OutlierConfirmDialog.tsx      # Nouveau : hook useOutlierConfirm() (état + <dialog> natif) exposant confirmOutlier(details): Promise<boolean> et l'élément <dialog> à rendre ; affiche médiane, valeur saisie, écart (FR-005) et les deux boutons Annuler/Enregistrer quand même
        └── ResourcePriceInput.tsx        # onCommit change de contrat : (value: string) => Promise<'accepted' | 'rejected'> | void — sur 'rejected', le champ revient à lastCommittedValueRef.current (déjà suivi en interne, FR-007) via le onChange existant ; comportement inchangé quand onCommit ne renvoie rien (aucun autre appelant aujourd'hui)

src/features/search/RecherchePage.tsx     # CommunityResourcePriceRow : handleCommit calcule l'écart via outlier-threshold.ts contre communityState.price.medianAmountKamas déjà chargé ; si l'écart dépasse le seuil, attend confirmOutlier() avant d'appeler commit() ; renvoie 'rejected' sans rien transmettre si le joueur annule ; comportement inchangé sous le seuil ou sans médiane connue (FR-008) ; MODIFIÉ (révision bis, FR-012/FR-018) : `commit(amount)` continue d'être appelé sur tout succès (direct ou confirmé) mais son résultat n'est plus repassé à `onChange` — le champ garde la valeur saisie par le joueur au lieu de la médiane recalculée

tests/
├── unit/
│   ├── outlier-threshold.test.ts         # Nouveau : computeDeviationPercent, seuil strictement > 25 (un écart de exactement 25 % n'est pas aberrant, Edge Cases)
│   └── community-price-outlier.test.ts   # Nouveau : même pattern que community-price-median.test.ts, importe worker/src/outlier.ts directement
└── integration/
    └── community-auto-share.test.tsx     # Étendu : un commit avec écart > 25 % affiche la confirmation et ne transmet rien avant réponse ; confirmer transmet et rafraîchit la médiane comme aujourd'hui ; annuler ne transmet rien et restaure la valeur précédente du champ ; un écart ≤ 25 % ou l'absence de médiane connue transmettent directement, sans confirmation (comportement actuel inchangé)
```

**Structure Decision**: Aucune nouvelle table ni route serveur ; un seul nouveau fichier de
production côté client avec un seul appelant (`OutlierConfirmDialog.tsx`, utilisé uniquement par
`CommunityResourcePriceRow`), un seul nouveau fichier de production côté serveur
(`worker/src/outlier.ts`), et une factorisation mineure de `worker/src/index.ts` pour réutiliser la
requête de médiane déjà écrite plutôt que la dupliquer. Le contrat public de
`submitCommunityPrice`/`getCommunityPrice` ne change pas.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier : deux colonnes nullables sur une table déjà existante, une fonction
pure dupliquée entre deux runtimes indépendants (documentée en research.md plutôt que masquée
derrière un partage de code artificiel), et un seul composant de dialogue à un seul appelant. Aucune
nouvelle route, aucune nouvelle dépendance, aucune interface de modération construite au-delà de la
trace elle-même (cohérent avec Assumptions, spec.md).
