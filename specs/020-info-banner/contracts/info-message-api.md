# Contrat : message d'information

## Public — `GET /info-message` (Worker `dofus-craft-community-price-api`)

Lecture anonyme.

| Cas | Statut | Corps |
|---|---|---|
| aucun message, ou message expiré | 200 | `null` |
| message actif | 200 | `{ "text": "…", "tone": "important", "endsAt": "2026-10-01T20:00:00.000Z", "version": "2026-09-26T15:00:00.000Z" }` |

## Administration (Worker `dofus-craft-admin`, derrière Cloudflare Access + `verifyOwner`)

| Méthode | Chemin | Corps | Réponses |
|---|---|---|---|
| GET | `/api/message` | — | 200 message (même format, **même s'il est expiré**) ou `null` |
| PUT | `/api/message` | `InfoMessageInput` | 200 message enregistré ; 400 `{ error, field }` |
| DELETE | `/api/message` | — | 204 |

Non-propriétaire → 403 `{ error: 'Accès réservé au propriétaire.' }`, comme les compteurs.

## Client — `getInfoMessage()`

`Promise<InfoMessage | undefined>` ; ne lève jamais (réseau, non 2xx, corps invalide → `undefined`).

## Tests obligatoires

- validation : vide, 281 caractères, style inconnu, date passée ou illisible, cas valides ;
- public : `null` sans message ; message actif renvoyé ; message expiré → `null` ; sans date de fin →
  renvoyé ;
- administration : 403 sans propriétaire ; PUT valide crée puis remplace (version changée) ; PUT
  invalide 400 ; DELETE puis GET → `null` ;
- client : valide / 500 / réseau / corps invalide.
