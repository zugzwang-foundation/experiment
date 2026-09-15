"""Turn a mumbai-run.sh output folder into report.xlsx.

    python3 build-report.py <run folder> <market slug>
"""
import os, re, sys, json
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

run_dir, slug = sys.argv[1], sys.argv[2]
HEAD = PatternFill("solid", fgColor="1F2937"); HFONT = Font(bold=True, color="FFFFFF")
GREEN = PatternFill("solid", fgColor="D1FAE5"); AMBER = PatternFill("solid", fgColor="FEF3C7")
RED = PatternFill("solid", fgColor="FEE2E2"); GREY = PatternFill("solid", fgColor="E5E7EB")

# Measured HTML sizes, in bytes, AT THE TIME EACH RUN EXECUTED. The sizes move
# during a seeding run — the market page and the seeder's own profile both grow
# with every post — so one size per URL would mislabel the early rows. Measured
# with curl against production on 2026-09-15; see log.md's baseline table.
RIG_MBPS = 15.0  # the DGX's measured aggregate download ceiling
PAGE_BYTES = [
    # (run-id prefix, bytes) — first match wins, so put the specific ones first
    ("mumbai-00posts", 71_300), ("mumbai-01posts-deeplink", 85_700), ("mumbai-01posts", 85_700),
    ("mumbai-02posts-deeplink", 100_100), ("mumbai-02posts", 100_100),
    ("mumbai-03posts-deeplink", 114_576), ("mumbai-03posts", 114_576),
    ("mumbai-ladder", 114_576),
    ("pw-signin", 145_214), ("pw-home", 79_649), ("pw-profile", 64_528),
    ("pw-market-chess", 693_310), ("pw-market", 71_500), ("pw-mixed", 90_000),
    ("seeded-deeplink", 117_991), ("seeded-market", 441_422), ("seeded-hotspot", 441_422),
]


def page_bytes(run):
    for prefix, b in PAGE_BYTES:
        if run.startswith(prefix):
            return b
    return None


def needed_mbps(row):
    b, peak = page_bytes(row["run"]), row["peak"]
    if not b or not str(peak).isdigit():
        return None
    return round(b * int(peak) / 1e6, 1)


def status(row):
    """Classify a run, deciding RIG-BOUND by ARITHMETIC rather than by name.

    The supplied rule was `"sign-in" in script or ("seeded" in run and ...)`,
    which is a guess about which rows the rig could not carry. It throws away
    the two best server measurements in this campaign: sign-in at 20 req/s
    (2.9 MB/s, 100% at 212 ms) and every seeded DEEP LINK (a deep link renders
    one post, 118 KB, not the 441 KB full page). A row is rig-bound when the
    bytes it must pull exceed what the rig can pull, and that is a number we
    have, so it should not be a guess.
    """
    need = needed_mbps(row)
    if need is not None and need > RIG_MBPS: return "RIG-BOUND", GREY
    if row["success"] is None: return "NO RESULT", GREY
    if need is not None and need > RIG_MBPS * 0.75: return "RIG-EDGE", GREY
    if row["success"] < 50: return "FAILED", RED
    if row["success"] < 99 or (row["p95"] or 0) > 5000: return "DEGRADED", AMBER
    return "OK", GREEN

def rows_from_log():
    """Fallback source: log.md's own result table.

    run.sh writes every metric into the log line as it arrives, so the log is a
    complete record even when the raw results never leave the rig. That matters
    more than it sounds: the DGX is reachable over Tailscale, whose approval
    lapses on its own schedule, so the scp at the end of a ninety-minute run is
    the step most likely to fail — and it fails after every number has already
    been earned. Parsing the log means losing the rig is no longer the same as
    losing the run.
    """
    log = os.path.join(run_dir, "log.md")
    if not os.path.exists(log):
        return []
    out, lines = [], open(log).read().splitlines()
    for i, ln in enumerate(lines):
        parts = [c.strip() for c in ln.split("|")]
        if len(parts) < 6 or not parts[2].startswith(("read/", "write/")):
            continue
        run, script, varz, res = parts[1], parts[2], parts[3], parts[4]
        g = lambda k: (re.search(k + r"=([0-9.]+)", res) or [None, None])[1]
        peak = (re.search(r"PEAK_RATE=(\d+)", varz) or [None, "?"])[1]
        page = (re.search(r"MARKET_SLUG=(\S+)", varz) or [None, ""])[1] or \
               (re.search(r"PSEUDONYM=(\S+)", varz) or [None, ""])[1]
        # the health line that follows the row is this run's recovery window
        recov = ""
        for nxt in lines[i + 1:i + 3]:
            m = re.search(r"db health ok after (\d+) s|still '(\w+)' after (\d+) s", nxt)
            if m:
                recov = f"{m.group(1)} s" if m.group(1) else f">{m.group(3)} s ({m.group(2)})"
                break
        out.append({"run": run, "script": script, "page": page, "peak": peak,
                    "requests": g("requests"), "success": float(g("success")) if g("success") else None,
                    "p50": g("p50"), "p95": float(g("p95")) if g("p95") else None, "p99": g("p99"),
                    "noresp": g("no_response"), "dropped": g("dropped_iterations"),
                    "rig": "sign-in" in script or ("seeded" in run and peak not in ("20", "?")),
                    "canary": "", "db": parts[5].replace("db after:", "").strip(), "recovery": recov})
    return out


rows = []
results_dir = os.path.join(run_dir, "results")
for d in sorted(os.listdir(results_dir) if os.path.isdir(results_dir) else []):
    p = os.path.join(run_dir, "results", d)
    s = open(os.path.join(p, "summary.txt")).read() if os.path.exists(os.path.join(p, "summary.txt")) else ""
    m = open(os.path.join(p, "meta.txt")).read() if os.path.exists(os.path.join(p, "meta.txt")) else ""
    g = lambda k: (re.search(k + r"=([0-9.]+)", s) or [None, None])[1]
    script = (re.search(r"script=(\S+)", m) or [None, "?"])[1]
    peak = (re.search(r"PEAK_RATE=(\d+)", m) or [None, "?"])[1]
    page = (re.search(r"MARKET_SLUG=(\S+)", m) or [None, ""])[1] or (re.search(r"PAGE_PATH=(\S+)", m) or [None, ""])[1]
    rig = "sign-in" in script or ("seeded" in d and peak not in ("20", "50", "?"))
    rows.append({"run": d, "script": script, "page": page, "peak": peak, "requests": g("requests"),
                 "success": float(g("success")) if g("success") else None, "p50": g("p50"), "p95": float(g("p95")) if g("p95") else None,
                 "p99": g("p99"), "noresp": g("no_response"), "dropped": g("dropped_iterations"), "rig": rig,
                 "canary": (re.search(r'"canary":"([0-9a-f]{7})', m) or [None, "?"])[1]})

SOURCE = "results/"
if not rows:
    rows, SOURCE = rows_from_log(), "log.md"

wb = Workbook(); ws = wb.active; ws.title = "Runs"
hdr = ["Run", "Script", "Page / market", "Peak req/s", "Page KB", "MB/s needed", "Requests", "Success %", "p50 ms", "p95 ms", "p99 ms", "No response", "Dropped", "DB after", "Recovery", "Status"]
ws.append(hdr)
for c in ws[1]: c.fill = HEAD; c.font = HFONT
for r in rows:
    st, fill = status(r)
    pb = page_bytes(r["run"]); ws.append([r["run"], r["script"], r["page"], r["peak"], round(pb/1024) if pb else None, needed_mbps(r), r["requests"], r["success"], r["p50"], r["p95"], r["p99"], r["noresp"], r["dropped"], r.get("db", ""), r.get("recovery", ""), st])
    ws.cell(ws.max_row, len(hdr)).fill = fill
    if r.get("db") == "error": ws.cell(ws.max_row, 14).fill = AMBER
for i, w in enumerate([34, 26, 36, 10, 9, 12, 10, 10, 9, 9, 9, 12, 10, 10, 12, 12], 1): ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = "A2"

wt = wb.create_sheet("Write tests"); wt.append(["Test", "Attempted", "Succeeded", "Outcomes", "Wall s", "p50 ms", "Max ms"])
for c in wt[1]: c.fill = HEAD; c.font = HFONT
jl = os.path.join(run_dir, "write-tests.jsonl")
if os.path.exists(jl):
    for line in open(jl):
        try: j = json.loads(line)
        except Exception: continue
        if "test" in j: wt.append([j["test"], j["attempted"], j["succeeded"], json.dumps(j["outcomes"]), j["wall_s"], j["p50_ms"], j["max_ms"]])
for i, w in enumerate([28, 10, 10, 60, 8, 8, 8], 1): wt.column_dimensions[get_column_letter(i)].width = w

notes = wb.create_sheet("Read me")
for line in [
    f"Market: {slug}. Row source for this report: {SOURCE}.",
    "results/ is the raw k6 output; log.md is the fallback and carries the same numbers, because run.sh writes each metric into the log as the run ends. A log-sourced report has no per-run canary column — that field lives only in the raw meta.txt.",
    "RIG-BOUND = page bytes x req/s exceeds the rig's measured ~15 MB/s ceiling, so the row measures the DGX and not the server. RIG-EDGE = above 75% of it; treat as suspect. Both are COMPUTED from the Page KB column, not assumed from the run name.",
    "Page KB is the HTML size measured at the time that run executed. It moves during the campaign: the market page grew 71 KB -> 441 KB as 33 image posts landed, and the seeding account's own profile grew 64 KB -> 243 KB with it.",
    "DEGRADED = success under 99% or p95 over 5 s. FAILED = success under 50%.",
    "Compare with the Chess market (2026-09-15): 5 posts → 96.9% at 100 req/s; break between 200 and 300 req/s; deep links 100% under 0.5 s; db:error windows after most runs, recovering in 10 s–2 min.",
    "Write bursts: named refusals (opposite_side_held, error_rate_limit_exceeded, error_bet_serialization_exhausted) are correct behaviour; empty-body HTTP 500s coincided with a deploy last time — check the canary before/after in log.md.",
]:
    notes.append([line])
notes.column_dimensions["A"].width = 140
wb.save(os.path.join(run_dir, "report.xlsx")); print("report.xlsx written")
