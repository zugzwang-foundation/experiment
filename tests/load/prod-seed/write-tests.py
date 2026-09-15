"""Single-account write tests over the real production endpoints.

Mirrors staging T-06 (bet place over HTTP), T-08 (sell), T-12 (reply) and
T-13 (concurrent image uploads) using ONE signed-in participant. Every request
is what the browser composer sends. Results are printed as JSON lines and
summarised; nothing here reads or writes the database directly.

    python3 write-tests.py <marketId> <parentCommentIdForReplies>
"""

import concurrent.futures as cf
import json
import os
import sys
import time
import uuid
import urllib.request
import urllib.error

B = "https://zugzwangworld.com"
TOKEN = open(os.path.expanduser("~/.zz-prod-session")).read().strip()
HDR = {
    "Cookie": f"__Secure-zugzwang_session={TOKEN}",
    "Origin": B,
    "User-Agent": "Mozilla/5.0",
    "content-type": "application/json",
}
HERE = os.path.dirname(os.path.abspath(__file__))
MARKET, PARENT = sys.argv[1], sys.argv[2]


def call(path, body, extra=None, method="POST", raw=None, timeout=60):
    data = raw if raw is not None else json.dumps(body).encode()
    req = urllib.request.Request(B + path if path.startswith("/") else path, data=data, method=method)
    for k, v in {**(HDR if path.startswith("/") else {}), **(extra or {})}.items():
        req.add_header(k, v)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode(errors="replace"), time.time() - t0
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace"), time.time() - t0
    except Exception as e:  # network-level
        return 0, str(e), time.time() - t0


def place(stake, body, image_path=None, parent=None):
    payload = {"marketId": MARKET, "side": "YES", "stake": str(stake), "body": body}
    if parent:
        payload["parentCommentId"] = parent
        payload["side"] = "NO"  # a counter-argument; refused if the account holds YES — that is the test
    if image_path:
        size = os.path.getsize(image_path)
        s, b, _ = call("/api/uploads/sign", {"contentType": "image/png", "byteSize": size})
        if s != 200:
            return {"stage": "sign", "status": s, "body": b[:160]}
        d = json.loads(b)["data"]
        with open(image_path, "rb") as f:
            ps, pb, _ = call(d["putUrl"], None, {"content-type": "image/png", "If-None-Match": "*"},
                             method="PUT", raw=f.read())
        if ps not in (200, 412):
            return {"stage": "put", "status": ps, "body": pb[:160]}
        payload["imageUploadsId"] = d["uploadId"]
    s, b, dt = call("/api/bets/place", payload, {"Idempotency-Key": str(uuid.uuid4())})
    out = {"stage": "place", "status": s, "ms": round(dt * 1000)}
    try:
        j = json.loads(b)
        out["code"] = j.get("error", {}).get("code") if not j.get("ok") else "ok"
        if j.get("ok"):
            out["shares"] = j["data"]["sharesBought"]
            out["price"] = j["data"]["newPrice"]
    except Exception:
        out["body"] = b[:120]
    return out


def burst(name, n, fn):
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=n) as ex:
        results = list(ex.map(lambda i: fn(i), range(n)))
    codes = {}
    for r in results:
        key = r.get("code") or f"{r['stage']}:{r['status']}"
        codes[key] = codes.get(key, 0) + 1
    ok = sum(1 for r in results if r.get("code") == "ok")
    ms = sorted(r["ms"] for r in results if "ms" in r)
    p50 = ms[len(ms) // 2] if ms else None
    summary = {"test": name, "attempted": n, "succeeded": ok, "outcomes": codes,
               "wall_s": round(time.time() - t0, 1), "p50_ms": p50, "max_ms": ms[-1] if ms else None}
    print(json.dumps(summary))
    return results


if __name__ == "__main__":
    print(json.dumps({"start": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}))
    # T-06 — concurrent bet placement over HTTP, 25 at once, 10 Đ each.
    burst("bet_place_burst_25", 25, lambda i: place(10, f"Concurrent bet burst {i + 1}/25 over the real endpoint."))
    time.sleep(65)  # let the per-IP window (30/min) reset before the next burst
    # T-13 — concurrent image posts, 10 at once.
    burst("image_post_burst_10", 10,
          lambda i: place(10, f"Concurrent image post {i + 1}/10.", image_path=os.path.join(HERE, f"post-{4 + i}.png")))
    time.sleep(65)
    # T-12 — replies. The account holds YES, so a NO counter-reply is refused by
    # the one-side rule; a YES support-reply is what this account can place.
    def reply(i):
        r = place(50, f"Support reply {i + 1}/3 under load.", parent=PARENT)
        if r.get("code") == "opposite_side_held":
            payload = {"marketId": MARKET, "side": "YES", "stake": "50",
                       "body": f"Support reply {i + 1}/3 under load.", "parentCommentId": PARENT}
            s, b, dt = call("/api/bets/place", payload, {"Idempotency-Key": str(uuid.uuid4())})
            j = json.loads(b) if b.startswith("{") else {}
            r = {"stage": "place", "status": s, "ms": round(dt * 1000),
                 "code": "ok" if j.get("ok") else j.get("error", {}).get("code", f"http{s}")}
        return r
    burst("reply_burst_3", 3, reply)
    time.sleep(65)
    # T-08 — concurrent sells: sell 5 shares five times at once.
    def sell(i):
        s, b, dt = call("/api/bets/sell", {"marketId": MARKET, "shares": "5"}, {"Idempotency-Key": str(uuid.uuid4())})
        j = json.loads(b) if b.startswith("{") else {}
        return {"stage": "sell", "status": s, "ms": round(dt * 1000),
                "code": "ok" if j.get("ok") else j.get("error", {}).get("code", f"http{s}")}
    burst("sell_burst_5", 5, sell)
    print(json.dumps({"end": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}))
