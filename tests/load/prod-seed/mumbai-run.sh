#!/usr/bin/env bash
# ONE-SHOT production load test of a market, end to end. Reads run on the DGX
# through k6; posts and write bursts run from this machine through the site's
# real endpoints. Logs everything under ~/Downloads/<RUN_TAG>/.
set -uo pipefail

MARKET_SLUG="${MARKET_SLUG:-mumbai-bmc-pink-october-disclosure}"
MARKET_ID="${MARKET_ID:-01a0a0bb-4e2f-722e-96d4-62139198223a}"
SEED_COUNT="${SEED_COUNT:-30}"
DGX="${DGX:-zugzwang@100.74.9.117}"
B="https://zugzwangworld.com"
RUN_TAG="${RUN_TAG:-zz_PROD-LOADTEST_mumbai_$(date -u +%Y-%m-%d)}"
OUT="$HOME/Downloads/$RUN_TAG"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
KIT_COMMIT="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)"
LOG="$OUT/log.md"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 $DGX"
mkdir -p "$OUT/results" "$OUT/images"

say() { printf '%s\n' "$*" | tee -a "$LOG"; }
health() { curl -s --max-time 15 "$B/api/health"; }
db_state() { health | grep -oE '"db":"[a-z]+"' | cut -d'"' -f4; }
canary() { health | grep -oE '"canary":"[0-9a-f]{7}' | cut -d'"' -f4; }
wait_db_ok() {
	local i s
	for i in $(seq 0 30); do
		s="$(db_state)"
		[[ "$s" == "ok" ]] && { say "   db health ok after $((i * 10)) s"; return; }
		sleep 10
	done
	say "   WARNING db health still '$s' after 300 s"
}
k6run() { # k6run <run_id> <script> [VAR=val ...]
	local id="$1" script="$2"; shift 2
	local vars="$*" line
	line="$($SSH "export PATH=\$HOME/.local/bin:\$PATH; cd ~/prod-load-kit/load && KIT_COMMIT=$KIT_COMMIT TARGET_URL=$B $vars RUN_ID=$id ./run.sh $script 2>&1 | grep -E '^requests='" 2>/dev/null)"
	[[ -z "$line" ]] && line="$($SSH "cat ~/prod-load-kit/load/results/$id/summary.txt 2>/dev/null" 2>/dev/null)"
	say "| $id | $script | ${vars:-—} | ${line:-NO RESULT (ssh dropped and no summary on the DGX)} | db after: $(db_state) |"
	wait_db_ok
	sleep 60
}
cookie_ok() {
	curl -s -A Mozilla/5.0 -H "Cookie: __Secure-zugzwang_session=$(cat ~/.zz-prod-session)" "$B/api/auth/get-session" | grep -oE '"pseudonym":"[A-Za-z0-9]+"' | cut -d'"' -f4
}
ordinal_of() { # ordinal_of <commentId>
	local n
	for n in $(seq 1 80); do
		curl -s -A Mozilla/5.0 "$B/m/$MARKET_SLUG?post=$n" | grep -q "initialPostId.\{0,4\}$1" && { echo "$n"; return; }
	done
	echo "?"
}
post() { # post <n> -> commentId on stdout; retried 3x
	# NOTE: post-one.sh resolves its image as "$(dirname "$0")/post-<n>.png",
	# i.e. relative to the SCRIPT, not the cwd. It is therefore invoked from the
	# copy placed in "$OUT/images" during preflight — the same pattern this
	# script already uses for write-tests.py. Calling "$HERE/post-one.sh" after
	# a plain `cd` would look for the image in tests/load/prod-seed/ and refuse
	# every post with "no image", silently placing nothing for the whole run.
	local n="$1" try out cid
	for try in 1 2 3; do
		out="$("$OUT/images/post-one.sh" "$n" YES "$MARKET_ID" 2>&1)"
		if grep -q '"ok":true' <<<"$out"; then
			cid="$(grep -oE '"commentId":"[0-9a-f-]{36}' <<<"$out" | cut -d'"' -f4)"
			say "- post $n ok (try $try) commentId $cid price $(grep -oE '"newPrice":"0\.[0-9]{4}' <<<"$out" | cut -d'"' -f4)"
			echo "$cid"; return
		fi
		say "- post $n try $try failed: $(grep -oE 'sign -> [0-9]+|R2 PUT -> [0-9]+|place -> [0-9]+|"code":"[a-z_]+"' <<<"$out" | tr '\n' ' ')"
		sleep 5
	done
	echo ""
}

# ---- preflight (refuses by itself; nothing to ask a human)
say "# Production load test — $MARKET_SLUG"
say ""
say "Started $(date -u +%FT%TZ) · kit $KIT_COMMIT · rig $DGX · canary $(canary)"
[[ -s ~/.zz-prod-session ]] || { say "REFUSED — ~/.zz-prod-session missing. Save the __Secure-zugzwang_session cookie value there."; exit 2; }
PSEUDONYM="$(cookie_ok)"
[[ -n "$PSEUDONYM" ]] || { say "REFUSED — the cookie is not a live session (name must be __Secure-zugzwang_session; is the account signed in?)."; exit 2; }
say "Test account: $PSEUDONYM"
[[ "$(db_state)" == "ok" ]] || { say "REFUSED — production health is not ok: $(health)"; exit 2; }
$SSH 'echo ok' >/dev/null 2>&1 || { say "REFUSED — cannot ssh to $DGX (approve the Tailscale link, or the DGX is off). Try: ssh $DGX"; exit 2; }
python3 -c "import PIL" 2>/dev/null || { say "REFUSED — python3 Pillow missing: pip3 install pillow"; exit 2; }
python3 -c "import openpyxl" 2>/dev/null || { say "REFUSED — python3 openpyxl missing: pip3 install openpyxl"; exit 2; }
cp "$HERE/post-one.sh" "$OUT/images/" && chmod +x "$OUT/images/post-one.sh" || { say "REFUSED — could not stage post-one.sh beside the images"; exit 2; }
say "Deploying kit to the DGX…"
scp -q -r "$REPO/tests/load" "$DGX:~/prod-load-kit/" && $SSH 'chmod +x ~/prod-load-kit/load/run.sh' || { say "REFUSED — could not copy the kit to the DGX"; exit 2; }
python3 - "$OUT/images" "$SEED_COUNT" <<'EOF'
import sys, random
from PIL import Image, ImageDraw, ImageFont
out, total = sys.argv[1], int(sys.argv[2]) + 3
def font(size):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        try: return ImageFont.truetype(p, size)
        except Exception: pass
    return ImageFont.load_default()
random.seed(7)
for n in range(1, total + 1):
    W, H = 1200, 800; img = Image.new("RGB", (W, H), (18, 18, 18)); d = ImageDraw.Draw(img)
    for _ in range(50):
        x, y = random.randint(0, W), random.randint(0, H); r = random.randint(15, 150); g = random.randint(40, 120)
        d.ellipse([x - r, y - r, x + r, y + r], outline=(g, g, g), width=random.randint(2, 5))
    d.text((W / 2, H / 2), str(n), fill=(245, 245, 245), font=font(340), anchor="mm")
    d.text((W / 2, H - 70), f"load test image {n}", fill=(170, 170, 170), font=font(44), anchor="mm")
    img.save(f"{out}/post-{n}.png", "PNG", optimize=True)
EOF
say "Images: $(ls "$OUT/images"/post-*.png 2>/dev/null | wc -l | tr -d ' ')"
say ""

# ---- 1. baseline
say "## 1. Single-visitor baseline"; say ""
say "| Page | Status | Median total | Median TTFB | Bytes |"; say "|---|---|---|---|---|"
for p in / /sign-in "/m/$MARKET_SLUG" "/u/$PSEUDONYM"; do
	vals=(); for i in 1 2 3 4 5; do vals+=("$(curl -s -A Mozilla/5.0 -o /dev/null -w '%{http_code},%{time_total},%{time_starttransfer},%{size_download}' "$B$p")"); done
	say "$(python3 -c '
import sys, statistics as s
p = sys.argv[1]; rows = [r.split(",") for r in sys.argv[2:]]
print("| `%s` | %s | %.0f ms | %.0f ms | %s |" % (p, "/".join(sorted({r[0] for r in rows})), s.median(float(r[1]) * 1000 for r in rows), s.median(float(r[2]) * 1000 for r in rows), rows[-1][3]))' "$p" "${vals[@]}")"
done
say ""

# ---- 2. step 0
say "## 2. k6 runs"; say ""
say "| Run | Script | Vars | Result | DB |"; say "|---|---|---|---|---|"
k6run mumbai-00posts-market read/04-market-page.js MARKET_SLUG=$MARKET_SLUG PEAK_RATE=100

# ---- 3. posts 1–3, test after each
say ""; say "## 3. One image post at a time"; say ""
declare -a CIDS=()
for n in 1 2 3; do
	cid="$(post "$n")"
	[[ -n "$cid" ]] || { say "WARNING post $n never succeeded — continuing"; continue; }
	CIDS+=("$cid"); sleep 5
	curl -s -A Mozilla/5.0 "$B/m/$MARKET_SLUG" | grep -q "$cid" && say "  renders on the page: yes" || say "  WARNING not found on the page yet"
	ord="$(ordinal_of "$cid")"; say "  ordinal: $ord"
	say ""; say "| Run | Script | Vars | Result | DB |"; say "|---|---|---|---|---|"
	k6run "mumbai-0${n}posts-market" read/04-market-page.js MARKET_SLUG=$MARKET_SLUG PEAK_RATE=100
	[[ "$ord" != "?" ]] && k6run "mumbai-0${n}posts-deeplink-$ord" read/05-image-post.js MARKET_SLUG=$MARKET_SLUG POST_ID=$ord PEAK_RATE=100
	say ""
done

# ---- 4. ladder
say "## 4. Ladder (stops at the first rung under 50% success)"; say ""
say "| Run | Script | Vars | Result | DB |"; say "|---|---|---|---|---|"
for r in 200 300; do
	k6run "mumbai-ladder-$r" read/04-market-page.js MARKET_SLUG=$MARKET_SLUG PEAK_RATE=$r
	succ="$($SSH "grep -oE 'success=[0-9]+' ~/prod-load-kit/load/results/mumbai-ladder-$r/summary.txt" 2>/dev/null | cut -d= -f2)"
	[[ -n "$succ" && "$succ" -lt 50 ]] && { say "   break found at $r req/s — not going higher"; break; }
done

# ---- 5. page-wise
say ""; say "## 5. Page-wise battery"; say ""
say "| Run | Script | Vars | Result | DB |"; say "|---|---|---|---|---|"
k6run pw-signin-20 read/02-sign-in.js PEAK_RATE=20
k6run pw-signin-100 read/02-sign-in.js PEAK_RATE=100
k6run pw-home-100 read/03-homepage.js PEAK_RATE=100
k6run pw-home-200 read/03-homepage.js PEAK_RATE=200
for s in bitcoin-price-50k chess-fide-tiebreak-response claude-bundle-response github-zugzwang-repo-stars math-erdos-contribution-response oktoberfest-munich-beer-volume yc-paper-club-response; do
	k6run "pw-market-$s" read/04-market-page.js MARKET_SLUG=$s PEAK_RATE=100
done
k6run pw-profile-100 read/06-profile.js PSEUDONYM=$PSEUDONYM PEAK_RATE=100
k6run pw-profile-200 read/06-profile.js PSEUDONYM=$PSEUDONYM PEAK_RATE=200
k6run pw-mixed-200 read/07-mixed-read.js MARKET_SLUG=$MARKET_SLUG PSEUDONYM=$PSEUDONYM PEAK_RATE=200
say "> RIG-BOUND rows: /sign-in (822 KB) at any rate, and any market page over ~150 KB above 50 req/s. The DGX pulls ~2 MB/s per stream, ~15 MB/s total; those rows measure the rig, not the server."

# ---- 6. seed
say ""; say "## 6. Seed $SEED_COUNT more image posts"; say ""
placed=0; cid=""
for n in $(seq 4 $((SEED_COUNT + 3))); do
	c="$(post "$n")"; [[ -n "$c" ]] && { placed=$((placed + 1)); cid="$c"; }; sleep 2
done
page="$(curl -s -A Mozilla/5.0 "$B/m/$MARKET_SLUG")"
say ""; say "Placed $placed of $SEED_COUNT. Page now $(printf '%s' "$page" | wc -c | tr -d ' ') bytes; load-test posts visible: $(grep -oE 'Load test post [0-9]+' <<<"$page" | sort -u | wc -l | tr -d ' ')"
top="?"; [[ -n "$cid" ]] && top="$(ordinal_of "$cid")"

# ---- 7. seeded runs
say ""; say "## 7. Seeded page"; say ""
say "| Run | Script | Vars | Result | DB |"; say "|---|---|---|---|---|"
for r in 20 50 100 200; do k6run "seeded-market-$r" read/04-market-page.js MARKET_SLUG=$MARKET_SLUG PEAK_RATE=$r; done
for o in 10 20 "$top"; do [[ "$o" != "?" ]] && k6run "seeded-deeplink-$o" read/05-image-post.js MARKET_SLUG=$MARKET_SLUG POST_ID=$o PEAK_RATE=100; done
k6run seeded-hotspot-200 read/08-hotspot.js MARKET_SLUG=$MARKET_SLUG PEAK_RATE=200

# ---- 8. writes
say ""; say "## 8. Write tests (one account, real endpoints)"; say ""
say "canary before: $(canary)"
( cd "$OUT/images" && cp "$HERE/write-tests.py" . && python3 write-tests.py "$MARKET_ID" "${CIDS[0]:-}" 2>&1 | tee "$OUT/write-tests.jsonl" | grep -E '"test"' | sed 's/^/- /' | tee -a "$LOG" )
say "canary after: $(canary)  (if it changed, a deploy landed during the bursts; rerun the 25-way burst once it is stable)"

# ---- 9. collect and report
say ""; say "## 9. Collect"
scp -q -r "$DGX:~/prod-load-kit/load/results/*" "$OUT/results/" 2>/dev/null && say "raw results copied: $(ls "$OUT/results" | wc -l | tr -d ' ') folders" || say "WARNING scp of raw results failed — copy ~/prod-load-kit/load/results/ off the DGX later"
python3 "$HERE/build-report.py" "$OUT" "$MARKET_SLUG" && say "report: $OUT/report.xlsx"
rm -f ~/.zz-prod-session
say ""
say "Finished $(date -u +%FT%TZ). Cookie file deleted — sign the test account ($PSEUDONYM) out in the browser."
say "Leftovers on the live market: $((placed + 3)) seed posts plus the write-test bets by $PSEUDONYM (append-only; sell out of them or ask the founder to void)."
