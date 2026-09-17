#!/usr/bin/env bash
# Run one load script with its provenance captured and its results saved.
#
#   TARGET_URL=https://zugzwangworld.com PEAK_RATE=200 tests/load/run.sh read/03-homepage.js
#
# Saves tests/load/results/<RUN_ID>/{meta.txt,summary.json,stdout.log}.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:?usage: TARGET_URL=... tests/load/run.sh <read/NN-name.js|write/NN-name.js>}"
[[ -f "$DIR/$SCRIPT" ]] || { echo "REFUSED — no such script: $DIR/$SCRIPT" >&2; exit 2; }
: "${TARGET_URL:?REFUSED — TARGET_URL is not set}"
K6="${K6_BIN:-k6}"
command -v "$K6" >/dev/null || { echo "REFUSED — k6 not found (set K6_BIN)" >&2; exit 2; }

# ⛔ THE INSTRUMENT CHECK — refuse to run with compression off.
#
# k6 sends no `Accept-Encoding` unless the kit sets one, and without it every
# run measures RAW HTML instead of what a browser receives. That is not a
# rounding error: measured 2026-09-17, it is 5.6x on `/` and 18.4x on a seeded
# market page, which is enough to make a healthy server look bandwidth-bound and
# did exactly that to half the 2026-09-15 campaign.
#
# ⚠ THIS EXISTS BECAUSE THE FIX DELETED ITSELF ONCE ALREADY. It lived only in
# the rig's working copy and was overwritten by the `scp -r tests/load ...`
# refresh the runbook prescribes — so the repair vanished precisely when someone
# followed the instructions, and nothing said so. A preflight travels with the
# kit and fires on every run, which a comment cannot.
# ⚠ MATCHES THE CODE, NOT THE PROSE. The docblock above the header names
# `accept-encoding` several times, so a bare `grep -q accept-encoding` passes on
# a file whose header has been deleted and whose comment survives — measured:
# the first version of this guard did exactly that. The quoted-key-and-colon
# form appears only in the object literal.
grep -qE '"accept-encoding"[[:space:]]*:' "$DIR/lib/source-ip.js" || {
	echo "REFUSED — lib/source-ip.js sends no accept-encoding header." >&2
	echo "          Every number from this run would measure raw HTML, not what a" >&2
	echo "          browser receives (5.6x-18.4x too large). Restore the header" >&2
	echo "          before running; see that file's docblock for why." >&2
	exit 2
}

# The rig silently capped itself at 1,024 open connections for the whole
# staging campaign (correction C-01). Raise it, and say so when it cannot.
if ! ulimit -n 65536 2>/dev/null; then
	echo "WARNING — could not raise open-file limit; current: $(ulimit -n). Results near that many connections measure the rig." >&2
fi

HEALTH="$(curl -fsS --max-time 10 "${TARGET_URL%/}/api/health")" || {
	echo "REFUSED — ${TARGET_URL%/}/api/health did not answer; not load-testing an unhealthy target." >&2
	exit 2
}
field() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" <<<"$HEALTH"; }
CANARY="$(field canary)"
[[ "$(field status)" == "ok" ]] || { echo "REFUSED — health status is not ok: $HEALTH" >&2; exit 2; }

# Set KIT_COMMIT when running a copied kit outside the repo.
COMMIT="${KIT_COMMIT:-$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)}"
NAME="$(basename "$SCRIPT" .js)"
RUN_ID="${RUN_ID:-${NAME}-$(field env)-$(date -u +%Y%m%dT%H%M%SZ)}"
OUT="$DIR/results/$RUN_ID"
mkdir -p "$OUT"

{
	echo "run_id=$RUN_ID"
	echo "script=$SCRIPT"
	echo "target_url=$TARGET_URL"
	echo "health=$HEALTH"
	echo "git_commit=$COMMIT"
	echo "k6=$("$K6" version 2>/dev/null | head -1)"
	echo "rig=$(hostname) open_files=$(ulimit -n)"
	echo "started_utc=$(date -u +%FT%TZ)"
	env | grep -E '^(PEAK_RATE|PAGE_PATH|MARKET_SLUG|POST_ID|PSEUDONYM|SOAK_RATE|SOAK_DURATION|VU_COUNT|MAX_VUS|PRODUCTION_MAX_RATE|MARKET_ID|MARKET_A_ID|MARKET_B_ID|PARENT_COMMENT_ID)=' || true
} >"$OUT/meta.txt"

set +e
EXPECTED_CANARY="$CANARY" \
	GIT_COMMIT="$COMMIT" \
	K6_VERSION="$("$K6" version 2>/dev/null | head -1)" \
	RIG="$(hostname)" \
	RUN_ID="$RUN_ID" \
	"$K6" run --summary-export "$OUT/summary.json" "$DIR/$SCRIPT" 2>&1 | tee "$OUT/stdout.log"
STATUS=${PIPESTATUS[0]}
set -e

echo "finished_utc=$(date -u +%FT%TZ) k6_exit=$STATUS" >>"$OUT/meta.txt"
if [[ -f "$OUT/summary.json" ]]; then
	node "$DIR/summarize.mjs" "$OUT/summary.json" | tee "$OUT/summary.txt"
fi
exit "$STATUS"
