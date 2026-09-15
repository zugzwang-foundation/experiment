#!/usr/bin/env bash
# Place ONE image post on a production market through the site's real
# endpoints — the same three calls the browser composer makes:
#   1. POST /api/uploads/sign   → uploadId + signed PUT URL
#   2. PUT  image to R2         (write-once, If-None-Match: *)
#   3. POST /api/bets/place     → bet + comment + image, one W-1 transaction
#
#   ./post-one.sh <n> <YES|NO> <marketId>
#
# Reads the session cookie VALUE from ~/.zz-prod-session. Prints status codes
# and the place response; never prints the cookie.
set -euo pipefail

N="${1:?usage: post-one.sh <n> <YES|NO> <marketId>}"
SIDE="${2:?side YES or NO}"
MARKET_ID="${3:?marketId}"
DIR="$(cd "$(dirname "$0")" && pwd)"
IMG="$DIR/post-$N.png"
B="https://zugzwangworld.com"
SESSION_FILE="$HOME/.zz-prod-session"

[[ -f "$IMG" ]] || { echo "REFUSED — no image $IMG" >&2; exit 2; }
[[ -s "$SESSION_FILE" ]] || { echo "REFUSED — $SESSION_FILE is missing or empty" >&2; exit 2; }
[[ "$SIDE" == "YES" || "$SIDE" == "NO" ]] || { echo "REFUSED — side must be YES or NO" >&2; exit 2; }

TOKEN="$(tr -d '\r\n' <"$SESSION_FILE")"
COOKIE="__Secure-zugzwang_session=$TOKEN"
SIZE="$(stat -f%z "$IMG")"
UA="Mozilla/5.0"

sign="$(curl -s -A "$UA" -H "Origin: $B" -H "Cookie: $COOKIE" \
	-H "content-type: application/json" \
	-d "{\"contentType\":\"image/png\",\"byteSize\":$SIZE}" \
	-w $'\n%{http_code}' "$B/api/uploads/sign")"
sign_code="${sign##*$'\n'}"
sign_body="${sign%$'\n'*}"
echo "[post $N] sign -> $sign_code"
[[ "$sign_code" == "200" ]] || { echo "$sign_body" >&2; exit 1; }

upload_id="$(python3 -c 'import sys,json; print(json.loads(sys.argv[1])["data"]["uploadId"])' "$sign_body")"
put_url="$(python3 -c 'import sys,json; print(json.loads(sys.argv[1])["data"]["putUrl"])' "$sign_body")"

put_code="$(curl -s -X PUT -H "content-type: image/png" -H "If-None-Match: *" \
	--data-binary @"$IMG" -o /dev/null -w '%{http_code}' "$put_url")"
echo "[post $N] R2 PUT -> $put_code"
[[ "$put_code" == "200" || "$put_code" == "412" ]] || exit 1

idem="$(python3 -c 'import uuid; print(uuid.uuid4())')"
payload="$(python3 -c '
import json, sys
n, side, market, upload = sys.argv[1:5]
print(json.dumps({
    "marketId": market,
    "side": side,
    "stake": "10",
    "body": f"Load test post {n} - checking the market page stays fast as image posts are added one at a time.",
    "imageUploadsId": upload,
}))' "$N" "$SIDE" "$MARKET_ID" "$upload_id")"

place="$(curl -s -A "$UA" -H "Origin: $B" -H "Cookie: $COOKIE" \
	-H "content-type: application/json" -H "Idempotency-Key: $idem" \
	-d "$payload" -w $'\n%{http_code}' "$B/api/bets/place")"
place_code="${place##*$'\n'}"
echo "[post $N] place -> $place_code"
echo "${place%$'\n'*}" | head -c 800
echo
[[ "$place_code" == "200" || "$place_code" == "201" ]]
