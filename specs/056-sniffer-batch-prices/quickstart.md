# Quickstart : vérifier l'API sniffer en local

1. Tests : `npm test` (dont `tests/unit/sniffer-unit-price.test.ts` et
   `tests/unit/sniffer-routes.test.ts`).
2. Base locale (jamais `--remote` ici) — sur une base locale au schéma de `master`, appliquer :

   ```bash
   npx wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/migrations/0018_add_sniffer_tables.sql
   npx wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/migrations/0019_add_sniffer_origin.sql
   ```

3. Créer une clé à la main : l'empreinte de `test-key` est
   `sha256("test-key")` en hexadécimal ; l'insérer dans `sniffer_keys`, et un mapping actif dans
   `sniffer_mappings` pour `3.7.10.10`.
4. `npm run worker:dev`, puis `GET /sniffer/config?build=3.7.10.10` et `POST /community-price/batch`
   avec `Authorization: Bearer test-key` (voir [contracts/sniffer-api.md](./contracts/sniffer-api.md)) :
   attendu `accepted` > 0 et des lignes `origin = 'sniffer'` dans la base locale.
5. Avant toute application en remote : `SELECT COUNT(*) FROM community_price_contributions` pour
   chiffrer le coût en écritures de 0019 (voir research.md R2), puis passer par le skill
   `cloudflare-d1-deploy` — sur accord explicite du propriétaire seulement.
