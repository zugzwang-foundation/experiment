#!/usr/bin/env bash
# WAF-RATE-1 — live rehearsal of the per-IP WAF rate limits, STAGING ONLY.
#
# Run only after staging has been deployed with the WAF attached
# (`ZZ_STAGING_WAF=count`), and only with the founder's approval. Every request
# is a GET to a public page or file; nothing is written. All requests come from
# THIS machine, i.e. one IP — which is exactly what "many people behind one
# shared address" looks like to the WAF.
#
# WAF counts in near-real time but reconciles every few tens of seconds, so a
# block can start a little after the exact limit. Each step therefore reports
# the first request that got 429, not a hard "request N+1" assertion.
#
# Usage: infra/scripts/waf-rehearsal.sh https://staging.zugzwangworld.com
set -euo pipefail

BASE="${1:-}"
case "$BASE" in
	https://staging.zugzwangworld.com) ;;
	*) echo "refusing: target must be https://staging.zugzwangworld.com (got '$BASE')"; exit 2 ;;
esac

SLUG="bitcoin-price-50k"
STATIC_PATH=$(curl -s "$BASE/m/$SLUG" | grep -oE '/_next/static/chunks/[^"\\]+\.js' | head -1)
[ -n "$STATIC_PATH" ] || { echo "could not find a static chunk to request"; exit 3; }

# burst <label> <count> <path> — sends <count> GETs (8 at a time) and reports
# how many got each status and where the first 429 fell.
burst() {
	local label="$1" count="$2" path="$3"
	local out
	out=$(seq 1 "$count" | xargs -P 8 -I{} sh -c \
		'printf "%s %s\n" {} "$(curl -s -o /dev/null -w "%{http_code}" "'"$BASE$path"'")"' | sort -n)
	local first429
	first429=$(echo "$out" | awk '$2==429{print $1; exit}')
	echo "== $label: $count x $path"
	echo "$out" | awk '{print $2}' | sort | uniq -c | sed 's/^/   /'
	echo "   first 429 at request: ${first429:-none}"
}

check_429_headers() {
	local path="$1"
	echo "== 429 response for $path"
	curl -s -D - -o /tmp/waf-body.txt "$BASE$path" | grep -iE "^(HTTP|retry-after)" | sed 's/^/   /'
	echo "   body: $(cat /tmp/waf-body.txt)"
}

echo "Target: $BASE   (one source IP: this machine)"
echo "Static file used: $STATIC_PATH"
echo

# 1. Many users sharing one IP: 60 cold page loads (1 page + static files
#    each) — expect NO 429 (dynamic ~60, static ~60×N, both under limit).
echo "== shared IP: 60 cold page loads from one address"
statics=$(curl -s "$BASE/m/$SLUG" | grep -oE '/_next/static/[^"\\]+\.(js|css|woff2)' | sort -u)
codes=$(for u in $(seq 1 60); do
	echo "/m/$SLUG"; echo "$statics"
done | xargs -P 8 -I{} curl -s -o /dev/null -w "%{http_code}\n" "$BASE{}" | sort | uniq -c)
echo "$codes" | sed 's/^/   /'
echo

# 2. Downloads: limit 30 — expect ~30 × 200, then 429.
burst "export (limit 30)" 40 "/m/$SLUG/export"
check_429_headers "/m/$SLUG/export"
echo

# 3. Sign-in path: limit 100 — get-session is a harmless GET.
burst "auth (limit 100)" 120 "/api/auth/get-session"
echo

# 4. Static files: limit 5,000, NOT the 1,000 general limit — 1,500 static
#    requests must all pass even though they exceed 1,000.
burst "static (limit 5000; must pass at 1500)" 1500 "$STATIC_PATH"
echo

# 5. General dynamic: limit 1,000. ⚠ Steps 1-3 already spent about 220
#    dynamic requests from this IP (pages, exports and auth all count toward
#    the general limit too), so the first 429 here is expected near request
#    ~780 of this step, i.e. ~1,000 in total for the 5-minute window.
burst "dynamic (limit 1000)" 1100 "/m/$SLUG"
check_429_headers "/m/$SLUG"
echo
echo "Done. Wait 5 minutes before re-running (the window must clear)."
