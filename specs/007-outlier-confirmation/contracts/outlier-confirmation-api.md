# Outlier Confirmation Contract

## Scope

Ce contrat décrit ce que cette fonctionnalité ajoute par-dessus
[`specs/004-community-price-sharing/contracts/community-price-api.md`](../../004-community-price-sharing/contracts/community-price-api.md),
qu'il ne modifie ni ne remplace. Aucune route HTTP n'est ajoutée, renommée ou dépréciée ;
`submitCommunityPrice`/`getCommunityPrice` gardent exactement leurs signatures et leur comportement
HTTP actuels (corps de requête, codes de réponse).

## Gate de confirmation côté client (nouveau, purement local)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `computeDeviationPercent(enteredAmountKamas, medianAmountKamas)` (`src/domain/outlier-threshold.ts`) | montant saisi, médiane déjà connue | pourcentage d'écart (réel, toujours ≥ 0) | Fonction pure, `\|entered − median\| / median × 100`. N'effectue aucun appel réseau : utilise la médiane déjà chargée par `useCommunityPrice` (specs/004), jamais un nouvel appel à `getCommunityPrice`. |
| `useOutlierConfirm()` → `confirmOutlier(details)` (`src/features/comparison/OutlierConfirmDialog.tsx`) | `{ medianAmountKamas, enteredAmountKamas, deviationPercent }` | `Promise<boolean>` (`true` = confirmé, `false` = annulé) | Affiche une boîte de dialogue bloquante (`<dialog>` natif) indiquant les trois valeurs reçues (FR-005) avant toute résolution de la promesse. Ne résout qu'après un geste explicite du joueur (bouton « Enregistrer quand même » ou « Annuler », ou fermeture clavier — traitée comme une annulation). |
| Commit d'un champ de prix de ressource en Mode communautaire (perte de focus après changement réel, specs/004) | valeur saisie | inchangé si écart ≤ 25 % ou aucune médiane connue (transmission directe, comme aujourd'hui) ; sinon, `submitCommunityPrice` n'est appelé qu'après une confirmation explicite | Quand une médiane est connue (`communityState.kind === 'found'`) et que `computeDeviationPercent(...)` dépasse 25 (FR-003), `handleCommit` appelle `confirmOutlier(...)` et attend sa résolution avant d'appeler `submitCommunityPrice` ; une résolution `false` n'appelle jamais `submitCommunityPrice` et signale un rejet à `ResourcePriceInput` pour restaurer la valeur précédente (FR-007). |

## Extension de `ResourcePriceInput` (changement de contrat local, pas d'API réseau)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| Prop `onCommit` (`src/features/comparison/ResourcePriceInput.tsx`) | valeur commitée | `Promise<'accepted' \| 'rejected'> \| void` | Sur `'rejected'`, `ResourcePriceInput` restaure lui-même la valeur d'avant édition (`lastCommittedValueRef.current`, déjà suivie en interne depuis specs/004) via son `onChange` existant. Sur `'accepted'` ou `void`, rien de plus ne se produit ici : depuis la révision de specs/004 (FR-018 amendée) et FR-012 de cette feature, un envoi réussi ne réécrit plus le champ avec la médiane recalculée — la valeur saisie par le joueur reste affichée telle quelle. |

## Trace des valeurs aberrantes (lecture, hors HTTP)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| Requête SQL directe (`wrangler d1 execute`, pas de route HTTP dans cette révision) | aucun | lignes de `community_price_contributions` où `deviation_percent > 25` | Décrite dans `research.md` (« Interface de consultation de la trace : hors périmètre »). N'affecte ni ne dépend d'aucune route existante — un accès en lecture directe à la base, réservé à un membre du groupe disposant des identifiants Cloudflare du projet. |

## Ce que ce contrat ne couvre pas

Le calcul serveur de `median_at_submission_kamas`/`deviation_percent` (extraction de
`fetchCurrentMedian` dans `worker/src/index.ts`, ajout de `worker/src/outlier.ts`) est un détail
d'implémentation interne au Worker, sans effet observable sur le corps de la requête `POST
/community-price` ni sur sa réponse (`{ id }`, inchangée) — voir `data-model.md` pour le détail des
colonnes.
