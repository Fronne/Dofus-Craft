# Quickstart : vérifier l'administration sniffer

## Automatique

```bash
npm test && npm run typecheck && npm run lint
```

Dont `tests/unit/admin-sniffer-keys.test.ts` et `tests/unit/admin-sniffer-mappings.test.ts`, qui
vérifient aussi le lien avec la phase 2 (une clé créée passe `authenticateSnifferKey`, un mapping
déposé est celui de `snifferConfigResponse`).

## Local, de bout en bout (jamais `--remote`)

Voir research.md R9 : rien dans le dépôt ne contourne Access.

1. Une base locale partagée (`--persist-to <dossier>`), au schéma de `worker/schema.sql` ou avec
   les migrations 0018 et 0019 appliquées par `wrangler d1 execute … --local --persist-to <dossier>`.
2. `npm run admin:build`, puis un `wrangler dev` de test (config et entrée hors du dépôt) qui appelle
   `handleApi` avec un vérificateur de test et sert `dist-admin/`, sur la même `--persist-to`.
3. `npx wrangler dev --config worker/wrangler.toml --persist-to <dossier>` (API).
4. Dans la page : créer la clé « Test », copier la clé ; déposer `keymap.json` + `schema.json` de
   `SniffSniffSquared/sniffer/` pour `3.7.10.10`.
5. `GET /sniffer/config?build=3.7.10.10` sur l'API avec `Authorization: Bearer <clé>` : 200, et
   `mapping.id` / `keymap` / `schema` = ceux déposés. La liste des clés montre le dernier envoi.
6. Révoquer la clé dans la page : le même appel répond 401.
7. Déposer un second mapping, réactiver le premier : la config renvoie de nouveau le premier.

## Avant toute mise en ligne

Sur accord explicite du propriétaire seulement : migrations 0018/0019 en remote (skill
`cloudflare-d1-deploy`, phase 2), `npm run admin:build && npm run admin:deploy`, fusion dans
`master`.
