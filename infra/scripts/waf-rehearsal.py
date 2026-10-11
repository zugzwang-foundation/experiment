"""WAF-RATE-1 — live rehearsal of the per-IP WAF rate limits, STAGING ONLY.

Run only after staging has been deployed with the WAF attached
(`ZZ_STAGING_WAF=count`), and only with the founder's approval. Every request
is a GET to a public page or file; nothing is written. All requests come from
this machine, i.e. ONE source IP, which is what many people behind one shared
address look like to the WAF.

Why paced, not burst: AWS WAF aggregates rate-based counts and starts blocking
with a lag of up to about a minute, so a short burst finishes before any rule
reacts. Each phase therefore sends at a steady rate for long enough that WAF
has time to see the count cross its limit. A 429 is attributed to the WAF only
when its body is the WAF's own message; other 429s (for example Better Auth's
built-in 100-per-10-seconds limit) are counted separately.

Usage: python infra/scripts/waf-rehearsal.py https://staging.zugzwangworld.com
"""

import re
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

ALLOWED = "https://staging.zugzwangworld.com"
WAF_BODY = "Too many requests from your network"
SLUG = "bitcoin-price-50k"


def get(url: str) -> tuple[int, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "zugzwang-waf-rehearsal"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
            return r.status, "", ""
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:200]
        return e.code, body, e.headers.get("Retry-After", "")
    except Exception as e:  # network error
        return 0, str(e)[:80], ""


def paced(label: str, base: str, paths: list[str], rate: float, workers: int = 16):
    """Sends `paths` in order at `rate` requests/second; reports the outcome."""
    results: list[tuple[int, int, str, str]] = []
    lock = threading.Lock()
    start = time.time()

    def one(i: int, path: str):
        status, body, retry = get(base + path)
        with lock:
            results.append((i, status, body, retry))

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for i, path in enumerate(paths, 1):
            due = start + (i - 1) / rate
            delay = due - time.time()
            if delay > 0:
                time.sleep(delay)
            pool.submit(one, i, path)
    results.sort()
    took = time.time() - start
    waf = [r for r in results if r[1] == 429 and WAF_BODY in r[2]]
    app429 = [r for r in results if r[1] == 429 and WAF_BODY not in r[2]]
    counts = Counter(r[1] for r in results)
    print(f"== {label}: {len(paths)} requests at {rate}/s over {took:.0f}s")
    print(f"   statuses: {dict(sorted(counts.items()))}")
    print(f"   WAF 429s: {len(waf)}  (first at request {waf[0][0] if waf else '-'})")
    print(f"   other 429s (app): {len(app429)}")
    if waf:
        print(f"   WAF 429 Retry-After: {waf[0][3]!r}  body: {waf[0][2]!r}")
    return waf


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else ""
    if base != ALLOWED:
        print(f"refusing: target must be {ALLOWED} (got {base!r})")
        sys.exit(2)
    page = urllib.request.urlopen(base + f"/m/{SLUG}", timeout=30).read().decode()
    statics = sorted(set(re.findall(r'/_next/static/[^"\\ ]+\.(?:js|css|woff2)', page)))
    print(f"Target {base} from one source IP; {len(statics)} static files per page load\n")

    # 1. 60 people behind ONE address each load a market page (page + its
    #    static files) within a minute. Expect no WAF 429.
    shared = []
    for _ in range(60):
        shared.append(f"/m/{SLUG}")
        shared.extend(statics)
    paced("shared IP: 60 cold page loads", base, shared, rate=30)

    # 2. Downloads, limit 30: 1 per second for 100 s. Expect WAF 429s after
    #    ~30 (plus WAF's reaction lag).
    paced("export (limit 30)", base, [f"/m/{SLUG}/export"] * 100, rate=1)

    # 3. Sign-in path, limit 100: 4 per second for 60 s (240), under Better
    #    Auth's own 100 per 10 s, so a 429 here is the WAF's.
    paced("auth (limit 100)", base, ["/api/auth/get-session"] * 240, rate=4)

    # 4. Static files, limit 5,000 (not the general 1,000): 1,500 at 10/s.
    #    Expect all 200 even though 1,500 > 1,000.
    paced("static (limit 5000)", base, [statics[0]] * 1500, rate=10)

    # 5. General dynamic, limit 1,000, on a cheap poll endpoint: 10 per second
    #    for 150 s. Phases 1-3 already counted ~400 dynamic requests in the
    #    window, so expect WAF 429s after roughly 600-1,000 here plus the lag.
    paced("dynamic (limit 1000)", base, [f"/m/{SLUG}/version"] * 1500, rate=10)

    print("\nDone. Wait 5 minutes before re-running so the window clears.")


if __name__ == "__main__":
    main()
