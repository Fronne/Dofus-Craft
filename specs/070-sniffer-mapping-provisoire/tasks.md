# Tasks : mapping sniffer provisoire

**Input** : `specs/070-sniffer-mapping-provisoire/` (spec, plan)

**Tests** : demandés (scénarios de la spec), sur la vraie D1 simulée.

## Phase 1 : Histoires 1 et 2 (P1)

- [x] T001 [US1] Écrire les tests dans `tests/unit/sniffer-routes.test.ts` : repli servi avec `provisional=1` (build d'origine, `provisional: true`, dernier dépôt actif), `null` sans ; mapping propre au build prioritaire (`provisional: false`) ; lot provisoire accepté ; lot provisoire refusé en 409 dès qu'un mapping propre est publié ; lot non provisoire sans mapping refusé en 409
- [x] T002 [US1] Dans `worker/src/sniffer.ts`, ajouter `readExpectedMapping(db, build, provisional)` et l'utiliser dans `snifferConfigResponse` (paramètre `provisional=1`, champ `provisional` dans `mapping`)
- [x] T003 [US2] Dans `snifferBatchResponse`, lire `provisional === true` et comparer `mappingId` au mapping attendu de `readExpectedMapping`
- [x] T004 Mettre à jour `specs/056-sniffer-batch-prices/contracts/sniffer-api.md`
- [ ] T005 Tests, typecheck et lint verts ; relecteur
