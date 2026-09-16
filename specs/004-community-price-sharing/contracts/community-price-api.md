# Community Price API Contract

## Scope

Ce contrat fixe l'interface REST exposée par le backend (un Worker Cloudflare, `worker/src/index.ts`,
devant une base D1 conforme au schéma décrit dans [`../data-model.md`](../data-model.md)) et
consommée par le service client `src/services/community-price-api.ts`, suivant le même pattern d'adaptateur que
[`src/services/dofusdb-api.ts`](../../../src/services/dofusdb-api.ts) (appels `fetch` directs,
pas de SDK). Il ne modifie aucun contrat existant (001/002/003) : c'est une nouvelle frontière,
strictement additive.

## Lire un prix communautaire

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `getCommunityPrice(resourceId, serverId)` | identifiants de ressource et de serveur | `{ medianAmountKamas, sampleSize }` ou `undefined` | Lit exclusivement la médiane agrégée calculée par le backend (jamais les contributions individuelles). Renvoie `undefined` quand aucune contribution valide n'existe pour ce couple ressource/serveur (FR-002) — le client MUST NOT interpréter cela comme un prix à zéro. |

## Contribuer un prix

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `submitCommunityPrice(resourceId, serverId, amountKamas)` | identifiants + montant | `{ id }` (identifiant généré par la base) | MUST uniquement être appelée lorsque `ShareConsent.given === true` (FR-004) ; l'appel ne transmet aucune information au-delà de ressource/serveur/montant — jamais d'identifiant de joueur, d'appareil ou d'IP (FR-007). L'`id` renvoyé MUST être conservé localement (`LocalContributionRecord`) pour permettre un retrait ultérieur. |

## Retirer une contribution

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `withdrawCommunityContribution(id)` | `id` d'une contribution déjà envoyée | succès (idempotent si déjà supprimée) | Supprime définitivement la ligne correspondante. La connaissance de l'`id` est la seule preuve de propriété requise (FR-012) — aucune autre vérification d'identité n'existe ni ne doit être ajoutée. |

## Garanties valables quel que soit l'état du réseau

- Une erreur réseau ou un backend indisponible sur `getCommunityPrice` MUST résoudre vers un état
  explicite d'indisponibilité côté appelant (jamais une exception non gérée qui casserait le
  parcours personnel), conformément à FR-009/User Story 5.
- Aucune de ces trois opérations n'est appelée en mode personnel (FR-014) : le service
  `community-price-api.ts` n'est importé et invoqué que par les surfaces conditionnées au mode
  communautaire.
- `submitCommunityPrice` n'est jamais invoquée automatiquement par un changement de mode ou de
  prix personnel seul — uniquement par une action explicite de contribution après consentement
  (FR-004, User Story 2).

## Ce que ce contrat ne couvre pas

Le format exact des requêtes HTTP (en-têtes, structure des routes) est un détail d'implémentation
du service client et du Worker, pas une exigence produit ; voir `worker/src/index.ts` pour la
réalisation actuelle, sans que cela ne modifie les signatures ci-dessus.
