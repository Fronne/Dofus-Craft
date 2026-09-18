# Implementation Plan: Partage communautaire des prix

**Branch**: `004-community-price-sharing` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-community-price-sharing/spec.md`

## Summary (révision 5)

**Révision 5** ajoute un identifiant d'appareil anonyme (`deviceId`), généré et conservé localement
(`localStorage`), transmis avec chaque contribution et stocké aux côtés de `resource_id`/`server_id`/
`amount_kamas` dans la table D1 existante. Approche technique minimale (principe IV) : un seul
nouveau module côté client (`src/persistence/community-device-id.ts`, `getOrCreateDeviceId()`), dont
`submitCommunityPrice` se sert en interne — sa signature publique ne change pas, donc aucun de ses
appelants (`useCommunityPrice.ts`, `RecherchePage.tsx`) n'a besoin d'être modifié. Côté backend, une
seule colonne `device_id` ajoutée à `community_price_contributions` (nouvelle migration D1, la table
contenant déjà des lignes en production) et un champ obligatoire supplémentaire dans le payload
validé par `handlePostContribution`. `computeCommunityMedian`/`handleGetCommunityPrice` ne changent
pas : cette révision n'affecte ni le calcul ni l'affichage du prix communautaire (FR-023).

Le Mode communautaire reste désactivé (`COMMUNITY_MODE_ENABLED = false`,
`src/domain/price-modes.ts`) pendant cette révision — sans lien avec la portée de cette spec : c'est
un interrupteur d'affichage temporaire, indépendant de ce qui est développé derrière.

## Summary (révision 4, pour mémoire — inchangée par la révision 5)

**Révision 4** d'une fonctionnalité déjà implémentée et déployée à trois reprises (voir
[quickstart.md, section « Résultat de l'exécution »](./quickstart.md)). Elle retire le bouton de
partage groupé des Paramètres (introduit en révision 1, maintenu par la révision 2) et le remplace
par une transmission automatique et implicite, par ressource : dès qu'un joueur en Mode
communautaire termine la modification d'un prix de ressource (perte de focus après une valeur
réellement changée), cette valeur est envoyée comme nouvelle contribution, le champ affiche ensuite
la médiane communautaire recalculée, et le nombre de contributions affiché s'incrémente. Un blur
sans changement de valeur (ex. cliquer sur le bouton de déverrouillage puis ressortir du champ sans
rien taper) ne déclenche ni envoi ni incrémentation. Une transmission qui échoue reste silencieuse :
la valeur reste utilisable localement et une nouvelle tentative n'a lieu qu'à la prochaine
modification confirmée du même champ.

Le backend (Worker Cloudflare + D1, `worker/src/index.ts`, `worker/src/median.ts`) **ne change pas
du tout** dans cette révision : les mêmes routes `GET`/`POST /community-price` (déjà réduites par la
révision 2) et la même fonction `submitCommunityPrice` sont réutilisées telles quelles — seul change
le point d'appel côté client (avant : une boucle depuis les Paramètres sur tout le carnet Mode
personnel ; maintenant : un appel par ressource, déclenché depuis le champ de prix lui-même en Mode
communautaire). Aucun redéploiement du Worker n'est nécessaire pour cette révision. Approche
technique : réutiliser `submitCommunityPrice`/`getCommunityPrice` et le mécanisme de verrouillage
déjà en place (révision 3, FR-016) plutôt que d'ajouter un nouveau composant ou une nouvelle route
(principe IV) — le bouton de déverrouillage existant devient, de fait, le seul geste de confirmation
nécessaire avant tout envoi.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS (frontend) + TypeScript sur runtime Cloudflare
Workers pour le backend (`worker/`, tsconfig et typage `@cloudflare/workers-types` séparés du
frontend). Inchangé par cette révision.

**Primary Dependencies**: React 19, Vite, Vitest, React Testing Library, Playwright ; `wrangler` et
`@cloudflare/workers-types` en dépendances de développement pour le Worker. Aucune nouvelle
dépendance introduite par cette révision : `crypto.randomUUID()` (déjà utilisé par
`worker/src/index.ts` pour l'`id` de chaque contribution) est réutilisé côté client pour générer le
`deviceId`, disponible nativement dans tous les navigateurs ciblés sans polyfill.

**Storage (révision 5)** : une nouvelle clé `localStorage`, `craftcheck-community-device-id`, stocke
l'identifiant d'appareil (chaîne UUID), lue/écrite par `getOrCreateDeviceId()`
(`src/persistence/community-device-id.ts`) selon le même pattern que
`src/persistence/pinned-items.ts`/`server-preference.ts` (try/catch autour de chaque accès
`localStorage`, jamais d'exception propagée). Côté D1, la table `community_price_contributions`
gagne une colonne `device_id TEXT NOT NULL DEFAULT ''` : une migration (`worker/migrations/0001_add_device_id.sql`)
l'ajoute aux ~95 lignes déjà en production (`ALTER TABLE ... ADD COLUMN`, ni idempotent ni rejouable
— exécutée une seule fois, voir quickstart.md) ; `worker/schema.sql` gagne la même colonne dans son
`CREATE TABLE IF NOT EXISTS`, pour qu'une base fraîchement créée l'ait dès l'origine. Les deux stores
IndexedDB (Mode personnel/Mode communautaire) restent inchangés — cette révision ne les concerne pas.

**Testing**: Vitest + React Testing Library. **Pour cette révision** : nouveau
`tests/unit/community-device-id.test.ts` (génère un identifiant au premier appel, le réutilise aux
appels suivants, généré différemment par appareil/instance de stockage, dégrade proprement si
`localStorage` est indisponible — même style que `tests/unit/server-preference.test.ts`) ; extension
de `tests/unit/community-price-api.test.ts` : la requête `POST` envoyée par `submitCommunityPrice`
inclut désormais un `deviceId` (chaîne non vide) dans son corps JSON, en plus de
`resourceId`/`serverId`/`amountKamas`. Aucun test existant sur `getCommunityPrice` ni sur
`computeCommunityMedian` n'est affecté (aucun des deux n'est touché par cette révision). Le handler
`worker/src/index.ts` n'a pas de suite de tests dédiée dans ce dépôt (seul `median.ts` en a une,
importée directement par `tests/unit/community-price-median.test.ts`) — cohérent avec l'état actuel,
non étendu par cette révision.

**Target Platform**: Navigateurs modernes sur ordinateur et mobile, application web statique
(inchangé) ; Worker Cloudflare + D1 existant, non redéployé pour cette révision.

**Project Type**: Application web monopage côté client avec un backend applicatif minimal existant
(Worker Cloudflare). Inchangé par cette révision.

**Performance Goals**: La transmission puis le réaffichage de la médiane après un commit doivent
rester perçus comme immédiats dans l'usage courant (SC-010 : incrémentation visible du nombre de
contributions en moins de 2 secondes après la perte de focus), cohérent avec l'échelle réelle visée
(Scale/Scope ci-dessous) — pas de cible chiffrée stricte au-delà de cette perception d'immédiateté.

**Constraints**: Une contribution n'est transmise que par un geste explicite et conscient du joueur
(déverrouiller un champ protégé, ou saisir un premier prix dans un champ vide, puis en sortir après
l'avoir réellement modifié) — jamais par un minuteur, un chargement de page, un changement de mode
ou de serveur, ni par un blur sans changement de valeur (FR-017/FR-020) ; les deux carnets de prix
restent strictement indépendants (FR-005, inchangé) ; le mode personnel reste inchangé et sans aucun
appel réseau lié aux prix (FR-015, inchangé). **Révisée en révision 5** : une contribution ne doit
contenir aucune information identifiant personnellement un joueur, mais MUST désormais inclure un
`deviceId` anonyme (FR-010/FR-021 à FR-023) — le `deviceId` n'est jamais affiché à un joueur, ni
utilisé pour filtrer, pondérer ou modifier le calcul de la médiane (FR-023).

**Scale/Scope**: Public restreint (~10-20 joueurs, cf. spec.md/Assumptions) ; cette révision ne
change ni le volume de contributions attendu (chaque correction en produisait déjà une, groupée par
lot ; elle en produit maintenant une immédiatement, ressource par ressource) ni les plafonds
Cloudflare D1/Workers déjà très loin d'être approchés (research.md, inchangé).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Plan response |
|------|--------|----------------|
| I. Données de jeu exactes et traçables | PASS | Inchangé : un prix communautaire absent laisse le champ vide (FR-002) ; le nombre de contributions retenues reste affiché et s'incrémente visiblement après chaque envoi réussi (FR-007/FR-019), rendant la provenance du prix affiché toujours vérifiable. |
| II. Calculs corrects et testables | PASS | Inchangé : le calcul de rentabilité utilise exclusivement le carnet du mode actif (FR-005) ; la médiane recalculée après un envoi provient du même Worker/`median.ts` déjà testé, non rouvert par cette révision. |
| III. Résultats explicables | PASS | Le geste qui déclenche l'envoi (déverrouiller puis modifier le champ) est le même geste que celui qui affiche immédiatement le résultat (médiane à jour, compteur incrémenté) au même endroit — le joueur voit toujours la conséquence de son action à l'endroit exact où il vient d'agir, sans action séparée à chercher dans les Paramètres. |
| IV. Changements cohésifs | PASS | Cette révision retire une section entière de `ParametresPage.tsx` (bouton, état `ShareResult`, `handleShareAll`/`shareEntries`/`handleRetryFailed`) et son import de `submitCommunityPrice`/`prices`, sans ajouter de nouveau composant ni de nouvelle route : `submitCommunityPrice`/`getCommunityPrice` sont réutilisées telles quelles depuis un unique nouveau point d'appel (`ResourcePriceInput` via `CommunityResourcePriceRow`). |
| V. Données utilisateur sûres | PASS | L'écran de confirmation explicite du partage groupé disparaît, mais l'action reste déclenchée uniquement par un geste conscient du joueur sur un champ précis (jamais un minuteur, un chargement de page ou un changement de mode) — ce n'est pas un envoi automatique « en continu » au sens où l'entend spec.md/Input, c'est la conséquence immédiate d'une saisie que le joueur vient de faire lui-même (FR-009 révisée). L'anonymat structurel des contributions (FR-010) et l'absence de retrait rétroactif individuel (révision 2, inchangée) ne sont pas affectés. La granularité plus fine (une ressource à la fois, plutôt que tout le carnet personnel d'un coup) réduit d'ailleurs l'impact d'une action non désirée par rapport à l'ancien partage groupé. |

**Post-design re-check (révision 4)**: PASS. Les artefacts de conception mis à jour (`data-model.md`,
`contracts/community-price-api.md`) confirment que le backend n'est pas modifié, que
`submitCommunityPrice`/`getCommunityPrice` gardent leurs signatures actuelles, et qu'aucune
abstraction nouvelle n'est introduite au-delà d'un prop `onCommit` sur `ResourcePriceInput` et d'une
fonction `commit` exposée par `useCommunityPrice` — cohérent avec le principe IV.

### Constitution Check (révision 5)

| Gate | Status | Plan response |
|------|--------|----------------|
| I. Données de jeu exactes et traçables | PASS | Sans effet : le `deviceId` n'est ni affiché ni utilisé pour le calcul du prix communautaire (FR-023) — la traçabilité du prix affiché (nombre de contributions, FR-007) reste identique. |
| II. Calculs corrects et testables | PASS | `computeCommunityMedian` n'est pas touché ; le nouveau `getOrCreateDeviceId()` est une fonction pure et testable (lecture/écriture `localStorage`), couverte par un test dédié. |
| III. Résultats explicables | PASS | Aucun changement d'affichage ou de comportement perçu par le joueur (FR-023) : cette révision est entièrement invisible côté parcours utilisateur. |
| IV. Changements cohésifs | PASS | Un seul nouveau module côté client (`community-device-id.ts`), une seule colonne côté serveur ; `submitCommunityPrice` résout le `deviceId` en interne plutôt que d'en faire un nouveau paramètre exposé à ses appelants — aucun appelant existant (`useCommunityPrice.ts`, `RecherchePage.tsx`) n'a besoin d'être modifié. |
| V. Données utilisateur sûres | PASS | FR-010 révisée reste stricte sur l'absence de toute donnée identifiant personnellement le joueur ; le `deviceId` est un identifiant technique anonyme, généré et conservé localement, jamais transmis à un autre joueur ni combiné à une identité réelle — cohérent avec le public restreint et de confiance déjà visé (spec.md/Assumptions). |

**Post-design re-check (révision 5)**: PASS. `data-model.md` et `contracts/community-price-api.md`
mis à jour confirment que `submitCommunityPrice` garde sa signature publique, qu'aucune route HTTP
n'est ajoutée ou renommée (seul le corps du `POST /community-price` existant gagne un champ), et que
la migration D1 est un ajout de colonne rétrocompatible (valeur par défaut vide pour les lignes déjà
en production) plutôt qu'une refonte de schéma.

## Project Structure

### Documentation (this feature)

```text
specs/004-community-price-sharing/
├── plan.md                              # This file (/speckit-plan command output)
├── research.md                          # Phase 0 output (/speckit-plan command)
├── data-model.md                        # Phase 1 output (/speckit-plan command)
├── quickstart.md                        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── community-price-api.md           # Phase 1 output (/speckit-plan command)
└── tasks.md                             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root) — révision 4 (pour mémoire, déjà implémentée)

```text
worker/                                   # Non touché par cette révision (aucun redéploiement requis)
└── src/
    ├── index.ts                          # Inchangé : GET/POST /community-price, réutilisées telles quelles
    └── median.ts                         # Inchangé

src/
├── services/
│   └── community-price-api.ts            # Inchangé : getCommunityPrice/submitCommunityPrice, mêmes signatures, nouveau consommateur seulement
├── features/
│   ├── comparison/
│   │   ├── ResourcePriceInput.tsx        # Ajoute un prop optionnel `onCommit?: (value: string) => void`, appelé depuis le onBlur existant, seulement quand `lockWhenFilled` est actif ET que la valeur a réellement changé depuis le déverrouillage (comparaison avec une ref capturée à l'ouverture de l'édition) — jamais sur un blur sans changement (FR-020)
│   │   └── useCommunityPrice.ts          # Retourne désormais `[state, commit]` : `commit(amountKamas)` appelle `submitCommunityPrice` puis ré-exécute le même chargement qu'au montage/rafraîchissement périodique, sans rien faire en cas d'échec (FR-020) ; commentaire de renvoi FR corrigé (référençait par erreur un ancien FR-017 devenu obsolète — pointe maintenant vers FR-014)
│   ├── search/
│   │   └── RecherchePage.tsx             # `CommunityResourcePriceRow` relie `onCommit` à `commit` : sur succès, écrit la médiane recalculée dans le carnet Mode communautaire via le même `onChange` que la saisie normale (dépassant volontairement la garde anti-écrasement de FR-006, qui ne vise que les rafraîchissements automatiques en arrière-plan, pas cette réécriture consécutive à l'action du joueur) ; commentaire de renvoi FR corrigé (référençait par erreur un ancien FR-018 devenu obsolète — pointe maintenant vers FR-015)
│   └── settings/
│       └── ParametresPage.tsx            # Retire entièrement la section « Partage communautaire » : le bouton, l'état `ShareResult`, `handleShareAll`/`shareEntries`/`handleRetryFailed`, et les imports `submitCommunityPrice`/`prices` devenus sans appelant dans ce fichier
└── main.tsx

tests/
├── unit/
│   └── resource-price-input.test.tsx     # Étendu : nouveaux cas pour `onCommit` (appelé seulement sur changement réel, jamais sur blur sans changement)
├── integration/
│   ├── community-bulk-share.test.tsx     # Retiré (mécanisme supprimé)
│   ├── community-consent.test.tsx        # Retiré (son affirmation — « modifier ne transmet jamais rien » — est désormais fausse)
│   └── community-auto-share.test.tsx     # Nouveau : lecture/pré-remplissage ne transmet jamais rien ; un commit avec changement transmet et rafraîchit la médiane affichée ; un blur sans changement ne transmet rien ; un échec de transmission laisse la valeur locale intacte sans blocage
└── e2e/
    └── community-price-sharing.spec.ts   # Adapté : plus de scénario « bouton de partage groupé dans les Paramètres », remplacé par un scénario de modification directe d'un champ de prix en Mode communautaire
```

**Structure Decision (révision 4)**: Aucun nouveau fichier de production, aucune nouvelle route
serveur : cette révision déplace un comportement existant (`submitCommunityPrice`) d'un point
d'appel groupé (Paramètres) vers un point d'appel par ressource (le champ de prix lui-même), en
réutilisant le mécanisme de verrouillage déjà en place depuis la révision 3. Le seul fichier de test
nouvellement créé est `community-auto-share.test.tsx`, qui remplace deux fichiers retirés.

### Source Code (repository root) — révision 5

```text
worker/
├── migrations/
│   └── 0001_add_device_id.sql            # Nouveau : ALTER TABLE ... ADD COLUMN device_id, à exécuter une fois sur la base de production (voir quickstart.md)
├── schema.sql                            # Colonne device_id ajoutée au CREATE TABLE IF NOT EXISTS (bases fraîches uniquement — n'affecte pas la base déjà créée)
└── src/
    └── index.ts                          # ContributionPayload gagne deviceId (string non vide, validé) ; l'INSERT écrit device_id ; median.ts et GET /community-price inchangés

src/
├── persistence/
│   └── community-device-id.ts            # Nouveau : getOrCreateDeviceId() — lit/écrit `craftcheck-community-device-id` dans localStorage, génère un crypto.randomUUID() au premier appel, dégrade proprement (identifiant non persistant, jamais d'exception) si localStorage est indisponible
└── services/
    └── community-price-api.ts            # submitCommunityPrice appelle getOrCreateDeviceId() en interne et ajoute deviceId au corps JSON du POST ; signature publique inchangée, getCommunityPrice non touché

tests/
└── unit/
    ├── community-device-id.test.ts       # Nouveau : génération au premier appel, réutilisation aux appels suivants, dégradation propre sans localStorage
    └── community-price-api.test.ts       # Étendu : le corps du POST envoyé par submitCommunityPrice inclut un deviceId non vide
```

**Structure Decision (révision 5)**: Un seul nouveau module de production côté client
(`community-device-id.ts`), une seule colonne côté serveur, aucune nouvelle route et aucune
signature publique modifiée — `submitCommunityPrice` résout le `deviceId` en interne, ce qui évite de
propager un nouveau paramètre à travers `useCommunityPrice.ts` et `RecherchePage.tsx` (principe IV).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier, ni pour la révision 4 (qui retire une section entière de
`ParametresPage.tsx` et n'ajoute qu'un prop optionnel et une valeur de retour supplémentaire à un
hook déjà existant — solde net négatif en lignes de code de production) ni pour la révision 5 (un
module de production, une colonne, zéro nouvelle dépendance, zéro signature publique modifiée). Les
décisions d'infrastructure (choix du backend, modélisation de la contribution, fréquence de
rafraîchissement, isolation des deux carnets) restent valables et ne sont pas rouvertes ici.
