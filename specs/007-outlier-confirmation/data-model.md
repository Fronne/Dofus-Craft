# Data Model: Confirmation des valeurs de coût de craft aberrantes

## CommunityPriceContribution (extension, côté serveur)

Deux colonnes nullables ajoutées à la table `community_price_contributions` (introduite par
specs/004, étendue par sa révision 5 avec `device_id`) : voir
[specs/004-community-price-sharing/data-model.md](../004-community-price-sharing/data-model.md) pour
les champs déjà existants (`id`, `resource_id`, `server_id`, `amount_kamas`, `created_at`,
`device_id`), inchangés par cette fonctionnalité.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `median_at_submission_kamas` *(nouveau)* | entier, nullable | La médiane communautaire (`CommunityPriceMedian.medianAmountKamas`, specs/004) telle que connue par le serveur juste avant l'insertion de cette ligne, calculée à partir des contributions déjà présentes pour le même `resource_id`/`server_id`. `NULL` quand aucune médiane n'existait encore (première contribution pour ce couple ressource/serveur, FR-008). |
| `deviation_percent` *(nouveau)* | réel, nullable | `\|amount_kamas − median_at_submission_kamas\| / median_at_submission_kamas × 100` (FR-002), calculé et stocké dans la même transaction que l'insertion. `NULL` exactement quand `median_at_submission_kamas` l'est (FR-008). |

**Trace des valeurs aberrantes (FR-009)** : ce n'est pas une table séparée, mais un sous-ensemble des
lignes de `community_price_contributions` où `deviation_percent > 25` (le seuil défini par FR-003).
Comme ces deux colonnes sont déjà présentes sur chaque ligne, chaque champ requis par FR-009 (la
ressource et le serveur concernés, la médiane au moment de la saisie, la valeur saisie, l'écart en
pourcentage, l'identifiant anonyme d'appareil) est directement disponible sans jointure :
`resource_id`, `server_id`, `median_at_submission_kamas`, `amount_kamas`, `deviation_percent`,
`device_id`.

**Champs explicitement absents** : comme pour le reste de la table (specs/004, FR-010), aucun
identifiant de joueur — ces deux nouvelles colonnes ne contiennent que des montants et un
pourcentage calculés côté serveur.

**Transitions**:

1. À chaque insertion (`handlePostContribution`, déclenchée exactement comme aujourd'hui par un
   commit de champ de prix — cette fonctionnalité n'ajoute aucune nouvelle voie d'insertion), le
   serveur lit d'abord la médiane courante pour ce `resource_id`/`server_id` (même requête que
   `handleGetCommunityPrice`, factorisée), calcule `deviation_percent` si une médiane existait, puis
   écrit les deux colonnes sur la ligne insérée. Ce calcul ne modifie ni ne retarde l'insertion
   elle-même ni la réponse HTTP (`{ id }`, inchangée).
2. Ces deux colonnes ne sont jamais mises à jour après l'insertion (comme `amount_kamas`,
   `created_at`, `device_id` : une ligne, une fois écrite, ne change plus).
3. Elles ne participent jamais au calcul de `CommunityPriceMedian` (specs/004) : la requête utilisée
   par `handleGetCommunityPrice` reste `SELECT amount_kamas FROM ... WHERE resource_id = ? AND
   server_id = ? AND created_at >= ?`, inchangée par cette fonctionnalité (FR-010).

## Écart à la médiane (résultat calculé, côté client — éphémère, non stocké)

Résultat du calcul effectué par `CommunityResourcePriceRow` (`src/features/search/RecherchePage.tsx`)
à partir de la médiane déjà chargée par `useCommunityPrice` (specs/004), au moment où le joueur quitte
le champ après une modification réelle — avant tout appel à `submitCommunityPrice`.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `medianAmountKamas` | entier, tel que déjà chargé par `useCommunityPrice` (peut être légèrement âgé, cf. `REFRESH_INTERVAL_MS` de specs/004) | Référence de comparaison, affichée telle quelle dans la boîte de dialogue de confirmation (FR-005). |
| `enteredAmountKamas` | entier, valeur saisie par le joueur | Valeur candidate à la transmission. |
| `deviationPercent` | réel, `computeDeviationPercent` (`src/domain/outlier-threshold.ts`) | Décide si la confirmation doit s'afficher (`deviationPercent > 25`, FR-003) ; affiché dans la boîte de dialogue. |

**Transitions**:

1. Calculé uniquement quand `communityState.kind === 'found'` (une médiane est connue) ; absent sinon
   — dans ce cas, la valeur est transmise directement, sans comparaison (FR-008).
2. Jamais persisté côté client : il ne sert qu'à décider d'afficher ou non la boîte de dialogue de
   confirmation pour ce commit précis, et disparaît une fois la réponse du joueur obtenue.

## Relationships

```text
Commit d'un champ de prix de ressource en Mode communautaire (perte de focus après changement réel,
specs/004)
   ├── communityState.price.medianAmountKamas déjà chargé (useCommunityPrice) ──> Écart à la médiane
   │      (calcul client, éphémère)
   │
   ├── [écart ≤ 25 % ou aucune médiane connue] ──> transmission directe, comportement inchangé
   │      (specs/004) ; le champ garde la valeur saisie par le joueur après succès (FR-012/FR-018 amendée)
   │
   └── [écart > 25 %] ──> boîte de dialogue de confirmation (bloquante)
          ├── [annulée] ──> aucune transmission ; le champ revient à sa valeur d'avant saisie (FR-007)
          └── [confirmée] ──> transmission normale (submitCommunityPrice, specs/004, inchangée) ; le
                 champ garde ici aussi la valeur saisie par le joueur après succès (FR-012/FR-018 amendée)
                 └── insérée comme ──> CommunityPriceContribution
                        ├── median_at_submission_kamas / deviation_percent calculés côté serveur,
                        │      indépendamment de l'écart calculé côté client (voir research.md)
                        └── [deviation_percent > 25] ──> visible dans la trace des valeurs aberrantes
                               (sous-ensemble filtré, consulté manuellement — voir
                               contracts/outlier-confirmation-api.md)
```
