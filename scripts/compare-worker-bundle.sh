#!/usr/bin/env bash
# specs/045-restore-production-worker (research R3): builds the API Worker without deploying it and
# compares the result, line by line, with the copy of the Worker running in production.
# Usage, from the repository root:  bash scripts/compare-worker-bundle.sh [--full]
# wrangler needs Node 22: put it first in PATH before running this.
set -euo pipefail

backup="backups/production-2026-10-12/worker-api-en-ligne.js"
out="${TMPDIR:-${TEMP:-/tmp}}/dofus-craft-worker-compare"

[ -f "$backup" ] || { echo "Sauvegarde introuvable : $backup" >&2; exit 2; }
rm -rf "$out" && mkdir -p "$out"
npx wrangler deploy --config worker/wrangler.toml --dry-run --outdir "$out/build" >/dev/null

# The backup is the upload as Cloudflare returns it: a multipart part whose headers come before the
# code, and whose boundary comes after. Only the code is compared.
awk 'f && /^--[0-9a-f]+--$/ {exit} f {print} /^\/\/ src\// && !f {f=1; print}' "$backup" | tr -d '\r' > "$out/production.js"
awk '/^\/\/ src\// && !f {f=1} f {print}' "$out/build/index.js" | tr -d '\r' | sed '/^\/\/# sourceMappingURL=/d' > "$out/depot.js"

lines=$(diff "$out/depot.js" "$out/production.js" | grep -c '^[<>]' || true)
echo "Lignes différentes : $lines"
if [ "${1:-}" = "--full" ]; then diff "$out/depot.js" "$out/production.js" || true; fi
