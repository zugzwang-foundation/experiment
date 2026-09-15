# Production load test — mumbai-bmc-pink-october-disclosure

Started 2026-09-15T12:50:10Z · kit 063ddb9 · rig zugzwang@100.74.9.117 · canary 995d09e
REFUSED — ~/.zz-prod-session missing. Save the __Secure-zugzwang_session cookie value there.
# Production load test — mumbai-bmc-pink-october-disclosure

Started 2026-09-15T13:00:16Z · kit 063ddb9 · rig zugzwang@100.74.9.117 · canary 995d09e
Test account: OrangeArmadillo643
Deploying kit to the DGX…
Images: 33

## 1. Single-visitor baseline

| Page | Status | Median total | Median TTFB | Bytes |
|---|---|---|---|---|
| `/` | 200 | 743 ms | 267 ms | 75481 |
| `/sign-in` | 200 | 434 ms | 254 ms | 145214 |
| `/m/mumbai-bmc-pink-october-disclosure` | 200 | 403 ms | 248 ms | 71300 |
| `/u/OrangeArmadillo643` | 200 | 371 ms | 263 ms | 64528 |

## 2. k6 runs

| Run | Script | Vars | Result | DB |
|---|---|---|---|---|
| mumbai-00posts-market | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=100 | requests=3204  success=100.00%  p50=102 ms  p95=449 ms  p99=4333 ms  rate_limited_429=0  no_response=0  dropped_iterations=45 | db after: error |
   db health ok after 120 s

## 3. One image post at a time

- post 1 ok (try 1) commentId 01a0a52c-1182-792f-b64a-f21ce99878e8 price 0.1001
  WARNING not found on the page yet
  ordinal: 1

| Run | Script | Vars | Result | DB |
|---|---|---|---|---|
| mumbai-01posts-market | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=100 | requests=3205  success=100.00%  p50=78 ms  p95=1406 ms  p99=2294 ms  rate_limited_429=0  no_response=0  dropped_iterations=44 | db after: ok |
   db health ok after 0 s
| mumbai-01posts-deeplink-1 | read/05-image-post.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure POST_ID=1 PEAK_RATE=100 | requests=3238  success=100.00%  p50=141 ms  p95=940 ms  p99=3651 ms  rate_limited_429=0  no_response=0  dropped_iterations=11 | db after: ok |
   db health ok after 0 s

- post 2 ok (try 1) commentId 01a0a530-5385-74aa-8a2f-eb5b83cc45f6 price 0.1003
  WARNING not found on the page yet
  ordinal: 1

| Run | Script | Vars | Result | DB |
|---|---|---|---|---|
| mumbai-02posts-market | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=100 | requests=2950  success=99.97%  p50=305 ms  p95=8647 ms  p99=14798 ms  rate_limited_429=0  no_response=1  dropped_iterations=298 | db after: ok |
   db health ok after 0 s
| mumbai-02posts-deeplink-1 | read/05-image-post.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure POST_ID=1 PEAK_RATE=100 | requests=3249  success=100.00%  p50=151 ms  p95=379 ms  p99=3539 ms  rate_limited_429=0  no_response=0  dropped_iterations=0 | db after: ok |
   db health ok after 0 s

- post 3 ok (try 1) commentId 01a0a535-2c65-7340-8fdc-1d68de765bba price 0.1005
  WARNING not found on the page yet
  ordinal: 1

| Run | Script | Vars | Result | DB |
|---|---|---|---|---|
| mumbai-03posts-market | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=100 | requests=3013  success=99.97%  p50=1306 ms  p95=6830 ms  p99=12468 ms  rate_limited_429=0  no_response=1  dropped_iterations=236 | db after: ok |
   db health ok after 0 s
| mumbai-03posts-deeplink-1 | read/05-image-post.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure POST_ID=1 PEAK_RATE=100 | requests=3110  success=99.49%  p50=149 ms  p95=7336 ms  p99=18582 ms  rate_limited_429=0  no_response=16  dropped_iterations=139 | db after: ok |
   db health ok after 0 s

## 4. Ladder (stops at the first rung under 50% success)

| Run | Script | Vars | Result | DB |
|---|---|---|---|---|
| mumbai-ladder-200 | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=200 | requests=5457  success=99.96%  p50=636 ms  p95=17571 ms  p99=27765 ms  rate_limited_429=0  no_response=2  dropped_iterations=1035 | db after: ok |
   db health ok after 0 s
| mumbai-ladder-300 | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=300 | requests=6239  success=99.79%  p50=2682 ms  p95=29465 ms  p99=43389 ms  rate_limited_429=0  no_response=13  dropped_iterations=3476 | db after: ok |
   db health ok after 0 s

## 5. Page-wise battery

| Run | Script | Vars | Result | DB |
|---|---|---|---|---|
| pw-signin-20 | read/02-sign-in.js | PEAK_RATE=20 | requests=850  success=100.00%  p50=212 ms  p95=534 ms  p99=804 ms  rate_limited_429=0  no_response=0  dropped_iterations=0 | db after: ok |
   db health ok after 0 s
| pw-signin-100 | read/02-sign-in.js | PEAK_RATE=100 | requests=3171  success=99.62%  p50=5520 ms  p95=30541 ms  p99=47435 ms  rate_limited_429=0  no_response=12  dropped_iterations=1066 | db after: ok |
   db health ok after 0 s
| pw-home-100 | read/03-homepage.js | PEAK_RATE=100 | requests=2743  success=98.65%  p50=6432 ms  p95=39354 ms  p99=57740 ms  rate_limited_429=0  no_response=37  dropped_iterations=1490 | db after: ok |
   db health ok after 0 s
| pw-home-200 | read/03-homepage.js | PEAK_RATE=200 | requests=7455  success=92.80%  p50=472 ms  p95=6272 ms  p99=26375 ms  rate_limited_429=0  no_response=537  dropped_iterations=983 | db after: ok |
   db health ok after 0 s
| pw-market-bitcoin-price-50k | read/04-market-page.js | MARKET_SLUG=bitcoin-price-50k PEAK_RATE=100 | requests=2538  success=97.75%  p50=575 ms  p95=12306 ms  p99=19351 ms  rate_limited_429=0  no_response=57  dropped_iterations=710 | db after: error |
   WARNING db health still 'error' after 300 s
| pw-market-chess-fide-tiebreak-response | read/04-market-page.js | MARKET_SLUG=chess-fide-tiebreak-response PEAK_RATE=100 | requests=700  success=34.00%  p50=44594 ms  p95=59692 ms  p99=60001 ms  rate_limited_429=0  no_response=462  dropped_iterations=2475 | db after: ok |
   db health ok after 0 s
| pw-market-claude-bundle-response | read/04-market-page.js | MARKET_SLUG=claude-bundle-response PEAK_RATE=100 | requests=3191  success=100.00%  p50=148 ms  p95=1359 ms  p99=4056 ms  rate_limited_429=0  no_response=0  dropped_iterations=58 | db after: ok |
   db health ok after 0 s
| pw-market-github-zugzwang-repo-stars | read/04-market-page.js | MARKET_SLUG=github-zugzwang-repo-stars PEAK_RATE=100 | requests=3082  success=99.87%  p50=214 ms  p95=6134 ms  p99=11307 ms  rate_limited_429=0  no_response=4  dropped_iterations=167 | db after: ok |
   db health ok after 0 s
| pw-market-math-erdos-contribution-response | read/04-market-page.js | MARKET_SLUG=math-erdos-contribution-response PEAK_RATE=100 | requests=3243  success=100.00%  p50=109 ms  p95=1058 ms  p99=1888 ms  rate_limited_429=0  no_response=0  dropped_iterations=6 | db after: error |
   db health ok after 200 s
| pw-market-oktoberfest-munich-beer-volume | read/04-market-page.js | MARKET_SLUG=oktoberfest-munich-beer-volume PEAK_RATE=100 | requests=3172  success=98.71%  p50=127 ms  p95=3920 ms  p99=11537 ms  rate_limited_429=0  no_response=41  dropped_iterations=77 | db after: ok |
   db health ok after 0 s
| pw-market-yc-paper-club-response | read/04-market-page.js | MARKET_SLUG=yc-paper-club-response PEAK_RATE=100 | requests=3249  success=100.00%  p50=122 ms  p95=699 ms  p99=3212 ms  rate_limited_429=0  no_response=0  dropped_iterations=0 | db after: ok |
   db health ok after 0 s
| pw-profile-100 | read/06-profile.js | PSEUDONYM=OrangeArmadillo643 PEAK_RATE=100 | requests=4207  success=99.98%  p50=246 ms  p95=1490 ms  p99=2028 ms  rate_limited_429=0  no_response=1  dropped_iterations=42 | db after: error |
   db health ok after 30 s
| pw-profile-200 | read/06-profile.js | PSEUDONYM=OrangeArmadillo643 PEAK_RATE=200 | requests=7221  success=100.00%  p50=1852 ms  p95=19590 ms  p99=32124 ms  rate_limited_429=0  no_response=0  dropped_iterations=1265 | db after: error |
   db health ok after 20 s
| pw-mixed-200 | read/07-mixed-read.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PSEUDONYM=OrangeArmadillo643 PEAK_RATE=200 | requests=4551  success=92.55%  p50=6620 ms  p95=57098 ms  p99=60000 ms  rate_limited_429=0  no_response=339  dropped_iterations=3570 | db after: ok |
   db health ok after 0 s
> RIG-BOUND rows: /sign-in (822 KB) at any rate, and any market page over ~150 KB above 50 req/s. The DGX pulls ~2 MB/s per stream, ~15 MB/s total; those rows measure the rig, not the server.

## 6. Seed 30 more image posts

- post 4 ok (try 1) commentId 01a0a568-cf45-7661-82df-a498fd0d975c price 0.1007
- post 5 ok (try 1) commentId 01a0a568-e5a7-7d24-acb3-fa8226d18f22 price 0.1009
- post 6 ok (try 1) commentId 01a0a569-0a63-7511-8ad9-5b82cd8b9a77 price 0.1010
- post 7 ok (try 1) commentId 01a0a569-2085-758d-9363-2b200624c691 price 0.1012
- post 8 ok (try 1) commentId 01a0a569-3622-7590-a6a0-9e08dd3ce490 price 0.1014
- post 9 ok (try 1) commentId 01a0a569-4bba-7b13-9d7f-73d3a73d63f5 price 0.1016
- post 10 ok (try 1) commentId 01a0a569-631e-7faf-bb58-a394631573f6 price 0.1018
- post 11 ok (try 1) commentId 01a0a569-7b35-7225-b7a0-d4bf6888c300 price 0.1019
- post 12 ok (try 1) commentId 01a0a569-931e-7fe2-882b-9969af4ceb2c price 0.1021
- post 13 ok (try 1) commentId 01a0a569-a7f4-7420-a8e0-75e09742a38f price 0.1023
- post 14 ok (try 1) commentId 01a0a569-c5f6-7973-9809-cfd1df211bf0 price 0.1025
- post 15 ok (try 1) commentId 01a0a569-dcd9-7464-b13f-2666b6af6332 price 0.1027
- post 16 ok (try 1) commentId 01a0a569-f35b-7530-9237-f35cbec0ae61 price 0.1028
- post 17 ok (try 1) commentId 01a0a56a-0c15-7909-bc49-9063f8c362c2 price 0.1030
- post 18 ok (try 1) commentId 01a0a56a-255e-7f16-8aad-6925514dbbe4 price 0.1032
- post 19 ok (try 1) commentId 01a0a56a-4531-7ed4-905e-ea06770071bb price 0.1034
- post 20 ok (try 1) commentId 01a0a56a-65c6-797d-a36e-6461b5faf38e price 0.1036
- post 21 ok (try 1) commentId 01a0a56a-7ebb-7deb-b1f5-5a1dd09f162d price 0.1038
- post 22 ok (try 1) commentId 01a0a56a-91ff-767f-b404-0ca61d25f356 price 0.1039
- post 23 ok (try 1) commentId 01a0a56a-a7f4-740a-bd61-c2a1d590e99e price 0.1041
- post 24 ok (try 1) commentId 01a0a56a-bed4-7bca-93bf-4523f202c10a price 0.1043
- post 25 ok (try 1) commentId 01a0a56a-d96e-7bd1-ba4f-9c4b2b4806b1 price 0.1045
- post 26 ok (try 1) commentId 01a0a56a-f197-7f43-9104-3c6012cb6253 price 0.1047
- post 27 ok (try 1) commentId 01a0a56b-0bf5-7cb1-894a-85b9834530f9 price 0.1048
- post 28 ok (try 1) commentId 01a0a56b-2798-7995-864e-ba53babf9ec4 price 0.1050
- post 29 ok (try 1) commentId 01a0a56b-438e-7077-aa49-3b9155b7d5cb price 0.1052
- post 30 ok (try 1) commentId 01a0a56b-67a6-72e2-83d9-1ef995930f51 price 0.1054
- post 31 ok (try 1) commentId 01a0a56b-8104-7605-bf05-4d4cf8e19357 price 0.1056
- post 32 ok (try 1) commentId 01a0a56b-94c7-7987-8d87-350c0bd03ead price 0.1058
- post 33 ok (try 1) commentId 01a0a56b-abf0-75b7-b15a-b47a5bd7659c price 0.1059

Placed 30 of 30. Page now 441422 bytes; load-test posts visible: 33

## 7. Seeded page

| Run | Script | Vars | Result | DB |
|---|---|---|---|---|
| seeded-market-20 | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=20 | requests=603  success=100.00%  p50=839 ms  p95=5743 ms  p99=8010 ms  rate_limited_429=0  no_response=0  dropped_iterations=46 | db after: ok |
   db health ok after 0 s
| seeded-market-50 | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=50 | requests=993  success=99.90%  p50=6642 ms  p95=24145 ms  p99=29224 ms  rate_limited_429=0  no_response=1  dropped_iterations=647 | db after: ok |
   db health ok after 0 s
| seeded-market-100 | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=100 | requests=1118  success=90.79%  p50=22463 ms  p95=58568 ms  p99=60000 ms  rate_limited_429=0  no_response=103  dropped_iterations=2125 | db after: ok |
   db health ok after 0 s
| seeded-market-200 | read/04-market-page.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=200 | requests=1508  success=54.64%  p50=40715 ms  p95=59594 ms  p99=60000 ms  rate_limited_429=0  no_response=684  dropped_iterations=4821 | db after: ok |
   db health ok after 0 s
| seeded-deeplink-10 | read/05-image-post.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure POST_ID=10 PEAK_RATE=100 | requests=2602  success=97.35%  p50=2684 ms  p95=17967 ms  p99=34176 ms  rate_limited_429=0  no_response=69  dropped_iterations=644 | db after: ok |
   db health ok after 0 s
| seeded-deeplink-20 | read/05-image-post.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure POST_ID=20 PEAK_RATE=100 | requests=3212  success=99.75%  p50=65 ms  p95=432 ms  p99=5685 ms  rate_limited_429=0  no_response=8  dropped_iterations=37 | db after: error |
   db health ok after 240 s
| seeded-deeplink-1 | read/05-image-post.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure POST_ID=1 PEAK_RATE=100 | requests=2903  success=100.00%  p50=516 ms  p95=11120 ms  p99=18795 ms  rate_limited_429=0  no_response=0  dropped_iterations=346 | db after: ok |
   db health ok after 0 s
| seeded-hotspot-200 | read/08-hotspot.js | MARKET_SLUG=mumbai-bmc-pink-october-disclosure PEAK_RATE=200 | requests=1023  success=82.60%  p50=25427 ms  p95=58916 ms  p99=59654 ms  rate_limited_429=0  no_response=178  dropped_iterations=4206 | db after: ok |
   db health ok after 0 s

## 8. Write tests (one account, real endpoints)

canary before: 1e57531
- {"test": "bet_place_burst_25", "attempted": 25, "succeeded": 3, "outcomes": {"place:500": 22, "ok": 3}, "wall_s": 3.1, "p50_ms": 1898, "max_ms": 3137}
- {"test": "image_post_burst_10", "attempted": 10, "succeeded": 2, "outcomes": {"sign:500": 7, "ok": 2, "place:500": 1}, "wall_s": 3.8, "p50_ms": 2461, "max_ms": 2478}
- {"test": "reply_burst_3", "attempted": 3, "succeeded": 0, "outcomes": {"error_invalid_request_body": 2, "place:500": 1}, "wall_s": 0.6, "p50_ms": 612, "max_ms": 615}
- {"test": "sell_burst_5", "attempted": 5, "succeeded": 2, "outcomes": {"ok": 2, "http500": 3}, "wall_s": 1.1, "p50_ms": 551, "max_ms": 1042}
canary after: 1e57531  (if it changed, a deploy landed during the bursts; rerun the 25-way burst once it is stable)

## 9. Collect
WARNING scp of raw results failed — copy ~/prod-load-kit/load/results/ off the DGX later
report: /Users/adityagour/Downloads/zz_PROD-LOADTEST_mumbai_2026-09-15/report.xlsx

Finished 2026-09-15T14:43:44Z. Cookie file deleted — sign the test account (OrangeArmadillo643) out in the browser.
Leftovers on the live market: 33 seed posts plus the write-test bets by OrangeArmadillo643 (append-only; sell out of them or ask the founder to void).
