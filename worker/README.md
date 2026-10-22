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
npm run worker:db:migrate-external-prices   # migration 0011 (specs/045: prices read from Huzounet)
npm run worker:db:migrate-fm-guild          # migration 0012 (specs/045: the group's server name)
npm run worker:db:migrate-line-corrections  # migration 0013 (specs/045: corrected capture lines)
npm run worker:db:migrate-line-read-name    # migration 0014 (specs/045: name as read, lines that count)
npm run worker:db:migrate-channel-commands  # migration 0015 (specs/045: archive / reopen a channel)
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

Migrations 0011 to 0015 were written back from the production database, which already has them:
they are for a new database only.

## Huzounet prices (specs/045-restore-production-worker)

The Worker reads the HDV prices published by huzounet.fr, with its author's permission, for the
server Mikhal only (`src/huzounet.ts`; the HDV page's hourly limit is described at the end of this section): 50 items a request, one request a second, 12 requests a
scheduled run, carried on by a cursor from one run to the next. The prices are kept in
`external_prices`, beside what the players share, and the most recent of both is the one the price
reads give (`src/external-price.ts`). `POST /external-prices/refresh` reads up to 90 items on demand.
`HUZOUNET_SYNC = "1"` in `wrangler.toml` turns both on; any other value turns them off.

The HDV page loads a whole tab through that route, 90 items a request, naming its tab (`tab`) and its
last request (`last`). Those requests have an hourly limit (specs/046-hdv-huzounet-load), so the rows
written to D1 stay well under the free plan's daily quota: an item read in the last hour is not asked
again, and a tab loaded to its end answers 429 `hourly-limit` (with `retryAt`) for an hour, to every
player. The hour of a tab is kept in `external_price_sync` (`source = 'huzounet-hdv-<tab>'`).

The second cron of `wrangler.toml` drives the scheduled read. **Check it against the Worker's
triggers in the Cloudflare dashboard before deploying**: a deploy replaces them.

## Friends' HDV price tool (specs/056-sniffer-batch-prices)

`GET /sniffer/config` and `POST /community-price/batch` serve the friends' price tool
(SniffSniffSquared). Contract: `../specs/056-sniffer-batch-prices/contracts/sniffer-api.md`.

- Each friend has a key in `sniffer_keys`, stored as its SHA-256 only; the public
  `COMMUNITY_API_KEY` is never accepted there. Keys and decoding mappings (`sniffer_mappings`, one
  active per game build) are created from the admin (phase 3); until then, by hand in SQL.
- specs/071: from tool 0.4.0, an observation may carry `category` (the DofusDB item type): prices of
  every HDV are accepted and tagged in `item_type` (equipment / resource / rune / consumable, from
  `src/item-types.json`, built by `scripts/build-item-types.mjs`). Equipments are item prices
  (`kind = 'item'`). Migration: `npm run worker:db:migrate-item-type` (0022, adds a column, rewrites no row).
- Every price is recorded with `origin = 'sniffer'` and the key's id as `device_id`, at most
  `DAILY_ROW_LIMIT` (5000) a key and UTC day (`sniffer_daily_usage`).
- The minimum tool version and its download link are `SNIFFER_MIN_VERSION` /
  `SNIFFER_DOWNLOAD_URL` in `wrangler.toml` [vars].
- Migrations: `npm run worker:db:migrate-sniffer-tables` (0018), then
  `npm run worker:db:migrate-sniffer-origin` (0019). 0019 rebuilds `community_price_contributions`
  and so writes every existing row once: count them first against the free plan's daily write quota.
  Export a backup first (`wrangler d1 export --remote`) and apply it outside the Huzounet runs
  (02:00-05:00 UTC): a contribution written during the rebuild could be lost. A stopped run is
  resumed as explained at the top of the migration.

## Same code as production

The source of the Worker deployed on 2026-10-02 was lost and written back from the deployed code
(specs/045). `bash scripts/compare-worker-bundle.sh` (Node 22) builds the Worker without deploying it
and compares it to that deployed code, kept in `backups/production-2026-10-12/` (not committed): the
only expected differences are the site's address in the `User-Agent` sent to Huzounet and, since
specs/046, the HDV page's hourly limit (`src/huzounet.ts`, `src/index.ts`).

## Files

- `src/index.ts` — the routes: anonymous reads `GET /community-price`, `GET /latest-price`
  (specs/016), `GET /item-prices` (specs/019), `GET /price-history` (specs/017, specs/018), `GET /info-message` (specs/020), `GET /site-settings` (specs/050) and
  `GET /player-counters`; keyed writes
  `POST /community-price`, `POST /visit` and `POST /external-prices/refresh` (specs/045).
- `src/huzounet.ts`, `src/external-price.ts` — the prices read from Huzounet (specs/045), unit-tested
  via `tests/unit/huzounet-*.test.ts` and `tests/unit/external-price.test.ts`.
- `src/price-history.ts` — every shared price of the last 24 hours, 7 days and 30 days, outliers dropped
  per window, no device id (specs/018), unit-tested via `tests/unit/price-history-aggregation.test.ts`.
- `src/sniffer.ts`, `src/unit-price.ts` — the friends' price tool (specs/056): routes, and the unit
  price kept from an HDV ladder; `src/servers.ts` (the 13 servers) and `src/resource-catalogue.ts`
  (the resources whose price the site shows) are shared with `src/huzounet.ts`. Tested via
  `tests/unit/sniffer-*.test.ts`.
- `src/median.ts` — pure statistics (median + outlier exclusion), unit-tested from the repo root
  via `tests/unit/community-price-median.test.ts`.
- `src/fm/` — the Forgemagie routes (specs/025): `router.ts` (every `/fm/*` path, routed before the
  `COMMUNITY_API_KEY` check), `auth.ts` (Discord login, hashed session tokens), `bot-events.ts`
  (`POST /fm/bot/events`), `reads.ts` (sessions, players, private players masked), `me.ts`,
  `imports.ts`, `purchases.ts` (the prices purchases create), `items.ts` (specs/027: items in FM,
  attaching a session, an item's recap), `channels.ts` (specs/029: personal channels created by the bot), `site-sessions.ts` and `bot-commands.ts` (specs/028: sessions
  started or stopped from the site, and the queue the bot polls every 10 seconds — see
  `../specs/028-site-started-sessions/contracts/fm-bot-commands.md`), `seances.ts` (specs/045: a
  channel and its sessions as one séance de FM, archived and reopened), `captures.ts` (specs/045:
  correcting a capture's lines) and `players.ts` (specs/045: the group's players). Tested from the repo root via
  `tests/unit/fm-*.test.ts`.
- `schema.sql` — D1 table definition, applied with `npm run worker:db:init`.

See `../specs/004-community-price-sharing/quickstart.md` for the full manual verification
checklist once this is deployed.
