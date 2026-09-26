# Community Price API Worker

Backend for `specs/004-community-price-sharing`: a small Cloudflare Worker in front of a
Cloudflare D1 (SQLite) database. Chosen over a managed Postgres service (see
`../specs/004-community-price-sharing/research.md`) specifically because Cloudflare's free tier
never turns into a bill without deliberate action — no credit card required, no automatic upgrade.

## One-time setup

```bash
npx wrangler login
npx wrangler d1 create dofus-craft-community-prices
# copy the printed database_id into wrangler.toml's [[d1_databases]] entry
npm run worker:db:init
npx wrangler secret put COMMUNITY_API_KEY --config worker/wrangler.toml
# pick any long random value; it must match VITE_COMMUNITY_API_KEY in the frontend's .env.local
```

## Local development

```bash
npm run worker:dev
```

## Deploy

```bash
npm run worker:deploy
```

Then set `VITE_COMMUNITY_API_URL` in the frontend's `.env.local` to the deployed Worker's URL
(printed by the deploy command), and `VITE_COMMUNITY_API_KEY` to the secret set above.

## Files

- `src/index.ts` — the routes: anonymous reads `GET /community-price`, `GET /latest-price`
  (specs/016), `GET /price-history` (specs/017, specs/018) and `GET /player-counters`; keyed writes
  `POST /community-price` and `POST /visit`.
- `src/price-history.ts` — every shared price of the last 24 hours, 7 days and 30 days, outliers dropped
  per window, no device id (specs/018), unit-tested via `tests/unit/price-history-aggregation.test.ts`.
- `src/median.ts` — pure statistics (median + outlier exclusion), unit-tested from the repo root
  via `tests/unit/community-price-median.test.ts`.
- `schema.sql` — D1 table definition, applied with `npm run worker:db:init`.

See `../specs/004-community-price-sharing/quickstart.md` for the full manual verification
checklist once this is deployed.
