# Community Price API Contract

## Scope

Ce contrat fixe l'interface REST exposée par le backend (un Worker Cloudflare, `worker/src/index.ts`,
devant une base D1 conforme au schéma décrit dans [`../data-model.md`](../data-model.md)) et
consommée par le service client `src/services/community-price-api.ts`, suivant le même pattern d'adaptateur que
[`src/services/dofusdb-api.ts`](../../../src/services/dofusdb-api.ts) (appels `fetch` directs,
pas de SDK). Il ne modifie aucun contrat existant (001/002/003) : c'est une nouvelle frontière,
strictement additive.

**Depuis la révision 2** : `withdrawCommunityContribution` et la route `DELETE
/community-price/:id` sont retirées (plus aucun appelant, retrait rétroactif supprimé du produit —
voir research.md). Ce contrat ne couvre plus que la lecture et l'envoi.

**Depuis la révision 4** : le point d'appel de `submitCommunityPrice` change (voir section
« Transmission automatique par ressource » ci-dessous), mais ni cette fonction ni
`getCommunityPrice` ne changent de signature ni de comportement HTTP.

**Depuis la révision 5** : le corps JSON envoyé par `submitCommunityPrice` à `POST /community-price`
gagne un champ `deviceId` (voir section « Identifiant d'appareil » ci-dessous), résolu en interne par
la fonction — sa signature TypeScript publique (paramètres, valeur de retour) ne change pas.
`getCommunityPrice` n'est pas concerné.

## Lire un prix communautaire

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `getCommunityPrice(resourceId, serverId)` | identifiants de ressource et de serveur | `{ medianAmountKamas, sampleSize }` ou `undefined` | Lit exclusivement la médiane agrégée calculée par le backend (jamais les contributions individuelles). Renvoie `undefined` quand aucune contribution valide n'existe pour ce couple ressource/serveur (FR-002) — le client MUST NOT interpréter cela comme un prix à zéro. Ce résultat sert à la fois à pré-remplir le champ de prix du carnet Mode communautaire (une seule fois par ressource, uniquement si aucune valeur n'y existe déjà — FR-001/FR-006) et à afficher `sampleSize` de façon compacte à côté du champ. |

## Transmission automatique par ressource (depuis la révision 4)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| Commit d'un champ de prix de ressource en Mode communautaire (perte de focus après une valeur réellement modifiée depuis le déverrouillage — FR-017/FR-020) | la valeur saisie par le joueur pour cette ressource | appelle `submitCommunityPrice` pour cette seule ressource, puis, en cas de succès, `getCommunityPrice` pour rafraîchir le compteur de contributions et le cache de médiane (FR-019) — **sans réécrire le champ ni le carnet avec cette médiane** (FR-018, amendée révision 6) | Aucun écran de confirmation séparé : le déverrouillage explicite du champ puis sa modification constituent en eux-mêmes le geste de partage (FR-009). Un blur sans changement de valeur n'appelle jamais `submitCommunityPrice` (FR-020). En cas d'échec, aucun rechargement n'est tenté et la valeur locale du joueur reste affichée et utilisable, sans message d'erreur bloquant ; une nouvelle tentative n'a lieu qu'à la prochaine modification confirmée de ce même champ. Depuis la révision 6, le champ continue d'afficher la valeur saisie par le joueur même en cas de succès — voir specs/007-outlier-confirmation. |
| `submitCommunityPrice(resourceId, serverId, amountKamas)` | identifiants + montant | `{ id }` (identifiant généré par la base) | Signature TypeScript inchangée depuis la révision 1. Seul change le site d'appel : le commit d'un champ de prix ci-dessus, plus l'ancienne action de partage groupé (Paramètres, retirée en révision 4). L'appel ne transmet aucune information identifiant personnellement le joueur (FR-010) ; depuis la révision 5, le corps HTTP envoyé inclut en plus un `deviceId` anonyme, résolu en interne (voir ci-dessous) — la signature de la fonction elle-même ne change pas. L'`id` renvoyé n'est pas conservé localement (inchangé depuis la révision 2). |

## Identifiant d'appareil (depuis la révision 5)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `getOrCreateDeviceId()` (`src/persistence/community-device-id.ts`) | aucun | chaîne UUID | Lit l'identifiant déjà stocké localement (`localStorage`, clé `craftcheck-community-device-id`) s'il existe ; sinon en génère un nouveau (`crypto.randomUUID()`), l'écrit, puis le retourne. Ne lève jamais d'exception : si `localStorage` est indisponible, retourne un identifiant généré à la volée sans le persister (dégrade la reconnaissance inter-appels, jamais la contribution elle-même). |
| Corps HTTP de `POST /community-price` | — | `{ resourceId, serverId, amountKamas, deviceId }` | `submitCommunityPrice` appelle `getOrCreateDeviceId()` en interne et ajoute son résultat au corps JSON existant. Le Worker (`worker/src/index.ts`) MUST rejeter toute requête où `deviceId` n'est pas une chaîne non vide (même validation que les autres champs de `ContributionPayload`), avec le même code `400` déjà utilisé pour un payload invalide. |

## Garanties valables quel que soit l'état du réseau

- Une erreur réseau ou un backend indisponible sur `getCommunityPrice` MUST résoudre vers un état
  explicite d'indisponibilité côté appelant (jamais une exception non gérée qui casserait le
  parcours personnel), conformément à FR-011/User Story 4.
- Aucune de ces opérations n'est appelée en mode personnel (FR-015) : le service
  `community-price-api.ts` n'est importé et invoqué que par les surfaces conditionnées au mode
  communautaire.
- `submitCommunityPrice` n'est jamais invoquée automatiquement par un changement de mode, de prix
  personnel, un chargement de page ou un rafraîchissement périodique du carnet Mode communautaire —
  uniquement par le commit d'un champ de prix modifié par le joueur lui-même (FR-017/FR-020).
- Depuis la révision 5 : `getCommunityPrice` ne renvoie et n'expose jamais de `deviceId`, quel que
  soit son contenu côté serveur — seule la médiane agrégée (`medianAmountKamas`, `sampleSize`) est
  lisible par un client (FR-023), exactement comme les contributions individuelles ne l'ont jamais
  été (garantie déjà actée par `data-model.md`).

## Ce que ce contrat ne couvre pas

Le format exact des requêtes HTTP (en-têtes, structure des routes) est un détail d'implémentation
du service client et du Worker, pas une exigence produit ; voir `worker/src/index.ts` pour la
réalisation actuelle, sans que cela ne modifie les signatures ci-dessus.
