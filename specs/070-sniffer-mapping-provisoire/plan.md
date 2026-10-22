# Plan : mapping sniffer provisoire

**Branche** : `070-sniffer-mapping-provisoire` | **Spec** : `spec.md` | **Évolution de** :
`specs/056-sniffer-batch-prices`

## Résumé

Un seul module change, `worker/src/sniffer.ts`. Une fonction `readExpectedMapping(db, build, provisional)`
renvoie le mapping actif du build ou, à défaut et si le repli est demandé, le dernier mapping actif
déposé, avec un indicateur `provisional`. `snifferConfigResponse` et `snifferBatchResponse` l'utilisent
toutes les deux, si bien que le mapping servi et le mapping exigé d'un lot ne peuvent pas diverger.

## Contexte technique

- TypeScript, Cloudflare Worker, D1. Tests vitest sur la vraie D1 simulée (`tests/support/sqlite-d1.ts`).
- Table existante `sniffer_mappings` (0018) : `uploaded_at` existe déjà, l'index unique garantit un
  seul actif par build. Aucune migration (FR-006).
- Lecture seule sur `sniffer_mappings` depuis les routes publiques (FR-005).

## Vérification de la constitution

Pas de nouvelle table, pas de nouvelle dépendance, pas de nouveau secret. Le changement est
rétrocompatible : les deux nouveaux champs d'entrée sont facultatifs et sans eux le comportement est
celui de 056 (seul `provisional: false` s'ajoute à un mapping servi, champ qu'un ancien outil ignore).

## Décisions

- **D1 — opt-in explicite.** Un ancien outil lit `mapping` sans connaître `provisional` et enverrait sans
  vérifier. Le repli n'est donc servi qu'avec `provisional=1` (valeur exacte `1`).
- **D2 — repli = dernier dépôt actif.** `ORDER BY uploaded_at DESC, id DESC LIMIT 1` parmi `active = 1`.
  Un mapping retiré (inactif) n'est jamais servi en repli.
- **D3 — le lot provisoire reste lié au build.** Le mapping attendu est recalculé à chaque lot : dès qu'un
  vrai mapping est publié pour le build, l'id du repli ne correspond plus et le lot reçoit 409 avec l'id
  du vrai mapping, ce qui fait recharger l'outil.
- **D4 — `provisional` strictement booléen.** Seul `true` active le repli côté lot ; toute autre valeur
  vaut absence, sans 400, pour ne pas casser un ancien outil.

## Fichiers

- `worker/src/sniffer.ts` — `readExpectedMapping`, config et lot.
- `tests/unit/sniffer-routes.test.ts` — scénarios de la spec.
- `specs/056-sniffer-batch-prices/contracts/sniffer-api.md` — contrat mis à jour.
