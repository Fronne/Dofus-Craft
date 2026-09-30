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

## Forgemagie (specs/025-rune-purchase-import)

The `/fm/*` routes (`src/fm/`) serve the Forgemagie page: Discord login, the Discord bot's FM
sessions, player profiles and capture imports. Setup, once:

```bash
npm run worker:db:migrate-forgemagie        # migration 0007, before deploying the Worker that uses it
npm run worker:db:migrate-fm-items          # migration 0008 (specs/027: items in FM), same rule
npm run worker:db:migrate-site-sessions     # migration 0009 (specs/028: sessions started from the site)
npm run worker:db:migrate-fm-channels       # migration 0010 (specs/029: personal FM channels)
npx wrangler secret put DISCORD_CLIENT_ID --config worker/wrangler.toml
npx wrangler secret put DISCORD_CLIENT_SECRET --config worker/wrangler.toml
npx wrangler secret put DISCORD_GUILD_ID --config worker/wrangler.toml
npx wrangler secret put FM_BOT_API_KEY --config worker/wrangler.toml
```

The Discord application needs `{worker URL}/fm/auth/callback` as a redirect URL. For local work, the
same values go in `worker/.dev.vars` (not committed), with `SITE_URL=http://localhost:5173`. The bot's
side is described in `../specs/025-rune-purchase-import/contracts/fm-bot-api.md` — the document to
give the bot's author, with the `FM_BOT_API_KEY` value (privately). After a DofusDB catalogue change,
`node scripts/build-rune-items.mjs` rebuilds the rune list and the item-name index
(`src/fm/priceable-items.json`).

## Files

- `src/index.ts` — the routes: anonymous reads `GET /community-price`, `GET /latest-price`
  (specs/016), `GET /item-prices` (specs/019), `GET /price-history` (specs/017, specs/018), `GET /info-message` (specs/020) and
  `GET /player-counters`; keyed writes
  `POST /community-price` and `POST /visit`.
- `src/price-history.ts` — every shared price of the last 24 hours, 7 days and 30 days, outliers dropped
  per window, no device id (specs/018), unit-tested via `tests/unit/price-history-aggregation.test.ts`.
- `src/median.ts` — pure statistics (median + outlier exclusion), unit-tested from the repo root
  via `tests/unit/community-price-median.test.ts`.
- `src/fm/` — the Forgemagie routes (specs/025): `router.ts` (every `/fm/*` path, routed before the
  `COMMUNITY_API_KEY` check), `auth.ts` (Discord login, hashed session tokens), `bot-events.ts`
  (`POST /fm/bot/events`), `reads.ts` (sessions, players, private players masked), `me.ts`,
  `imports.ts`, `purchases.ts` (the prices purchases create), `items.ts` (specs/027: items in FM,
  attaching a session, an item's recap), `channels.ts` (specs/029: personal channels created by the bot), `site-sessions.ts` and `bot-commands.ts` (specs/028: sessions
  started or stopped from the site, and the queue the bot polls every 10 seconds — see
  `../specs/028-site-started-sessions/contracts/fm-bot-commands.md`). Tested from the repo root via
  `tests/unit/fm-*.test.ts`.
- `schema.sql` — D1 table definition, applied with `npm run worker:db:init`.

See `../specs/004-community-price-sharing/quickstart.md` for the full manual verification
checklist once this is deployed.
